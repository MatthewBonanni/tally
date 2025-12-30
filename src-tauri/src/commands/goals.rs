use crate::db::Database;
use crate::error::Result;
use crate::models::Goal;
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn list_goals(db: State<'_, Mutex<Database>>) -> Result<Vec<Goal>> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let mut stmt = conn.prepare(
        "SELECT id, name, goal_type, target_amount, current_amount, target_date,
                linked_account_id, icon, color, is_achieved, achieved_at, created_at, updated_at
         FROM goals
         WHERE deleted_at IS NULL
         ORDER BY is_achieved ASC, target_date ASC NULLS LAST, created_at DESC"
    )?;

    let goals = stmt
        .query_map([], |row| {
            Ok(Goal {
                id: row.get(0)?,
                name: row.get(1)?,
                goal_type: row.get(2)?,
                target_amount: row.get(3)?,
                current_amount: row.get(4)?,
                target_date: row.get(5)?,
                linked_account_id: row.get(6)?,
                icon: row.get(7)?,
                color: row.get(8)?,
                is_achieved: row.get(9)?,
                achieved_at: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(goals)
}

#[tauri::command]
pub fn create_goal(
    data: serde_json::Value,
    db: State<'_, Mutex<Database>>,
) -> Result<Goal> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO goals (id, name, goal_type, target_amount, current_amount, target_date,
                           linked_account_id, icon, color, is_achieved, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0, ?10, ?11)",
        rusqlite::params![
            id,
            data["name"].as_str().unwrap_or(""),
            data["goalType"].as_str().unwrap_or("savings"),
            data["targetAmount"].as_i64().unwrap_or(0),
            data["currentAmount"].as_i64().unwrap_or(0),
            data["targetDate"].as_str(),
            data["linkedAccountId"].as_str(),
            data["icon"].as_str(),
            data["color"].as_str(),
            now,
            now,
        ],
    )?;

    conn.query_row(
        "SELECT id, name, goal_type, target_amount, current_amount, target_date,
                linked_account_id, icon, color, is_achieved, achieved_at, created_at, updated_at
         FROM goals WHERE id = ?1",
        [&id],
        |row| {
            Ok(Goal {
                id: row.get(0)?,
                name: row.get(1)?,
                goal_type: row.get(2)?,
                target_amount: row.get(3)?,
                current_amount: row.get(4)?,
                target_date: row.get(5)?,
                linked_account_id: row.get(6)?,
                icon: row.get(7)?,
                color: row.get(8)?,
                is_achieved: row.get(9)?,
                achieved_at: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        },
    )
    .map_err(|e| e.into())
}

#[tauri::command]
pub fn update_goal(
    id: String,
    data: serde_json::Value,
    db: State<'_, Mutex<Database>>,
) -> Result<Goal> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE goals SET
            name = COALESCE(?1, name),
            goal_type = COALESCE(?2, goal_type),
            target_amount = COALESCE(?3, target_amount),
            current_amount = COALESCE(?4, current_amount),
            target_date = ?5,
            linked_account_id = ?6,
            icon = ?7,
            color = ?8,
            updated_at = ?9
         WHERE id = ?10 AND deleted_at IS NULL",
        rusqlite::params![
            data["name"].as_str(),
            data["goalType"].as_str(),
            data["targetAmount"].as_i64(),
            data["currentAmount"].as_i64(),
            data["targetDate"].as_str(),
            data["linkedAccountId"].as_str(),
            data["icon"].as_str(),
            data["color"].as_str(),
            now,
            id,
        ],
    )?;

    conn.query_row(
        "SELECT id, name, goal_type, target_amount, current_amount, target_date,
                linked_account_id, icon, color, is_achieved, achieved_at, created_at, updated_at
         FROM goals WHERE id = ?1",
        [&id],
        |row| {
            Ok(Goal {
                id: row.get(0)?,
                name: row.get(1)?,
                goal_type: row.get(2)?,
                target_amount: row.get(3)?,
                current_amount: row.get(4)?,
                target_date: row.get(5)?,
                linked_account_id: row.get(6)?,
                icon: row.get(7)?,
                color: row.get(8)?,
                is_achieved: row.get(9)?,
                achieved_at: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        },
    )
    .map_err(|e| e.into())
}

#[tauri::command]
pub fn delete_goal(id: String, db: State<'_, Mutex<Database>>) -> Result<()> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE goals SET deleted_at = ?1 WHERE id = ?2",
        [&now, &id],
    )?;

    Ok(())
}

#[tauri::command]
pub fn contribute_to_goal(
    goal_id: String,
    amount: i64,
    transaction_id: Option<String>,
    db: State<'_, Mutex<Database>>,
) -> Result<()> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();

    // Insert contribution
    conn.execute(
        "INSERT INTO goal_contributions (id, goal_id, amount, date, transaction_id, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![id, goal_id, amount, today, transaction_id, now],
    )?;

    // Update goal current_amount
    conn.execute(
        "UPDATE goals SET
            current_amount = current_amount + ?1,
            updated_at = ?2
         WHERE id = ?3",
        rusqlite::params![amount, now, goal_id],
    )?;

    // Check if goal is achieved
    let (current, target): (i64, i64) = conn.query_row(
        "SELECT current_amount, target_amount FROM goals WHERE id = ?1",
        [&goal_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;

    if current >= target {
        conn.execute(
            "UPDATE goals SET is_achieved = 1, achieved_at = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![now, now, goal_id],
        )?;
    }

    Ok(())
}
