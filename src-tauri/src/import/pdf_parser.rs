use crate::error::{AppError, Result};
use pdfium::PdfiumDocument;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfTransaction {
    pub date: String,
    pub description: String,
    pub amount: i64,
    pub running_balance: Option<i64>,
    pub raw_line: String,
    pub category: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfPreview {
    pub transactions: Vec<PdfTransaction>,
    pub total_rows: usize,
    pub detected_format: Option<String>,
    pub detected_columns: Vec<String>,
    pub raw_text_sample: String,
    pub confidence: f32,
}

/// Date patterns to detect transaction lines
const DATE_PATTERNS: &[&str] = &[
    r"^\d{1,2}/\d{1,2}/\d{2,4}",      // MM/DD/YYYY or MM/DD/YY
    r"^\d{4}-\d{2}-\d{2}",             // YYYY-MM-DD (ISO)
    r"^\d{1,2}-\d{1,2}-\d{2,4}",       // MM-DD-YYYY
];

/// Header patterns that indicate a transaction table
const HEADER_KEYWORDS: &[&str] = &[
    "date",
    "description",
    "amount",
    "balance",
    "debit",
    "credit",
    "withdrawal",
    "deposit",
    "transaction",
    "posted",
];

/// Parse amount string like "1,285.00", "-1,050.00", "($50.00)", "113.19CR" to cents
fn parse_amount(s: &str) -> Option<i64> {
    let cleaned = s.trim().replace(',', "").replace('$', "");
    if cleaned.is_empty() {
        return None;
    }

    // Handle credit amounts with CR suffix (e.g., "113.19CR")
    let (is_credit, after_cr) = if cleaned.to_uppercase().ends_with("CR") {
        (true, cleaned[..cleaned.len() - 2].to_string())
    } else {
        (false, cleaned)
    };

    // Handle negative amounts: (100.00) or -100.00 or 100.00-
    let (is_negative, num_str) = if after_cr.starts_with('(') && after_cr.ends_with(')') {
        (true, after_cr[1..after_cr.len() - 1].to_string())
    } else if after_cr.starts_with('-') {
        (true, after_cr[1..].to_string())
    } else if after_cr.ends_with('-') {
        (true, after_cr[..after_cr.len() - 1].to_string())
    } else {
        (false, after_cr)
    };

    let amount: f64 = num_str.parse().ok()?;
    let cents = (amount * 100.0).round() as i64;

    // Credits are positive (money coming in), debits are negative (money going out)
    // For credit cards, regular charges are negative, credits/refunds are positive
    if is_credit {
        Some(cents) // CR means credit/refund, so positive
    } else if is_negative {
        Some(-cents)
    } else {
        Some(-cents) // Regular charges on credit card are expenses (negative)
    }
}

/// Parse date from various formats to YYYY-MM-DD
fn parse_date(s: &str) -> Option<String> {
    let trimmed = s.trim();

    // Try MM/DD/YYYY or MM/DD/YY
    if let Some(caps) = Regex::new(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})").ok()?.captures(trimmed) {
        let month: u32 = caps.get(1)?.as_str().parse().ok()?;
        let day: u32 = caps.get(2)?.as_str().parse().ok()?;
        let mut year: u32 = caps.get(3)?.as_str().parse().ok()?;
        if year < 100 {
            year += 2000;
        }
        return Some(format!("{:04}-{:02}-{:02}", year, month, day));
    }

    // Try YYYY-MM-DD
    if let Some(caps) = Regex::new(r"^(\d{4})-(\d{2})-(\d{2})").ok()?.captures(trimmed) {
        let year: u32 = caps.get(1)?.as_str().parse().ok()?;
        let month: u32 = caps.get(2)?.as_str().parse().ok()?;
        let day: u32 = caps.get(3)?.as_str().parse().ok()?;
        return Some(format!("{:04}-{:02}-{:02}", year, month, day));
    }

    // Try MM-DD-YYYY
    if let Some(caps) = Regex::new(r"^(\d{1,2})-(\d{1,2})-(\d{2,4})").ok()?.captures(trimmed) {
        let month: u32 = caps.get(1)?.as_str().parse().ok()?;
        let day: u32 = caps.get(2)?.as_str().parse().ok()?;
        let mut year: u32 = caps.get(3)?.as_str().parse().ok()?;
        if year < 100 {
            year += 2000;
        }
        return Some(format!("{:04}-{:02}-{:02}", year, month, day));
    }

    None
}

/// Extract amounts from the end of a line
/// Financial amounts must have exactly 2 decimal places (e.g., "1,234.56")
fn extract_amounts_from_end(line: &str) -> Vec<i64> {
    let mut amounts = Vec::new();

    // Match financial amounts: optional $, optional negative, digits with commas,
    // REQUIRED decimal point with exactly 2 digits, optional CR suffix for credits
    // Examples: $1,234.56, -500.00, (1,000.50), 50.00-, 113.19CR
    let amount_pattern = Regex::new(
        r"[\$]?[\-\(]?[\d,]{1,12}\.\d{2}[\)\-]?(?:CR)?"
    ).unwrap();

    // Find all amount-like patterns
    let matches: Vec<_> = amount_pattern.find_iter(line).collect();

    // Take the last 2-3 numbers (amount, optional balance)
    for m in matches.iter().rev().take(3) {
        if let Some(amt) = parse_amount(m.as_str()) {
            // Sanity check: amounts should be reasonable (less than $10 million)
            if amt.abs() <= 1_000_000_000 {
                amounts.push(amt);
            }
        }
    }

    amounts.reverse();
    amounts
}

/// Check if a line looks like a header row
fn is_header_line(line: &str) -> bool {
    let lower = line.to_lowercase();
    let keyword_count = HEADER_KEYWORDS.iter().filter(|k| lower.contains(*k)).count();
    keyword_count >= 2
}

/// Month abbreviations used to detect summary tables
const MONTH_ABBREVS: &[&str] = &[
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec",
];

/// Words that indicate summary/total rows to skip
const SUMMARY_KEYWORDS: &[&str] = &[
    "total", "summary", "subtotal", "balance forward", "previous balance",
    "ending balance", "beginning balance", "opening balance", "closing balance",
    "average", "minimum", "maximum", "page", "continued", "spending",
    "income", "net", "cash flow", "overview", "breakdown",
];

/// Common category names that might appear as headers
const CATEGORY_KEYWORDS: &[&str] = &[
    "groceries", "dining", "restaurants", "shopping", "entertainment",
    "utilities", "bills", "transportation", "gas", "travel", "healthcare",
    "medical", "insurance", "education", "subscriptions", "personal",
    "home", "automotive", "clothing", "electronics", "gifts", "donations",
    "fees", "taxes", "income", "salary", "transfer", "payment",
];

/// Check if a line looks like part of a summary table (has multiple month names)
fn is_summary_table_line(line: &str) -> bool {
    let lower = line.to_lowercase();

    // Count how many month abbreviations appear
    let month_count = MONTH_ABBREVS.iter().filter(|m| lower.contains(*m)).count();

    // If 2+ months appear, it's likely a monthly breakdown header/row
    month_count >= 2
}

/// Check if a line is just a category header (e.g., "Groceries" or "Dining:")
/// Returns the category name if it is a category header, None otherwise
fn extract_category_header(line: &str) -> Option<String> {
    let lower = line.to_lowercase();
    let trimmed = lower.trim().trim_end_matches(':');

    // Make sure it's not a transaction line (no date at start)
    if starts_with_date(line) {
        return None;
    }

    // Check if the line is primarily just a category name
    for category in CATEGORY_KEYWORDS {
        if trimmed == *category || trimmed.starts_with(&format!("{} ", category)) {
            // Return the original casing from the line, cleaned up
            let original = line.trim().trim_end_matches(':').to_string();
            return Some(original);
        }
    }

    None
}

/// Check if a line is just a category header (e.g., "Groceries" or "Dining:")
fn is_category_header(line: &str) -> bool {
    extract_category_header(line).is_some()
}

/// Check if a line looks like chart residue or noise
fn is_chart_noise(line: &str) -> bool {
    let trimmed = line.trim();

    // Very short lines are likely noise
    if trimmed.len() < 3 {
        return true;
    }

    // Lines that are just a dollar amount (subtotals like "$60.73" or "$6,803.56")
    if let Ok(re) = Regex::new(r"^\$[\d,]+\.\d{2}$") {
        if re.is_match(trimmed) {
            return true;
        }
    }

    // Lines that are just numbers (possibly chart labels)
    if trimmed.chars().all(|c| c.is_ascii_digit() || c == '.' || c == ',' || c == '%' || c == '$' || c.is_whitespace()) {
        // But not if it looks like a reasonable amount
        if !trimmed.contains('.') || trimmed.len() < 4 {
            return true;
        }
    }

    // Chart labels like "1957.35 FEB" or "2508.71 MAR" (amount + month abbreviation)
    if let Ok(re) = Regex::new(r"^\d+\.?\d*\s+[A-Z]{3}$") {
        if re.is_match(trimmed) {
            return true;
        }
    }

    // Lines with just a single month name
    let lower = trimmed.to_lowercase();
    for month in MONTH_ABBREVS {
        if lower == *month || lower == format!("{}.", month) {
            return true;
        }
    }

    // Full month names (as standalone line or with amounts = monthly summary row)
    let full_months = ["january", "february", "march", "april", "may", "june",
                       "july", "august", "september", "october", "november", "december"];
    for month in full_months {
        if lower == month {
            return true;
        }
        // Monthly summary rows like "JANUARY $1,312.74 $382.13 $57.54..."
        if lower.starts_with(month) && lower.contains('$') {
            return true;
        }
    }

    false
}

/// Check if a line looks like a category header with a total (e.g., "Department Store $60.73")
fn is_category_total_line(line: &str) -> bool {
    let trimmed = line.trim();

    // Must have a dollar amount at the end
    if !trimmed.contains('$') {
        return false;
    }

    // Should not start with a date
    if starts_with_date(line) {
        return false;
    }

    // Check if it matches pattern: "Category Name $123.45" (text followed by single amount)
    // These lines typically have the category name and total, not transaction details
    if let Ok(re) = Regex::new(r"^[A-Za-z][A-Za-z\s/]+\$[\d,]+\.\d{2}$") {
        if re.is_match(trimmed) {
            return true;
        }
    }

    false
}

/// Check if a line is a quarterly/annual total row
fn is_total_row(line: &str) -> bool {
    let lower = line.to_lowercase();

    // Quarterly total, Annual total, etc.
    if lower.starts_with("quarterly") || lower.starts_with("annual") {
        return true;
    }

    false
}

/// Check if a line should be skipped (summary row, total, etc.)
fn should_skip_line(line: &str) -> bool {
    let lower = line.to_lowercase();

    // Skip lines with summary keywords
    for keyword in SUMMARY_KEYWORDS {
        if lower.contains(keyword) {
            return true;
        }
    }

    // Skip monthly summary table lines (lines with 2+ month names)
    if is_summary_table_line(line) {
        return true;
    }

    // Skip category header lines (just category name without transaction data)
    if is_category_header(line) {
        return true;
    }

    // Skip chart noise (short lines, just amounts, chart labels, month names)
    if is_chart_noise(line) {
        return true;
    }

    // Skip category total lines (like "Department Store $60.73")
    if is_category_total_line(line) {
        return true;
    }

    // Skip quarterly/annual total rows
    if is_total_row(line) {
        return true;
    }

    false
}

/// Check if a line indicates the start of a transaction section
fn is_transaction_section_start(line: &str) -> bool {
    let lower = line.to_lowercase();
    lower.contains("transaction") ||
    lower.contains("activity") ||
    lower.contains("details") ||
    lower.contains("account activity")
}

/// Check if a line starts with a date pattern
fn starts_with_date(line: &str) -> bool {
    for pattern in DATE_PATTERNS {
        if let Ok(re) = Regex::new(pattern) {
            if re.is_match(line.trim()) {
                return true;
            }
        }
    }
    false
}

/// Extract date from the beginning of a line
fn extract_date_from_line(line: &str) -> Option<(String, usize)> {
    for pattern in DATE_PATTERNS {
        if let Ok(re) = Regex::new(pattern) {
            if let Some(m) = re.find(line.trim()) {
                if let Some(date) = parse_date(m.as_str()) {
                    return Some((date, m.end()));
                }
            }
        }
    }
    None
}

/// Parse a transaction line with an optional category
fn parse_transaction_line(line: &str, category: Option<String>) -> Option<PdfTransaction> {
    // Extract date from the beginning
    let (date, date_end) = extract_date_from_line(line)?;

    // Extract amounts from the end
    let amounts = extract_amounts_from_end(line);
    if amounts.is_empty() {
        return None;
    }

    // Get the main amount (first one if multiple, as balance is usually last)
    let (amount, running_balance) = if amounts.len() >= 2 {
        (amounts[0], Some(amounts[amounts.len() - 1]))
    } else {
        (amounts[0], None)
    };

    // Description is between the date and the amounts
    let trimmed = line.trim();
    let after_date = if date_end < trimmed.len() {
        &trimmed[date_end..]
    } else {
        ""
    };

    // Find where amounts start by looking for the first financial amount pattern
    // Must have decimal point with 2 digits to be considered an amount
    let amount_pattern = Regex::new(r"[\$]?[\-\(]?[\d,]{1,12}\.\d{2}").unwrap();
    let description = if let Some(first_amount) = amount_pattern.find(after_date) {
        after_date[..first_amount.start()].trim().to_string()
    } else {
        after_date.trim().to_string()
    };

    // Skip if description is empty or too short
    if description.len() < 2 {
        return None;
    }

    Some(PdfTransaction {
        date,
        description,
        amount,
        running_balance,
        raw_line: line.to_string(),
        category,
    })
}

/// Extract text from PDF file using PDFium (Chrome's PDF library)
fn extract_text(path: &Path) -> Result<String> {
    let path_str = path.to_str()
        .ok_or_else(|| AppError::Other("Invalid path encoding".to_string()))?;

    let document = PdfiumDocument::new_from_path(path_str, None)
        .map_err(|e| AppError::Other(format!("Failed to open PDF: {:?}", e)))?;

    let mut all_text = String::new();

    let page_count = document.page_count();
    for page_index in 0..page_count {
        if let Ok(page) = document.page(page_index as i32) {
            if let Ok(text_page) = page.text() {
                all_text.push_str(&text_page.full());
                all_text.push('\n');
            }
        }
    }

    Ok(all_text)
}

/// Detect the statement format and extract column headers
fn detect_format(text: &str) -> (Option<String>, Vec<String>) {
    let lines: Vec<&str> = text.lines().collect();

    for line in &lines {
        if is_header_line(line) {
            let lower = line.to_lowercase();
            let columns: Vec<String> = HEADER_KEYWORDS
                .iter()
                .filter(|k| lower.contains(*k))
                .map(|k| k.to_string())
                .collect();

            // Try to detect bank from common patterns
            let format = if text.to_lowercase().contains("bank of america") {
                Some("Bank of America".to_string())
            } else if text.to_lowercase().contains("chase") {
                Some("Chase".to_string())
            } else if text.to_lowercase().contains("wells fargo") {
                Some("Wells Fargo".to_string())
            } else if text.to_lowercase().contains("citi") {
                Some("Citi".to_string())
            } else {
                Some("Generic".to_string())
            };

            return (format, columns);
        }
    }

    (None, vec![])
}

/// Preview a PDF statement
pub fn preview_pdf(path: &Path, limit: usize) -> Result<PdfPreview> {
    let text = extract_text(path)?;

    // Check if we got meaningful text
    if text.trim().len() < 100 {
        return Err(AppError::Other(
            "PDF appears to be image-based or contains very little text. Please export as CSV from your bank.".to_string()
        ));
    }

    let (detected_format, detected_columns) = detect_format(&text);

    let lines: Vec<&str> = text.lines().collect();
    let mut transactions = Vec::new();
    let mut in_transaction_section = false;
    let mut past_summary = false;
    let mut valid_lines = 0;
    let mut total_lines = 0;
    let mut current_category: Option<String> = None;

    for line in &lines {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        // Check if we're entering a transaction section
        if is_transaction_section_start(trimmed) {
            in_transaction_section = true;
            past_summary = true;
            continue;
        }

        // Check for transaction table header
        if is_header_line(trimmed) {
            past_summary = true;
            continue;
        }

        // Check for category header and update current category before skipping
        if let Some(category) = extract_category_header(trimmed) {
            current_category = Some(category);
            continue;
        }

        // Skip lines that look like summary/total rows
        if should_skip_line(trimmed) {
            continue;
        }

        // Parse transaction lines (only if we're past the summary section or found a transaction header)
        if starts_with_date(trimmed) {
            total_lines += 1;
            if let Some(tx) = parse_transaction_line(trimmed, current_category.clone()) {
                valid_lines += 1;
                // Only add if we're past summary section, OR if we haven't found any structure yet
                // (some PDFs don't have clear section markers)
                if past_summary || in_transaction_section || transactions.is_empty() {
                    transactions.push(tx);
                }
            }
        }
    }

    // If we got very few transactions, try again without the section filtering
    // This handles PDFs that don't have clear section markers
    if transactions.len() < 3 {
        transactions.clear();
        valid_lines = 0;
        total_lines = 0;
        current_category = None;

        for line in &lines {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            // Check for category header and update current category before skipping
            if let Some(category) = extract_category_header(trimmed) {
                current_category = Some(category);
                continue;
            }

            // Still skip obvious summary lines
            if should_skip_line(trimmed) {
                continue;
            }

            if starts_with_date(trimmed) {
                total_lines += 1;
                if let Some(tx) = parse_transaction_line(trimmed, current_category.clone()) {
                    valid_lines += 1;
                    transactions.push(tx);
                }
            }
        }
    }

    // Calculate confidence based on parsing success rate
    let confidence = if total_lines > 0 {
        valid_lines as f32 / total_lines as f32
    } else {
        0.0
    };

    let total = transactions.len();
    let raw_text_sample = text.chars().take(500).collect();

    Ok(PdfPreview {
        transactions: transactions.into_iter().take(limit).collect(),
        total_rows: total,
        detected_format,
        detected_columns,
        raw_text_sample,
        confidence,
    })
}

/// Parse all transactions from a PDF statement
pub fn parse_pdf(path: &Path) -> Result<Vec<PdfTransaction>> {
    let preview = preview_pdf(path, usize::MAX)?;
    Ok(preview.transactions)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_amount() {
        // Regular amounts on credit card statements are expenses (negative)
        assert_eq!(parse_amount("1,285.00"), Some(-128500));
        assert_eq!(parse_amount("$100.50"), Some(-10050));
        // Explicitly negative amounts
        assert_eq!(parse_amount("-1,050.00"), Some(-105000));
        assert_eq!(parse_amount("($50.00)"), Some(-5000));
        assert_eq!(parse_amount("50.00-"), Some(-5000));
        // CR suffix means credit/refund (positive)
        assert_eq!(parse_amount("113.19CR"), Some(11319));
        assert_eq!(parse_amount("$50.00CR"), Some(5000));
    }

    #[test]
    fn test_parse_date() {
        assert_eq!(parse_date("01/15/2025"), Some("2025-01-15".to_string()));
        assert_eq!(parse_date("1/5/25"), Some("2025-01-05".to_string()));
        assert_eq!(parse_date("2025-01-15"), Some("2025-01-15".to_string()));
        assert_eq!(parse_date("01-15-2025"), Some("2025-01-15".to_string()));
    }

    #[test]
    fn test_is_header_line() {
        assert!(is_header_line("Date Description Amount Balance"));
        assert!(is_header_line("POSTED DATE  DESCRIPTION  AMOUNT"));
        assert!(!is_header_line("01/15/2025 Coffee Shop -5.00"));
    }

    #[test]
    fn test_parse_transaction_line() {
        // Test a typical credit card transaction line (amounts are negative by default)
        let line = "01/15/25 COFFEE SHOP PALO ALTO, CA 5.50";
        let tx = parse_transaction_line(line, None).unwrap();
        assert_eq!(tx.date, "2025-01-15");
        assert_eq!(tx.amount, -550); // Expenses are negative
        assert!(tx.description.contains("COFFEE"));
        assert!(tx.category.is_none());

        // Test a credit/refund line
        let line_cr = "01/29/24 SQ *SELF EDGE WEB STOR San Francisco, CA 113.19CR";
        let tx_cr = parse_transaction_line(line_cr, Some("Dining".to_string())).unwrap();
        assert_eq!(tx_cr.date, "2024-01-29");
        assert_eq!(tx_cr.amount, 11319); // Credits are positive
        assert_eq!(tx_cr.category, Some("Dining".to_string()));
    }
}
