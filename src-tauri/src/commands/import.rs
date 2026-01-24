use crate::db::Database;
use crate::error::Result;
use crate::import::boa_parser::{self, BoaPreview};
use crate::import::csv_parser::{self, ColumnMapping, CsvPreview, ParsedTransaction};
use crate::import::pdf_parser::{self, PdfPreview};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn preview_csv_file(file_path: String) -> Result<CsvPreview> {
    let path = PathBuf::from(&file_path);
    csv_parser::preview_csv(&path, 10)
}

#[tauri::command]
pub fn parse_csv_file(
    file_path: String,
    mapping: ColumnMapping,
) -> Result<Vec<ParsedTransaction>> {
    let path = PathBuf::from(&file_path);
    csv_parser::parse_csv(&path, &mapping)
}

#[tauri::command]
pub fn import_transactions(
    account_id: String,
    transactions: Vec<serde_json::Value>,
    db: State<'_, Mutex<Database>>,
) -> Result<ImportResult> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let batch_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let mut imported = 0;
    let mut skipped = 0;

    let mut imported_ids: Vec<String> = Vec::new();

    // Build a cache of category names to IDs for PDF category resolution
    let mut category_name_cache: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    {
        let mut stmt = conn.prepare(
            "SELECT id, name FROM categories WHERE deleted_at IS NULL"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        for row in rows {
            if let Ok((id, name)) = row {
                // Store lowercase name for case-insensitive matching
                category_name_cache.insert(name.to_lowercase(), id);
            }
        }
    }

    for tx in transactions {
        let date = tx["date"].as_str().unwrap_or("");
        let amount = tx["amount"].as_i64().unwrap_or(0);
        let payee = tx["payee"].as_str();
        let memo = tx["memo"].as_str();
        let mut category_id = tx["categoryId"].as_str().map(|s| s.to_string());

        // If no categoryId but we have a pdfCategory, try to resolve it
        if category_id.is_none() {
            if let Some(pdf_category) = tx["pdfCategory"].as_str() {
                let pdf_cat_lower = pdf_category.to_lowercase();
                if let Some(resolved_id) = category_name_cache.get(&pdf_cat_lower) {
                    category_id = Some(resolved_id.clone());
                }
            }
        }
        let category_id = category_id;

        // Simple duplicate detection: same account, date, amount, payee
        let existing: Option<String> = conn
            .query_row(
                "SELECT id FROM transactions
                 WHERE account_id = ?1 AND date = ?2 AND amount = ?3
                 AND (payee = ?4 OR (payee IS NULL AND ?4 IS NULL))
                 AND deleted_at IS NULL
                 LIMIT 1",
                rusqlite::params![account_id, date, amount, payee],
                |row| row.get(0),
            )
            .ok();

        if existing.is_some() {
            skipped += 1;
            continue;
        }

        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO transactions (
                id, account_id, date, amount, payee, original_payee, memo,
                category_id, status, import_source, import_batch_id, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?6, ?7, 'cleared', 'csv', ?8, ?9, ?9)",
            rusqlite::params![
                id,
                account_id,
                date,
                amount,
                payee,
                memo,
                category_id.as_deref(),
                batch_id,
                now,
            ],
        )?;
        imported_ids.push(id);
        imported += 1;
    }

    // Update account balance
    update_account_balance(conn, &account_id)?;

    // Auto-categorize imported transactions using rules
    let categorized = apply_category_rules_internal(conn, Some(imported_ids))?;

    Ok(ImportResult {
        imported,
        skipped,
        categorized,
        batch_id,
    })
}

/// Internal function to apply category rules to transactions
/// This is called automatically after import and can also be exposed via commands
fn apply_category_rules_internal(
    conn: &rusqlite::Connection,
    transaction_ids: Option<Vec<String>>,
) -> Result<i32> {
    // Get all active rules ordered by priority
    let mut rules_stmt = conn.prepare(
        "SELECT id, category_id, rule_type, pattern, amount_min, amount_max, account_id
         FROM category_rules
         WHERE is_active = 1
         ORDER BY priority DESC"
    )?;

    let rules: Vec<(String, String, String, String, Option<i64>, Option<i64>, Option<String>)> = rules_stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<i64>>(4)?,
                row.get::<_, Option<i64>>(5)?,
                row.get::<_, Option<String>>(6)?,
            ))
        })?
        .filter_map(|r| r.ok())
        .collect();

    if rules.is_empty() {
        return Ok(0);
    }

    // Get transactions to categorize
    let tx_query = if let Some(ref ids) = transaction_ids {
        if ids.is_empty() {
            return Ok(0);
        }
        let placeholders: Vec<String> = ids.iter().map(|_| "?".to_string()).collect();
        format!(
            "SELECT id, account_id, payee, amount FROM transactions
             WHERE id IN ({}) AND category_id IS NULL AND deleted_at IS NULL",
            placeholders.join(", ")
        )
    } else {
        "SELECT id, account_id, payee, amount FROM transactions
         WHERE category_id IS NULL AND deleted_at IS NULL".to_string()
    };

    let mut tx_stmt = conn.prepare(&tx_query)?;

    let transactions: Vec<(String, String, Option<String>, i64)> = if let Some(ref ids) = transaction_ids {
        tx_stmt
            .query_map(rusqlite::params_from_iter(ids.iter()), |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, i64>(3)?,
                ))
            })?
            .filter_map(|r| r.ok())
            .collect()
    } else {
        tx_stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, i64>(3)?,
                ))
            })?
            .filter_map(|r| r.ok())
            .collect()
    };

    let now = chrono::Utc::now().to_rfc3339();
    let mut categorized_count = 0;

    for (tx_id, tx_account_id, tx_payee, tx_amount) in transactions {
        for (_rule_id, category_id, rule_type, pattern, amount_min, amount_max, rule_account_id) in &rules {
            // Check account filter
            if let Some(acc_id) = rule_account_id {
                if acc_id != &tx_account_id {
                    continue;
                }
            }

            // Check amount range
            if let Some(min) = amount_min {
                if tx_amount < *min {
                    continue;
                }
            }
            if let Some(max) = amount_max {
                if tx_amount > *max {
                    continue;
                }
            }

            // Check pattern match
            let matches = match rule_type.as_str() {
                "payee_contains" => {
                    if let Some(ref payee) = tx_payee {
                        payee.to_lowercase().contains(&pattern.to_lowercase())
                    } else {
                        false
                    }
                }
                "payee_exact" => {
                    if let Some(ref payee) = tx_payee {
                        payee.to_lowercase() == pattern.to_lowercase()
                    } else {
                        false
                    }
                }
                "payee_starts_with" => {
                    if let Some(ref payee) = tx_payee {
                        payee.to_lowercase().starts_with(&pattern.to_lowercase())
                    } else {
                        false
                    }
                }
                "payee_regex" => {
                    if let Some(ref payee) = tx_payee {
                        regex::Regex::new(pattern)
                            .map(|re| re.is_match(payee))
                            .unwrap_or(false)
                    } else {
                        false
                    }
                }
                _ => false,
            };

            if matches {
                conn.execute(
                    "UPDATE transactions SET category_id = ?1, updated_at = ?2 WHERE id = ?3",
                    rusqlite::params![category_id, now, tx_id],
                )?;
                categorized_count += 1;
                break; // Use first matching rule
            }
        }
    }

    // Second pass: learn from existing transactions with same payee
    // Get remaining uncategorized transactions
    let uncategorized_query = if let Some(ref ids) = transaction_ids {
        if ids.is_empty() {
            return Ok(categorized_count);
        }
        let placeholders: Vec<String> = ids.iter().map(|_| "?".to_string()).collect();
        format!(
            "SELECT id, payee FROM transactions
             WHERE id IN ({}) AND category_id IS NULL AND payee IS NOT NULL AND deleted_at IS NULL",
            placeholders.join(", ")
        )
    } else {
        "SELECT id, payee FROM transactions
         WHERE category_id IS NULL AND payee IS NOT NULL AND deleted_at IS NULL".to_string()
    };

    let mut uncategorized_stmt = conn.prepare(&uncategorized_query)?;

    let uncategorized: Vec<(String, String)> = if let Some(ref ids) = transaction_ids {
        uncategorized_stmt
            .query_map(rusqlite::params_from_iter(ids.iter()), |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?
            .filter_map(|r| r.ok())
            .collect()
    } else {
        uncategorized_stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?
            .filter_map(|r| r.ok())
            .collect()
    };

    // For each uncategorized transaction, find a previous transaction with same payee that has a category
    for (tx_id, payee) in uncategorized {
        let existing_category: Option<String> = conn
            .query_row(
                "SELECT category_id FROM transactions
                 WHERE payee = ?1 AND category_id IS NOT NULL AND deleted_at IS NULL AND id != ?2
                 ORDER BY date DESC
                 LIMIT 1",
                rusqlite::params![payee, tx_id],
                |row| row.get(0),
            )
            .ok();

        if let Some(category_id) = existing_category {
            conn.execute(
                "UPDATE transactions SET category_id = ?1, updated_at = ?2 WHERE id = ?3",
                rusqlite::params![category_id, now, tx_id],
            )?;
            categorized_count += 1;
        }
    }

    Ok(categorized_count)
}

fn update_account_balance(conn: &rusqlite::Connection, account_id: &str) -> Result<()> {
    let balance: i64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM transactions
         WHERE account_id = ?1 AND deleted_at IS NULL",
        [account_id],
        |row| row.get(0),
    )?;

    conn.execute(
        "UPDATE accounts SET current_balance = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![balance, chrono::Utc::now().to_rfc3339(), account_id],
    )?;

    Ok(())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub imported: usize,
    pub skipped: usize,
    pub categorized: i32,
    pub batch_id: String,
}

// Bank of America text file parser
#[tauri::command]
pub fn preview_boa_file(file_path: String) -> Result<BoaPreview> {
    let path = PathBuf::from(&file_path);
    boa_parser::preview_boa(&path, 20)
}

#[tauri::command]
pub fn parse_boa_file(file_path: String) -> Result<Vec<serde_json::Value>> {
    let path = PathBuf::from(&file_path);
    let transactions = boa_parser::parse_boa(&path)?;

    // Convert to JSON values for the frontend
    let result: Vec<serde_json::Value> = transactions
        .into_iter()
        .map(|tx| {
            serde_json::json!({
                "date": tx.date,
                "amount": tx.amount,
                "payee": tx.description,
                "memo": tx.description,
            })
        })
        .collect();

    Ok(result)
}

// PDF file parser
#[tauri::command]
pub fn preview_pdf_file(file_path: String) -> Result<PdfPreview> {
    let path = PathBuf::from(&file_path);
    pdf_parser::preview_pdf(&path, 20)
}

#[tauri::command]
pub fn parse_pdf_file(file_path: String) -> Result<Vec<serde_json::Value>> {
    let path = PathBuf::from(&file_path);
    let transactions = pdf_parser::parse_pdf(&path)?;

    // Convert to JSON values for the frontend
    let result: Vec<serde_json::Value> = transactions
        .into_iter()
        .map(|tx| {
            serde_json::json!({
                "date": tx.date,
                "amount": tx.amount,
                "payee": tx.description,
                "memo": tx.description,
                "pdfCategory": tx.category,
            })
        })
        .collect();

    Ok(result)
}
