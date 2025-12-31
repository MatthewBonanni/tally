use crate::error::{AppError, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoaTransaction {
    pub date: String,
    pub description: String,
    pub amount: i64,
    pub running_balance: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoaPreview {
    pub transactions: Vec<BoaTransaction>,
    pub total_rows: usize,
    pub beginning_balance: Option<i64>,
    pub ending_balance: Option<i64>,
}

/// Parse amount string like "1,285.00" or "-1,050.00" to cents
fn parse_amount(s: &str) -> Option<i64> {
    let cleaned = s.trim().replace(',', "");
    if cleaned.is_empty() {
        return None;
    }

    // Handle negative amounts
    let (is_negative, num_str) = if cleaned.starts_with('-') {
        (true, &cleaned[1..])
    } else if cleaned.starts_with('(') && cleaned.ends_with(')') {
        (true, &cleaned[1..cleaned.len() - 1])
    } else {
        (false, cleaned.as_str())
    };

    let amount: f64 = num_str.parse().ok()?;
    let cents = (amount * 100.0).round() as i64;

    Some(if is_negative { -cents } else { cents })
}

/// Parse date from MM/DD/YYYY to YYYY-MM-DD
fn parse_date(s: &str) -> Option<String> {
    let parts: Vec<&str> = s.trim().split('/').collect();
    if parts.len() != 3 {
        return None;
    }

    let month = parts[0].parse::<u32>().ok()?;
    let day = parts[1].parse::<u32>().ok()?;
    let year = parts[2].parse::<u32>().ok()?;

    Some(format!("{:04}-{:02}-{:02}", year, month, day))
}

/// Preview a Bank of America text statement
pub fn preview_boa(path: &Path, limit: usize) -> Result<BoaPreview> {
    let content = fs::read_to_string(path)
        .map_err(|e| AppError::Io(e))?;

    let mut transactions = Vec::new();
    let mut beginning_balance: Option<i64> = None;
    let mut ending_balance: Option<i64> = None;
    let mut in_transactions = false;

    for line in content.lines() {
        let trimmed = line.trim();

        // Look for summary balances
        if trimmed.starts_with("Beginning balance as of") {
            if let Some(amt) = extract_summary_amount(trimmed) {
                beginning_balance = Some(amt);
            }
        } else if trimmed.starts_with("Ending balance as of") {
            if let Some(amt) = extract_summary_amount(trimmed) {
                ending_balance = Some(amt);
            }
        }

        // Detect transaction section header
        if trimmed.starts_with("Date") && trimmed.contains("Description") && trimmed.contains("Amount") {
            in_transactions = true;
            continue;
        }

        if !in_transactions {
            continue;
        }

        // Skip empty lines
        if trimmed.is_empty() {
            continue;
        }

        // Try to parse as transaction
        if let Some(tx) = parse_transaction_line(line) {
            // Skip the "Beginning balance" row in transaction list
            if tx.description.contains("Beginning balance") {
                continue;
            }
            transactions.push(tx);
        }
    }

    let total = transactions.len();

    Ok(BoaPreview {
        transactions: transactions.into_iter().take(limit).collect(),
        total_rows: total,
        beginning_balance,
        ending_balance,
    })
}

/// Parse all transactions from a Bank of America text statement
pub fn parse_boa(path: &Path) -> Result<Vec<BoaTransaction>> {
    let preview = preview_boa(path, usize::MAX)?;
    Ok(preview.transactions)
}

/// Extract amount from summary line like "Beginning balance as of 01/01/2025    7,703.79"
fn extract_summary_amount(line: &str) -> Option<i64> {
    // Find the last number-like thing in the line
    let parts: Vec<&str> = line.split_whitespace().collect();
    if let Some(last) = parts.last() {
        return parse_amount(last);
    }
    None
}

/// Parse a transaction line from BoA format
/// Format: Date (col 0-10), Description (variable), Amount (right-aligned), Running Bal (right-aligned)
fn parse_transaction_line(line: &str) -> Option<BoaTransaction> {
    // BoA format has fixed-width columns but we need to be smart about it
    // Date is at the start (MM/DD/YYYY format)
    // Then description
    // Then amount and running balance are right-aligned at the end

    if line.len() < 15 {
        return None;
    }

    // Try to extract date from the beginning
    let date_part = &line[..10].trim();
    let date = parse_date(date_part)?;

    // Find the numbers at the end of the line
    // Running balance is the last number, amount is second to last
    let numbers = extract_numbers_from_end(line);
    if numbers.is_empty() {
        return None;
    }

    let (amount, running_balance) = if numbers.len() >= 2 {
        (numbers[numbers.len() - 2], Some(numbers[numbers.len() - 1]))
    } else {
        (numbers[0], None)
    };

    // Description is everything between date and the numbers
    // We need to find where the numbers start
    let desc_end = find_amount_start(line);
    let description = if desc_end > 12 {
        line[12..desc_end].trim().to_string()
    } else {
        line[12..].trim().to_string()
    };

    Some(BoaTransaction {
        date,
        description,
        amount,
        running_balance,
    })
}

/// Extract numbers from the end of the line
fn extract_numbers_from_end(line: &str) -> Vec<i64> {
    let mut numbers = Vec::new();
    let mut current = String::new();
    let mut in_number = false;

    for ch in line.chars().rev() {
        if ch.is_ascii_digit() || ch == '.' || ch == ',' || ch == '-' {
            current.insert(0, ch);
            in_number = true;
        } else if in_number {
            if let Some(amt) = parse_amount(&current) {
                numbers.push(amt);
            }
            current.clear();
            in_number = false;

            // Stop after finding 2 numbers (running bal + amount)
            if numbers.len() >= 2 {
                break;
            }
        }
    }

    // Don't forget the last number if we ended in one
    if in_number && !current.is_empty() {
        if let Some(amt) = parse_amount(&current) {
            numbers.push(amt);
        }
    }

    numbers.reverse();
    numbers
}

/// Find where the amount section starts in the line
fn find_amount_start(line: &str) -> usize {
    // Look for pattern: multiple spaces followed by a number or negative sign
    let chars: Vec<char> = line.chars().collect();
    let mut space_count = 0;

    for (i, &ch) in chars.iter().enumerate().skip(12) {
        if ch == ' ' {
            space_count += 1;
        } else {
            if space_count >= 3 && (ch.is_ascii_digit() || ch == '-') {
                return i - space_count;
            }
            space_count = 0;
        }
    }

    line.len()
}

/// Convert BoaTransaction to the common ParsedTransaction format
pub fn to_parsed_transactions(transactions: Vec<BoaTransaction>) -> Vec<HashMap<String, serde_json::Value>> {
    transactions
        .into_iter()
        .map(|tx| {
            let mut map = HashMap::new();
            map.insert("date".to_string(), serde_json::Value::String(tx.date));
            map.insert("amount".to_string(), serde_json::Value::Number(tx.amount.into()));
            map.insert("payee".to_string(), serde_json::Value::String(tx.description.clone()));
            map.insert("memo".to_string(), serde_json::Value::String(tx.description));
            map
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_amount() {
        assert_eq!(parse_amount("1,285.00"), Some(128500));
        assert_eq!(parse_amount("-1,050.00"), Some(-105000));
        assert_eq!(parse_amount("0.09"), Some(9));
        assert_eq!(parse_amount("7,703.79"), Some(770379));
    }

    #[test]
    fn test_parse_date() {
        assert_eq!(parse_date("01/06/2025"), Some("2025-01-06".to_string()));
        assert_eq!(parse_date("12/30/2025"), Some("2025-12-30".to_string()));
    }
}
