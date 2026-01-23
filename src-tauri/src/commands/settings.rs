use crate::config::AppConfig;
use crate::db::Database;
use crate::error::Result;
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn unlock_database(
    password: String,
    db: State<'_, Mutex<Database>>,
) -> Result<bool> {
    let mut database = db.lock().unwrap();
    database.unlock(&password)
}

#[tauri::command]
pub fn change_password(
    current_password: String,
    new_password: String,
    db: State<'_, Mutex<Database>>,
) -> Result<bool> {
    let mut database = db.lock().unwrap();
    database.change_password(&current_password, &new_password)
}

#[tauri::command]
pub fn is_unlocked(db: State<'_, Mutex<Database>>) -> bool {
    db.lock().unwrap().is_unlocked()
}

#[tauri::command]
pub fn get_setting(
    key: String,
    db: State<'_, Mutex<Database>>,
) -> Result<Option<String>> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let result = conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        [&key],
        |row| row.get::<_, String>(0),
    );

    match result {
        Ok(value) => Ok(Some(value)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

#[tauri::command]
pub fn set_setting(
    key: String,
    value: String,
    db: State<'_, Mutex<Database>>,
) -> Result<()> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?1, ?2, datetime('now'))",
        [&key, &value],
    )?;

    Ok(())
}

#[tauri::command]
pub fn export_to_json(db: State<'_, Mutex<Database>>) -> Result<String> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    // Export all data as JSON
    let mut export = serde_json::Map::new();

    // Export accounts
    let mut stmt = conn.prepare("SELECT * FROM accounts WHERE deleted_at IS NULL")?;
    let accounts: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "name": row.get::<_, String>(1)?,
                "account_type": row.get::<_, String>(2)?,
                "current_balance": row.get::<_, i64>(6)?,
            }))
        })?
        .filter_map(|r| r.ok())
        .collect();
    export.insert("accounts".to_string(), serde_json::Value::Array(accounts));

    // Export transactions
    let mut stmt = conn.prepare("SELECT * FROM transactions WHERE deleted_at IS NULL")?;
    let transactions: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "account_id": row.get::<_, String>(1)?,
                "date": row.get::<_, String>(2)?,
                "amount": row.get::<_, i64>(4)?,
                "payee": row.get::<_, Option<String>>(5)?,
            }))
        })?
        .filter_map(|r| r.ok())
        .collect();
    export.insert("transactions".to_string(), serde_json::Value::Array(transactions));

    // Export categories
    let mut stmt = conn.prepare("SELECT * FROM categories WHERE deleted_at IS NULL")?;
    let categories: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "name": row.get::<_, String>(1)?,
                "category_type": row.get::<_, String>(3)?,
            }))
        })?
        .filter_map(|r| r.ok())
        .collect();
    export.insert("categories".to_string(), serde_json::Value::Array(categories));

    Ok(serde_json::to_string_pretty(&export)?)
}

#[tauri::command]
pub fn database_exists(db: State<'_, Mutex<Database>>) -> bool {
    let database = db.lock().unwrap();
    database.get_db_path().exists()
}

#[tauri::command]
pub fn get_database_path(db: State<'_, Mutex<Database>>) -> String {
    let database = db.lock().unwrap();
    database.get_db_path().to_string_lossy().to_string()
}

#[tauri::command]
pub fn get_default_database_path() -> String {
    AppConfig::default_db_path().to_string_lossy().to_string()
}

#[tauri::command]
pub fn set_database_path(
    path: Option<String>,
    db: State<'_, Mutex<Database>>,
) -> Result<String> {
    // Update config
    let mut config = AppConfig::load();
    config.set_db_path(path);
    config.save()?;

    // Reload database with new path
    let mut database = db.lock().unwrap();
    database.reload_config();

    Ok(database.get_db_path().to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_database(db: State<'_, Mutex<Database>>) -> Result<()> {
    let mut database = db.lock().unwrap();
    database.delete_database()
}
