use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{Budget, Category};
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetSummary {
    pub budget: Budget,
    pub category: Category,
    pub spent: i64,
    pub remaining: i64,
}

#[tauri::command]
pub fn list_budgets(db: State<'_, Mutex<Database>>) -> Result<Vec<Budget>> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let mut stmt = conn.prepare(
        "SELECT id, category_id, period_type, amount, rollover, created_at, updated_at
         FROM budgets
         ORDER BY created_at DESC"
    )?;

    let budgets = stmt
        .query_map([], |row| {
            Ok(Budget {
                id: row.get(0)?,
                category_id: row.get(1)?,
                period_type: row.get(2)?,
                amount: row.get(3)?,
                rollover: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(budgets)
}

#[tauri::command]
pub fn get_budget_summary(month: String, db: State<'_, Mutex<Database>>) -> Result<Vec<BudgetSummary>> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    // Parse month string (YYYY-MM format)
    let parts: Vec<&str> = month.split('-').collect();
    if parts.len() != 2 {
        return Err(AppError::Validation("Invalid month format. Use YYYY-MM".to_string()));
    }
    let year: i32 = parts[0].parse().map_err(|_| AppError::Validation("Invalid year".to_string()))?;
    let month_num: u32 = parts[1].parse().map_err(|_| AppError::Validation("Invalid month".to_string()))?;

    // Calculate month boundaries
    let start_date = format!("{:04}-{:02}-01", year, month_num);
    let end_date = if month_num == 12 {
        format!("{:04}-01-01", year + 1)
    } else {
        format!("{:04}-{:02}-01", year, month_num + 1)
    };

    // Get all budgets with their categories
    let mut stmt = conn.prepare(
        "SELECT b.id, b.category_id, b.period_type, b.amount, b.rollover, b.created_at, b.updated_at,
                c.id, c.name, c.parent_id, c.category_type, c.icon, c.color, c.is_system, c.display_order, c.created_at, c.updated_at
         FROM budgets b
         JOIN categories c ON b.category_id = c.id
         WHERE c.deleted_at IS NULL"
    )?;

    let budget_categories: Vec<(Budget, Category)> = stmt
        .query_map([], |row| {
            Ok((
                Budget {
                    id: row.get(0)?,
                    category_id: row.get(1)?,
                    period_type: row.get(2)?,
                    amount: row.get(3)?,
                    rollover: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                },
                Category {
                    id: row.get(7)?,
                    name: row.get(8)?,
                    parent_id: row.get(9)?,
                    category_type: row.get(10)?,
                    icon: row.get(11)?,
                    color: row.get(12)?,
                    is_system: row.get(13)?,
                    display_order: row.get(14)?,
                    created_at: row.get(15)?,
                    updated_at: row.get(16)?,
                },
            ))
        })?
        .filter_map(|r| r.ok())
        .collect();

    let mut summaries = Vec::new();

    for (budget, category) in budget_categories {
        // Calculate spending for this category in the given month
        let spent: i64 = conn.query_row(
            "SELECT COALESCE(SUM(ABS(amount)), 0)
             FROM transactions
             WHERE category_id = ?1
               AND date >= ?2
               AND date < ?3
               AND amount < 0
               AND deleted_at IS NULL
               AND transfer_id IS NULL",
            rusqlite::params![budget.category_id, start_date, end_date],
            |row| row.get(0),
        ).unwrap_or(0);

        let remaining = budget.amount - spent;

        summaries.push(BudgetSummary {
            budget,
            category,
            spent,
            remaining,
        });
    }

    Ok(summaries)
}

#[tauri::command]
pub fn create_budget(
    data: serde_json::Value,
    db: State<'_, Mutex<Database>>,
) -> Result<Budget> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO budgets (id, category_id, period_type, amount, rollover, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            id,
            data["categoryId"].as_str().unwrap_or(""),
            data["periodType"].as_str().unwrap_or("monthly"),
            data["amount"].as_i64().unwrap_or(0),
            data["rollover"].as_bool().unwrap_or(false),
            now,
            now,
        ],
    )?;

    conn.query_row(
        "SELECT id, category_id, period_type, amount, rollover, created_at, updated_at
         FROM budgets WHERE id = ?1",
        [&id],
        |row| {
            Ok(Budget {
                id: row.get(0)?,
                category_id: row.get(1)?,
                period_type: row.get(2)?,
                amount: row.get(3)?,
                rollover: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        },
    )
    .map_err(|e| e.into())
}

#[tauri::command]
pub fn update_budget(
    id: String,
    data: serde_json::Value,
    db: State<'_, Mutex<Database>>,
) -> Result<Budget> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE budgets SET
            category_id = COALESCE(?1, category_id),
            period_type = COALESCE(?2, period_type),
            amount = COALESCE(?3, amount),
            rollover = COALESCE(?4, rollover),
            updated_at = ?5
         WHERE id = ?6",
        rusqlite::params![
            data["categoryId"].as_str(),
            data["periodType"].as_str(),
            data["amount"].as_i64(),
            data["rollover"].as_bool(),
            now,
            id,
        ],
    )?;

    conn.query_row(
        "SELECT id, category_id, period_type, amount, rollover, created_at, updated_at
         FROM budgets WHERE id = ?1",
        [&id],
        |row| {
            Ok(Budget {
                id: row.get(0)?,
                category_id: row.get(1)?,
                period_type: row.get(2)?,
                amount: row.get(3)?,
                rollover: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        },
    )
    .map_err(|e| e.into())
}

#[tauri::command]
pub fn delete_budget(id: String, db: State<'_, Mutex<Database>>) -> Result<()> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    conn.execute("DELETE FROM budgets WHERE id = ?1", [&id])?;

    Ok(())
}
