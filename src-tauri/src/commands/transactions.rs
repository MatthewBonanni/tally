use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{Transaction, TransactionFilters, TransferCandidate};
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn list_transactions(
    filters: Option<TransactionFilters>,
    db: State<'_, Mutex<Database>>,
) -> Result<Vec<Transaction>> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let mut query = String::from(
        "SELECT id, account_id, date, posted_date, amount, payee, original_payee,
                category_id, notes, memo, check_number, transaction_type, status,
                is_recurring, recurring_transaction_id, transfer_id, transfer_account_id,
                import_id, import_source, import_batch_id, is_split, parent_transaction_id,
                created_at, updated_at
         FROM transactions
         WHERE deleted_at IS NULL"
    );

    let mut params: Vec<String> = vec![];

    if let Some(ref f) = filters {
        if let Some(ref account_id) = f.account_id {
            query.push_str(" AND account_id = ?");
            params.push(account_id.clone());
        }
        if let Some(ref category_id) = f.category_id {
            query.push_str(" AND category_id = ?");
            params.push(category_id.clone());
        }
        if let Some(ref start_date) = f.start_date {
            query.push_str(" AND date >= ?");
            params.push(start_date.clone());
        }
        if let Some(ref end_date) = f.end_date {
            query.push_str(" AND date <= ?");
            params.push(end_date.clone());
        }
        if let Some(ref search) = f.search_query {
            if !search.is_empty() {
                query.push_str(" AND (payee LIKE ? OR notes LIKE ? OR memo LIKE ?)");
                let pattern = format!("%{}%", search);
                params.push(pattern.clone());
                params.push(pattern.clone());
                params.push(pattern);
            }
        }
    }

    query.push_str(" ORDER BY date DESC, created_at DESC LIMIT 1000");

    let mut stmt = conn.prepare(&query)?;

    let transactions = stmt
        .query_map(rusqlite::params_from_iter(params.iter()), |row| {
            Ok(Transaction {
                id: row.get(0)?,
                account_id: row.get(1)?,
                date: row.get(2)?,
                posted_date: row.get(3)?,
                amount: row.get(4)?,
                payee: row.get(5)?,
                original_payee: row.get(6)?,
                category_id: row.get(7)?,
                notes: row.get(8)?,
                memo: row.get(9)?,
                check_number: row.get(10)?,
                transaction_type: row.get(11)?,
                status: row.get(12)?,
                is_recurring: row.get(13)?,
                recurring_transaction_id: row.get(14)?,
                transfer_id: row.get(15)?,
                transfer_account_id: row.get(16)?,
                import_id: row.get(17)?,
                import_source: row.get(18)?,
                import_batch_id: row.get(19)?,
                is_split: row.get(20)?,
                parent_transaction_id: row.get(21)?,
                created_at: row.get(22)?,
                updated_at: row.get(23)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(transactions)
}

#[tauri::command]
pub fn get_transaction(id: String, db: State<'_, Mutex<Database>>) -> Result<Transaction> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    conn.query_row(
        "SELECT id, account_id, date, posted_date, amount, payee, original_payee,
                category_id, notes, memo, check_number, transaction_type, status,
                is_recurring, recurring_transaction_id, transfer_id, transfer_account_id,
                import_id, import_source, import_batch_id, is_split, parent_transaction_id,
                created_at, updated_at
         FROM transactions
         WHERE id = ?1 AND deleted_at IS NULL",
        [&id],
        |row| {
            Ok(Transaction {
                id: row.get(0)?,
                account_id: row.get(1)?,
                date: row.get(2)?,
                posted_date: row.get(3)?,
                amount: row.get(4)?,
                payee: row.get(5)?,
                original_payee: row.get(6)?,
                category_id: row.get(7)?,
                notes: row.get(8)?,
                memo: row.get(9)?,
                check_number: row.get(10)?,
                transaction_type: row.get(11)?,
                status: row.get(12)?,
                is_recurring: row.get(13)?,
                recurring_transaction_id: row.get(14)?,
                transfer_id: row.get(15)?,
                transfer_account_id: row.get(16)?,
                import_id: row.get(17)?,
                import_source: row.get(18)?,
                import_batch_id: row.get(19)?,
                is_split: row.get(20)?,
                parent_transaction_id: row.get(21)?,
                created_at: row.get(22)?,
                updated_at: row.get(23)?,
            })
        },
    )
    .map_err(|_| AppError::NotFound("Transaction not found".to_string()))
}

#[tauri::command]
pub fn create_transaction(
    data: serde_json::Value,
    db: State<'_, Mutex<Database>>,
) -> Result<Transaction> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO transactions (
            id, account_id, date, posted_date, amount, payee, original_payee,
            category_id, notes, memo, check_number, transaction_type, status,
            is_recurring, recurring_transaction_id, transfer_id, transfer_account_id,
            import_id, import_source, import_batch_id, is_split, parent_transaction_id,
            created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24)",
        rusqlite::params![
            id,
            data["accountId"].as_str().unwrap_or(""),
            data["date"].as_str().unwrap_or(""),
            data["postedDate"].as_str(),
            data["amount"].as_i64().unwrap_or(0),
            data["payee"].as_str(),
            data["originalPayee"].as_str(),
            data["categoryId"].as_str(),
            data["notes"].as_str(),
            data["memo"].as_str(),
            data["checkNumber"].as_str(),
            data["transactionType"].as_str(),
            data["status"].as_str().unwrap_or("cleared"),
            data["isRecurring"].as_bool().unwrap_or(false),
            data["recurringTransactionId"].as_str(),
            data["transferId"].as_str(),
            data["transferAccountId"].as_str(),
            data["importId"].as_str(),
            data["importSource"].as_str(),
            data["importBatchId"].as_str(),
            data["isSplit"].as_bool().unwrap_or(false),
            data["parentTransactionId"].as_str(),
            now,
            now,
        ],
    )?;

    // Update account balance
    let amount = data["amount"].as_i64().unwrap_or(0);
    let account_id = data["accountId"].as_str().unwrap_or("");

    conn.execute(
        "UPDATE accounts SET current_balance = current_balance + ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![amount, now, account_id],
    )?;

    drop(database);
    get_transaction(id, db)
}

#[tauri::command]
pub fn update_transaction(
    id: String,
    data: serde_json::Value,
    db: State<'_, Mutex<Database>>,
) -> Result<Transaction> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let now = chrono::Utc::now().to_rfc3339();

    // Get old amount for balance adjustment
    let old_amount: i64 = conn.query_row(
        "SELECT amount FROM transactions WHERE id = ?1",
        [&id],
        |row| row.get(0),
    )?;

    conn.execute(
        "UPDATE transactions SET
            date = COALESCE(?1, date),
            amount = COALESCE(?2, amount),
            payee = COALESCE(?3, payee),
            category_id = ?4,
            notes = ?5,
            status = COALESCE(?6, status),
            updated_at = ?7
         WHERE id = ?8",
        rusqlite::params![
            data["date"].as_str(),
            data["amount"].as_i64(),
            data["payee"].as_str(),
            data["categoryId"].as_str(),
            data["notes"].as_str(),
            data["status"].as_str(),
            now,
            id,
        ],
    )?;

    // Adjust account balance if amount changed
    if let Some(new_amount) = data["amount"].as_i64() {
        let diff = new_amount - old_amount;
        if diff != 0 {
            let account_id: String = conn.query_row(
                "SELECT account_id FROM transactions WHERE id = ?1",
                [&id],
                |row| row.get(0),
            )?;

            conn.execute(
                "UPDATE accounts SET current_balance = current_balance + ?1, updated_at = ?2 WHERE id = ?3",
                rusqlite::params![diff, now, account_id],
            )?;
        }
    }

    drop(database);
    get_transaction(id, db)
}

#[tauri::command]
pub fn delete_transactions(ids: Vec<String>, db: State<'_, Mutex<Database>>) -> Result<()> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let now = chrono::Utc::now().to_rfc3339();

    for id in ids {
        // Get transaction for balance adjustment
        let (account_id, amount): (String, i64) = conn.query_row(
            "SELECT account_id, amount FROM transactions WHERE id = ?1",
            [&id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;

        // Soft delete
        conn.execute(
            "UPDATE transactions SET deleted_at = ?1 WHERE id = ?2",
            [&now, &id],
        )?;

        // Reverse balance
        conn.execute(
            "UPDATE accounts SET current_balance = current_balance - ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![amount, now, account_id],
        )?;
    }

    Ok(())
}

#[tauri::command]
pub fn bulk_categorize(
    ids: Vec<String>,
    category_id: String,
    db: State<'_, Mutex<Database>>,
) -> Result<()> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let now = chrono::Utc::now().to_rfc3339();

    for id in ids {
        conn.execute(
            "UPDATE transactions SET category_id = ?1, updated_at = ?2 WHERE id = ?3",
            [&category_id, &now, &id],
        )?;
    }

    Ok(())
}

#[tauri::command]
pub fn detect_transfers(db: State<'_, Mutex<Database>>) -> Result<Vec<TransferCandidate>> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    // Get unlinked transactions from the last 90 days
    let mut stmt = conn.prepare(
        "SELECT id, account_id, date, posted_date, amount, payee, original_payee,
                category_id, notes, memo, check_number, transaction_type, status,
                is_recurring, recurring_transaction_id, transfer_id, transfer_account_id,
                import_id, import_source, import_batch_id, is_split, parent_transaction_id,
                created_at, updated_at
         FROM transactions
         WHERE deleted_at IS NULL
           AND transfer_id IS NULL
           AND date >= date('now', '-90 days')
         ORDER BY date DESC"
    )?;

    let transactions: Vec<Transaction> = stmt
        .query_map([], |row| {
            Ok(Transaction {
                id: row.get(0)?,
                account_id: row.get(1)?,
                date: row.get(2)?,
                posted_date: row.get(3)?,
                amount: row.get(4)?,
                payee: row.get(5)?,
                original_payee: row.get(6)?,
                category_id: row.get(7)?,
                notes: row.get(8)?,
                memo: row.get(9)?,
                check_number: row.get(10)?,
                transaction_type: row.get(11)?,
                status: row.get(12)?,
                is_recurring: row.get(13)?,
                recurring_transaction_id: row.get(14)?,
                transfer_id: row.get(15)?,
                transfer_account_id: row.get(16)?,
                import_id: row.get(17)?,
                import_source: row.get(18)?,
                import_batch_id: row.get(19)?,
                is_split: row.get(20)?,
                parent_transaction_id: row.get(21)?,
                created_at: row.get(22)?,
                updated_at: row.get(23)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    let mut candidates = Vec::new();

    for (i, tx_a) in transactions.iter().enumerate() {
        for tx_b in transactions.iter().skip(i + 1) {
            // Different accounts
            if tx_a.account_id == tx_b.account_id {
                continue;
            }

            // Opposite amounts
            if tx_a.amount != -tx_b.amount {
                continue;
            }

            // Within 5 days
            let date_a = chrono::NaiveDate::parse_from_str(&tx_a.date, "%Y-%m-%d");
            let date_b = chrono::NaiveDate::parse_from_str(&tx_b.date, "%Y-%m-%d");

            if let (Ok(a), Ok(b)) = (date_a, date_b) {
                let days_diff = (a - b).num_days().abs();
                if days_diff > 5 {
                    continue;
                }

                // Calculate confidence
                let date_score = 1.0 - (days_diff as f64 / 5.0);
                let payee_score = calculate_payee_similarity(&tx_a.payee, &tx_b.payee);
                let confidence = date_score * 0.6 + payee_score * 0.4;

                if confidence > 0.5 {
                    candidates.push(TransferCandidate {
                        transaction_a: tx_a.clone(),
                        transaction_b: tx_b.clone(),
                        confidence,
                    });
                }
            }
        }
    }

    candidates.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap_or(std::cmp::Ordering::Equal));

    Ok(candidates.into_iter().take(20).collect())
}

fn calculate_payee_similarity(payee_a: &Option<String>, payee_b: &Option<String>) -> f64 {
    let transfer_keywords = ["transfer", "xfer", "payment", "ach", "wire", "zelle", "venmo"];

    match (payee_a, payee_b) {
        (Some(a), Some(b)) => {
            let a_lower = a.to_lowercase();
            let b_lower = b.to_lowercase();

            let a_has = transfer_keywords.iter().any(|k| a_lower.contains(k));
            let b_has = transfer_keywords.iter().any(|k| b_lower.contains(k));

            if a_has && b_has {
                0.8
            } else if a_has || b_has {
                0.5
            } else {
                0.3
            }
        }
        _ => 0.3,
    }
}

#[tauri::command]
pub fn link_transfer(
    transaction_a_id: String,
    transaction_b_id: String,
    db: State<'_, Mutex<Database>>,
) -> Result<()> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let transfer_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    // Get account IDs
    let account_a: String = conn.query_row(
        "SELECT account_id FROM transactions WHERE id = ?1",
        [&transaction_a_id],
        |row| row.get(0),
    )?;

    let account_b: String = conn.query_row(
        "SELECT account_id FROM transactions WHERE id = ?1",
        [&transaction_b_id],
        |row| row.get(0),
    )?;

    // Update transaction A
    conn.execute(
        "UPDATE transactions SET transfer_id = ?1, transfer_account_id = ?2, updated_at = ?3 WHERE id = ?4",
        rusqlite::params![transfer_id, account_b, now, transaction_a_id],
    )?;

    // Update transaction B
    conn.execute(
        "UPDATE transactions SET transfer_id = ?1, transfer_account_id = ?2, updated_at = ?3 WHERE id = ?4",
        rusqlite::params![transfer_id, account_a, now, transaction_b_id],
    )?;

    Ok(())
}

#[tauri::command]
pub fn unlink_transfer(transaction_id: String, db: State<'_, Mutex<Database>>) -> Result<()> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    // Get the transfer_id
    let transfer_id: Option<String> = conn.query_row(
        "SELECT transfer_id FROM transactions WHERE id = ?1",
        [&transaction_id],
        |row| row.get(0),
    )?;

    if let Some(tid) = transfer_id {
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "UPDATE transactions SET transfer_id = NULL, transfer_account_id = NULL, updated_at = ?1 WHERE transfer_id = ?2",
            [&now, &tid],
        )?;
    }

    Ok(())
}
