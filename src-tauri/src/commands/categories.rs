use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::Category;
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn list_categories(db: State<'_, Mutex<Database>>) -> Result<Vec<Category>> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let mut stmt = conn.prepare(
        "SELECT id, name, parent_id, category_type, icon, color, is_system, display_order, created_at, updated_at
         FROM categories
         WHERE deleted_at IS NULL
         ORDER BY display_order, name"
    )?;

    let categories = stmt
        .query_map([], |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                parent_id: row.get(2)?,
                category_type: row.get(3)?,
                icon: row.get(4)?,
                color: row.get(5)?,
                is_system: row.get(6)?,
                display_order: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(categories)
}

#[tauri::command]
pub fn create_category(
    data: serde_json::Value,
    db: State<'_, Mutex<Database>>,
) -> Result<Category> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO categories (id, name, parent_id, category_type, icon, color, is_system, display_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?8, ?9)",
        rusqlite::params![
            id,
            data["name"].as_str().unwrap_or(""),
            data["parentId"].as_str(),
            data["categoryType"].as_str().unwrap_or("expense"),
            data["icon"].as_str(),
            data["color"].as_str(),
            data["displayOrder"].as_i64().unwrap_or(0) as i32,
            now,
            now,
        ],
    )?;

    conn.query_row(
        "SELECT id, name, parent_id, category_type, icon, color, is_system, display_order, created_at, updated_at
         FROM categories WHERE id = ?1",
        [&id],
        |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                parent_id: row.get(2)?,
                category_type: row.get(3)?,
                icon: row.get(4)?,
                color: row.get(5)?,
                is_system: row.get(6)?,
                display_order: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        },
    )
    .map_err(|e| e.into())
}

#[tauri::command]
pub fn update_category(
    id: String,
    data: serde_json::Value,
    db: State<'_, Mutex<Database>>,
) -> Result<Category> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE categories SET
            name = COALESCE(?1, name),
            parent_id = ?2,
            icon = ?3,
            color = ?4,
            updated_at = ?5
         WHERE id = ?6 AND is_system = 0",
        rusqlite::params![
            data["name"].as_str(),
            data["parentId"].as_str(),
            data["icon"].as_str(),
            data["color"].as_str(),
            now,
            id,
        ],
    )?;

    conn.query_row(
        "SELECT id, name, parent_id, category_type, icon, color, is_system, display_order, created_at, updated_at
         FROM categories WHERE id = ?1",
        [&id],
        |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                parent_id: row.get(2)?,
                category_type: row.get(3)?,
                icon: row.get(4)?,
                color: row.get(5)?,
                is_system: row.get(6)?,
                display_order: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        },
    )
    .map_err(|e| e.into())
}

#[tauri::command]
pub fn delete_category(id: String, db: State<'_, Mutex<Database>>) -> Result<()> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    // Check if it's a system category
    let is_system: bool = conn.query_row(
        "SELECT is_system FROM categories WHERE id = ?1",
        [&id],
        |row| row.get(0),
    )?;

    if is_system {
        return Err(AppError::Validation("Cannot delete system category".to_string()));
    }

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE categories SET deleted_at = ?1 WHERE id = ?2",
        [&now, &id],
    )?;

    Ok(())
}
