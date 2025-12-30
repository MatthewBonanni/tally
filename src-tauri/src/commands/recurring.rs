use crate::db::Database;
use crate::error::Result;
use crate::models::RecurringTransaction;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedRecurring {
    pub payee: String,
    pub normalized_payee: String,
    pub average_amount: i64,
    pub frequency: String,
    pub frequency_days: i32,
    pub occurrences: i32,
    pub last_date: String,
    pub next_expected_date: String,
    pub account_id: String,
    pub account_name: String,
    pub category_id: Option<String>,
    pub transactions: Vec<TransactionSummary>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionSummary {
    pub id: String,
    pub date: String,
    pub amount: i64,
}

#[tauri::command]
pub fn list_recurring_transactions(db: State<'_, Mutex<Database>>) -> Result<Vec<RecurringTransaction>> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let mut stmt = conn.prepare(
        "SELECT id, account_id, payee, amount, category_id, frequency, start_date, end_date,
                next_expected_date, last_matched_transaction_id, tolerance_days, tolerance_amount,
                is_auto_detected, is_active, created_at, updated_at
         FROM recurring_transactions
         WHERE is_active = 1
         ORDER BY next_expected_date ASC NULLS LAST"
    )?;

    let recurring = stmt
        .query_map([], |row| {
            Ok(RecurringTransaction {
                id: row.get(0)?,
                account_id: row.get(1)?,
                payee: row.get(2)?,
                amount: row.get(3)?,
                category_id: row.get(4)?,
                frequency: row.get(5)?,
                start_date: row.get(6)?,
                end_date: row.get(7)?,
                next_expected_date: row.get(8)?,
                last_matched_transaction_id: row.get(9)?,
                tolerance_days: row.get(10)?,
                tolerance_amount: row.get(11)?,
                is_auto_detected: row.get(12)?,
                is_active: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(recurring)
}

/// Normalize payee name by removing dates, numbers, and common suffixes
fn normalize_payee(payee: &str) -> String {
    let mut normalized = payee.to_lowercase();

    // Remove common date patterns
    let date_patterns = [
        r"\d{1,2}/\d{1,2}/\d{2,4}",
        r"\d{1,2}-\d{1,2}-\d{2,4}",
        r"\d{4}-\d{2}-\d{2}",
        r"\d{6,}",  // Long number sequences (transaction IDs)
        r"#\d+",    // Reference numbers
        r"\*\d+",   // Card last 4 digits
    ];

    for pattern in date_patterns {
        if let Ok(re) = regex::Regex::new(pattern) {
            normalized = re.replace_all(&normalized, "").to_string();
        }
    }

    // Remove extra whitespace
    normalized = normalized.split_whitespace().collect::<Vec<_>>().join(" ");

    // Trim and return
    normalized.trim().to_string()
}

/// Detect frequency from a list of dates
fn detect_frequency(dates: &[chrono::NaiveDate]) -> Option<(String, i32)> {
    if dates.len() < 3 {
        return None;
    }

    let mut intervals: Vec<i64> = Vec::new();
    for i in 1..dates.len() {
        let diff = (dates[i] - dates[i - 1]).num_days();
        if diff > 0 {
            intervals.push(diff);
        }
    }

    if intervals.is_empty() {
        return None;
    }

    let avg_interval: f64 = intervals.iter().sum::<i64>() as f64 / intervals.len() as f64;

    // Determine frequency based on average interval
    if avg_interval >= 5.0 && avg_interval <= 9.0 {
        Some(("weekly".to_string(), 7))
    } else if avg_interval >= 12.0 && avg_interval <= 17.0 {
        Some(("biweekly".to_string(), 14))
    } else if avg_interval >= 25.0 && avg_interval <= 35.0 {
        Some(("monthly".to_string(), 30))
    } else if avg_interval >= 85.0 && avg_interval <= 100.0 {
        Some(("quarterly".to_string(), 91))
    } else if avg_interval >= 350.0 && avg_interval <= 380.0 {
        Some(("yearly".to_string(), 365))
    } else {
        None
    }
}

#[tauri::command]
pub fn detect_recurring_transactions(db: State<'_, Mutex<Database>>) -> Result<Vec<DetectedRecurring>> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    // Get transactions from the last year, excluding transfers
    let mut stmt = conn.prepare(
        "SELECT t.id, t.account_id, t.date, t.amount, t.payee, t.category_id, a.name as account_name
         FROM transactions t
         JOIN accounts a ON t.account_id = a.id
         WHERE t.deleted_at IS NULL
           AND t.transfer_id IS NULL
           AND t.payee IS NOT NULL
           AND t.payee != ''
           AND t.date >= date('now', '-365 days')
         ORDER BY t.payee, t.date"
    )?;

    struct TxData {
        id: String,
        account_id: String,
        date: String,
        amount: i64,
        payee: String,
        category_id: Option<String>,
        account_name: String,
    }

    let transactions: Vec<TxData> = stmt
        .query_map([], |row| {
            Ok(TxData {
                id: row.get(0)?,
                account_id: row.get(1)?,
                date: row.get(2)?,
                amount: row.get(3)?,
                payee: row.get(4)?,
                category_id: row.get(5)?,
                account_name: row.get(6)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    // Group by normalized payee + account + approximate amount
    let mut groups: HashMap<String, Vec<&TxData>> = HashMap::new();

    for tx in &transactions {
        let normalized = normalize_payee(&tx.payee);
        if normalized.len() < 3 {
            continue; // Skip very short payee names
        }

        // Create group key: normalized payee + account + amount bucket (within $5)
        let amount_bucket = (tx.amount.abs() / 500) * 500; // Round to nearest $5
        let key = format!("{}|{}|{}", normalized, tx.account_id, amount_bucket);

        groups.entry(key).or_default().push(tx);
    }

    let mut detected: Vec<DetectedRecurring> = Vec::new();

    for (_, txs) in groups {
        if txs.len() < 3 {
            continue; // Need at least 3 occurrences
        }

        // Parse dates and sort
        let mut dated_txs: Vec<(&TxData, chrono::NaiveDate)> = txs
            .iter()
            .filter_map(|tx| {
                chrono::NaiveDate::parse_from_str(&tx.date, "%Y-%m-%d")
                    .ok()
                    .map(|d| (*tx, d))
            })
            .collect();

        dated_txs.sort_by_key(|(_, d)| *d);

        if dated_txs.len() < 3 {
            continue;
        }

        let dates: Vec<chrono::NaiveDate> = dated_txs.iter().map(|(_, d)| *d).collect();

        // Detect frequency
        if let Some((frequency, freq_days)) = detect_frequency(&dates) {
            let first_tx = dated_txs.first().unwrap().0;
            let last_tx = dated_txs.last().unwrap().0;
            let last_date = dated_txs.last().unwrap().1;

            // Calculate average amount
            let total_amount: i64 = dated_txs.iter().map(|(tx, _)| tx.amount).sum();
            let avg_amount = total_amount / dated_txs.len() as i64;

            // Calculate next expected date
            let next_date = last_date + chrono::Duration::days(freq_days as i64);

            detected.push(DetectedRecurring {
                payee: first_tx.payee.clone(),
                normalized_payee: normalize_payee(&first_tx.payee),
                average_amount: avg_amount,
                frequency,
                frequency_days: freq_days,
                occurrences: dated_txs.len() as i32,
                last_date: last_tx.date.clone(),
                next_expected_date: next_date.format("%Y-%m-%d").to_string(),
                account_id: first_tx.account_id.clone(),
                account_name: first_tx.account_name.clone(),
                category_id: first_tx.category_id.clone(),
                transactions: dated_txs.iter().map(|(tx, _)| TransactionSummary {
                    id: tx.id.clone(),
                    date: tx.date.clone(),
                    amount: tx.amount,
                }).collect(),
            });
        }
    }

    // Sort by next expected date
    detected.sort_by(|a, b| a.next_expected_date.cmp(&b.next_expected_date));

    Ok(detected)
}

#[tauri::command]
pub fn create_recurring_transaction(
    data: serde_json::Value,
    db: State<'_, Mutex<Database>>,
) -> Result<RecurringTransaction> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO recurring_transactions (id, account_id, payee, amount, category_id, frequency,
                start_date, end_date, next_expected_date, tolerance_days, tolerance_amount,
                is_auto_detected, is_active, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 1, ?13, ?14)",
        rusqlite::params![
            id,
            data["accountId"].as_str().unwrap_or(""),
            data["payee"].as_str().unwrap_or(""),
            data["amount"].as_i64().unwrap_or(0),
            data["categoryId"].as_str(),
            data["frequency"].as_str().unwrap_or("monthly"),
            data["startDate"].as_str().unwrap_or(""),
            data["endDate"].as_str(),
            data["nextExpectedDate"].as_str(),
            data["toleranceDays"].as_i64().unwrap_or(3) as i32,
            data["toleranceAmount"].as_i64().unwrap_or(0),
            data["isAutoDetected"].as_bool().unwrap_or(false),
            now,
            now,
        ],
    )?;

    conn.query_row(
        "SELECT id, account_id, payee, amount, category_id, frequency, start_date, end_date,
                next_expected_date, last_matched_transaction_id, tolerance_days, tolerance_amount,
                is_auto_detected, is_active, created_at, updated_at
         FROM recurring_transactions WHERE id = ?1",
        [&id],
        |row| {
            Ok(RecurringTransaction {
                id: row.get(0)?,
                account_id: row.get(1)?,
                payee: row.get(2)?,
                amount: row.get(3)?,
                category_id: row.get(4)?,
                frequency: row.get(5)?,
                start_date: row.get(6)?,
                end_date: row.get(7)?,
                next_expected_date: row.get(8)?,
                last_matched_transaction_id: row.get(9)?,
                tolerance_days: row.get(10)?,
                tolerance_amount: row.get(11)?,
                is_auto_detected: row.get(12)?,
                is_active: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        },
    )
    .map_err(|e| e.into())
}

#[tauri::command]
pub fn update_recurring_transaction(
    id: String,
    data: serde_json::Value,
    db: State<'_, Mutex<Database>>,
) -> Result<RecurringTransaction> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE recurring_transactions SET
            payee = COALESCE(?1, payee),
            amount = COALESCE(?2, amount),
            category_id = ?3,
            frequency = COALESCE(?4, frequency),
            next_expected_date = ?5,
            end_date = ?6,
            is_active = COALESCE(?7, is_active),
            updated_at = ?8
         WHERE id = ?9",
        rusqlite::params![
            data["payee"].as_str(),
            data["amount"].as_i64(),
            data["categoryId"].as_str(),
            data["frequency"].as_str(),
            data["nextExpectedDate"].as_str(),
            data["endDate"].as_str(),
            data["isActive"].as_bool(),
            now,
            id,
        ],
    )?;

    conn.query_row(
        "SELECT id, account_id, payee, amount, category_id, frequency, start_date, end_date,
                next_expected_date, last_matched_transaction_id, tolerance_days, tolerance_amount,
                is_auto_detected, is_active, created_at, updated_at
         FROM recurring_transactions WHERE id = ?1",
        [&id],
        |row| {
            Ok(RecurringTransaction {
                id: row.get(0)?,
                account_id: row.get(1)?,
                payee: row.get(2)?,
                amount: row.get(3)?,
                category_id: row.get(4)?,
                frequency: row.get(5)?,
                start_date: row.get(6)?,
                end_date: row.get(7)?,
                next_expected_date: row.get(8)?,
                last_matched_transaction_id: row.get(9)?,
                tolerance_days: row.get(10)?,
                tolerance_amount: row.get(11)?,
                is_auto_detected: row.get(12)?,
                is_active: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        },
    )
    .map_err(|e| e.into())
}

#[tauri::command]
pub fn delete_recurring_transaction(id: String, db: State<'_, Mutex<Database>>) -> Result<()> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    conn.execute("DELETE FROM recurring_transactions WHERE id = ?1", [&id])?;

    Ok(())
}
