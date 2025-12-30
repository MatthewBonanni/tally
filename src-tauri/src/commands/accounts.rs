use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::Account;
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

fn fetch_account(conn: &Connection, id: &str) -> Result<Account> {
    conn.query_row(
        "SELECT id, name, account_type, institution_id, account_number_masked, currency,
                current_balance, available_balance, credit_limit, interest_rate,
                is_active, is_hidden, display_order, ofx_account_id, last_sync_at,
                notes, created_at, updated_at
         FROM accounts
         WHERE id = ?1 AND deleted_at IS NULL",
        [id],
        |row| {
            Ok(Account {
                id: row.get(0)?,
                name: row.get(1)?,
                account_type: row.get(2)?,
                institution_id: row.get(3)?,
                account_number_masked: row.get(4)?,
                currency: row.get(5)?,
                current_balance: row.get(6)?,
                available_balance: row.get(7)?,
                credit_limit: row.get(8)?,
                interest_rate: row.get(9)?,
                is_active: row.get(10)?,
                is_hidden: row.get(11)?,
                display_order: row.get(12)?,
                ofx_account_id: row.get(13)?,
                last_sync_at: row.get(14)?,
                notes: row.get(15)?,
                created_at: row.get(16)?,
                updated_at: row.get(17)?,
            })
        },
    )
    .map_err(|_| AppError::NotFound("Account not found".to_string()))
}

#[tauri::command]
pub fn list_accounts(db: State<'_, Mutex<Database>>) -> Result<Vec<Account>> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let mut stmt = conn.prepare(
        "SELECT id, name, account_type, institution_id, account_number_masked, currency,
                current_balance, available_balance, credit_limit, interest_rate,
                is_active, is_hidden, display_order, ofx_account_id, last_sync_at,
                notes, created_at, updated_at
         FROM accounts
         WHERE deleted_at IS NULL
         ORDER BY display_order, name"
    )?;

    let accounts = stmt
        .query_map([], |row| {
            Ok(Account {
                id: row.get(0)?,
                name: row.get(1)?,
                account_type: row.get(2)?,
                institution_id: row.get(3)?,
                account_number_masked: row.get(4)?,
                currency: row.get(5)?,
                current_balance: row.get(6)?,
                available_balance: row.get(7)?,
                credit_limit: row.get(8)?,
                interest_rate: row.get(9)?,
                is_active: row.get(10)?,
                is_hidden: row.get(11)?,
                display_order: row.get(12)?,
                ofx_account_id: row.get(13)?,
                last_sync_at: row.get(14)?,
                notes: row.get(15)?,
                created_at: row.get(16)?,
                updated_at: row.get(17)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(accounts)
}

#[tauri::command]
pub fn get_account(id: String, db: State<'_, Mutex<Database>>) -> Result<Account> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;
    fetch_account(conn, &id)
}

#[tauri::command]
pub fn create_account(
    data: serde_json::Value,
    db: State<'_, Mutex<Database>>,
) -> Result<Account> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO accounts (
            id, name, account_type, institution_id, account_number_masked, currency,
            current_balance, available_balance, credit_limit, interest_rate,
            is_active, is_hidden, display_order, ofx_account_id, last_sync_at,
            notes, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
        rusqlite::params![
            id,
            data["name"].as_str().unwrap_or(""),
            data["accountType"].as_str().unwrap_or("checking"),
            data["institutionId"].as_str(),
            data["accountNumberMasked"].as_str(),
            data["currency"].as_str().unwrap_or("USD"),
            data["currentBalance"].as_i64().unwrap_or(0),
            data["availableBalance"].as_i64(),
            data["creditLimit"].as_i64(),
            data["interestRate"].as_f64(),
            data["isActive"].as_bool().unwrap_or(true),
            data["isHidden"].as_bool().unwrap_or(false),
            data["displayOrder"].as_i64().unwrap_or(0) as i32,
            data["ofxAccountId"].as_str(),
            data["lastSyncAt"].as_str(),
            data["notes"].as_str(),
            now,
            now,
        ],
    )?;

    fetch_account(conn, &id)
}

#[tauri::command]
pub fn update_account(
    id: String,
    data: serde_json::Value,
    db: State<'_, Mutex<Database>>,
) -> Result<Account> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE accounts SET
            name = COALESCE(?1, name),
            account_type = COALESCE(?2, account_type),
            current_balance = COALESCE(?3, current_balance),
            is_active = COALESCE(?4, is_active),
            is_hidden = COALESCE(?5, is_hidden),
            notes = COALESCE(?6, notes),
            updated_at = ?7
         WHERE id = ?8",
        rusqlite::params![
            data["name"].as_str(),
            data["accountType"].as_str(),
            data["currentBalance"].as_i64(),
            data["isActive"].as_bool(),
            data["isHidden"].as_bool(),
            data["notes"].as_str(),
            now,
            id,
        ],
    )?;

    fetch_account(conn, &id)
}

#[tauri::command]
pub fn delete_account(id: String, db: State<'_, Mutex<Database>>) -> Result<()> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE accounts SET deleted_at = ?1 WHERE id = ?2",
        [&now, &id],
    )?;

    Ok(())
}
