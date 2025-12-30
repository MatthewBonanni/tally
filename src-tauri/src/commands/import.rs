use crate::db::Database;
use crate::error::Result;
use crate::import::csv_parser::{self, ColumnMapping, CsvPreview, ParsedTransaction};
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

    for tx in transactions {
        let date = tx["date"].as_str().unwrap_or("");
        let amount = tx["amount"].as_i64().unwrap_or(0);
        let payee = tx["payee"].as_str();
        let memo = tx["memo"].as_str();
        let category_id = tx["categoryId"].as_str();

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
                category_id,
                batch_id,
                now,
            ],
        )?;
        imported += 1;
    }

    // Update account balance
    update_account_balance(conn, &account_id)?;

    Ok(ImportResult {
        imported,
        skipped,
        batch_id,
    })
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
    pub batch_id: String,
}
