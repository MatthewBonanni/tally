use crate::error::{AppError, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvPreview {
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
    pub total_rows: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnMapping {
    pub date_column: usize,
    pub amount_column: usize,
    pub debit_column: Option<usize>,
    pub credit_column: Option<usize>,
    pub payee_column: Option<usize>,
    pub memo_column: Option<usize>,
    pub category_column: Option<usize>,
    pub date_format: String,
    pub invert_amounts: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedTransaction {
    pub date: String,
    pub amount: i64,
    pub payee: Option<String>,
    pub memo: Option<String>,
    pub category_hint: Option<String>,
    pub raw_data: HashMap<String, String>,
}

/// Preview a CSV file - read headers and first N rows
pub fn preview_csv(file_path: &Path, max_rows: usize) -> Result<CsvPreview> {
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .from_path(file_path)
        .map_err(|e| AppError::Other(format!("Failed to open CSV: {}", e)))?;

    let headers: Vec<String> = reader
        .headers()
        .map_err(|e| AppError::Other(format!("Failed to read headers: {}", e)))?
        .iter()
        .map(|s| s.to_string())
        .collect();

    let mut rows = Vec::new();
    let mut total_rows = 0;

    for result in reader.records() {
        total_rows += 1;
        if rows.len() < max_rows {
            if let Ok(record) = result {
                rows.push(record.iter().map(|s| s.to_string()).collect());
            }
        }
    }

    Ok(CsvPreview {
        headers,
        rows,
        total_rows,
    })
}

/// Parse a CSV file with the given column mapping
pub fn parse_csv(file_path: &Path, mapping: &ColumnMapping) -> Result<Vec<ParsedTransaction>> {
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .from_path(file_path)
        .map_err(|e| AppError::Other(format!("Failed to open CSV: {}", e)))?;

    let headers: Vec<String> = reader
        .headers()
        .map_err(|e| AppError::Other(format!("Failed to read headers: {}", e)))?
        .iter()
        .map(|s| s.to_string())
        .collect();

    let mut transactions = Vec::new();

    for result in reader.records() {
        let record = result.map_err(|e| AppError::Other(format!("Failed to read record: {}", e)))?;
        let fields: Vec<&str> = record.iter().collect();

        // Parse date
        let date_str = fields.get(mapping.date_column).unwrap_or(&"").trim();
        let parsed_date = parse_date(date_str, &mapping.date_format)?;

        // Parse amount
        let amount = if let (Some(debit_col), Some(credit_col)) =
            (mapping.debit_column, mapping.credit_column)
        {
            // Separate debit/credit columns
            let debit = parse_amount(fields.get(debit_col).unwrap_or(&""));
            let credit = parse_amount(fields.get(credit_col).unwrap_or(&""));
            credit - debit
        } else {
            // Single amount column
            let raw_amount = parse_amount(fields.get(mapping.amount_column).unwrap_or(&""));
            if mapping.invert_amounts {
                -raw_amount
            } else {
                raw_amount
            }
        };

        // Parse optional fields
        let payee = mapping
            .payee_column
            .and_then(|col| fields.get(col))
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        let memo = mapping
            .memo_column
            .and_then(|col| fields.get(col))
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        let category_hint = mapping
            .category_column
            .and_then(|col| fields.get(col))
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        // Build raw data map
        let mut raw_data = HashMap::new();
        for (i, header) in headers.iter().enumerate() {
            if let Some(value) = fields.get(i) {
                raw_data.insert(header.clone(), value.to_string());
            }
        }

        transactions.push(ParsedTransaction {
            date: parsed_date,
            amount,
            payee,
            memo,
            category_hint,
            raw_data,
        });
    }

    Ok(transactions)
}

/// Parse an amount string to cents (i64)
fn parse_amount(s: &str) -> i64 {
    let cleaned: String = s
        .trim()
        .replace('$', "")
        .replace(',', "")
        .replace('(', "-")
        .replace(')', "")
        .trim()
        .to_string();

    if cleaned.is_empty() {
        return 0;
    }

    // Try to parse as float and convert to cents
    cleaned
        .parse::<f64>()
        .map(|f| (f * 100.0).round() as i64)
        .unwrap_or(0)
}

/// Parse a date string with the given format
fn parse_date(s: &str, format: &str) -> Result<String> {
    use chrono::NaiveDate;

    let trimmed = s.trim();
    if trimmed.is_empty() {
        return Err(AppError::Validation("Empty date".to_string()));
    }

    // Try common formats if parsing fails
    let formats = if format.is_empty() {
        vec![
            "%Y-%m-%d",
            "%m/%d/%Y",
            "%m/%d/%y",
            "%d/%m/%Y",
            "%Y/%m/%d",
            "%m-%d-%Y",
            "%d-%m-%Y",
        ]
    } else {
        vec![format]
    };

    for fmt in formats {
        if let Ok(date) = NaiveDate::parse_from_str(trimmed, fmt) {
            return Ok(date.format("%Y-%m-%d").to_string());
        }
    }

    Err(AppError::Validation(format!(
        "Could not parse date: {}",
        s
    )))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_amount() {
        assert_eq!(parse_amount("100.00"), 10000);
        assert_eq!(parse_amount("-50.25"), -5025);
        assert_eq!(parse_amount("$1,234.56"), 123456);
        assert_eq!(parse_amount("(100.00)"), -10000);
        assert_eq!(parse_amount(""), 0);
    }
}
