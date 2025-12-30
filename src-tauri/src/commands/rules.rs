use crate::db::Database;
use crate::error::Result;
use crate::models::CategoryRule;
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn list_category_rules(db: State<'_, Mutex<Database>>) -> Result<Vec<CategoryRule>> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let mut stmt = conn.prepare(
        "SELECT id, category_id, rule_type, pattern, amount_min, amount_max,
                account_id, priority, is_active, created_at, updated_at
         FROM category_rules
         ORDER BY priority DESC, created_at DESC"
    )?;

    let rules = stmt
        .query_map([], |row| {
            Ok(CategoryRule {
                id: row.get(0)?,
                category_id: row.get(1)?,
                rule_type: row.get(2)?,
                pattern: row.get(3)?,
                amount_min: row.get(4)?,
                amount_max: row.get(5)?,
                account_id: row.get(6)?,
                priority: row.get(7)?,
                is_active: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rules)
}

#[tauri::command]
pub fn create_category_rule(
    data: serde_json::Value,
    db: State<'_, Mutex<Database>>,
) -> Result<CategoryRule> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO category_rules (id, category_id, rule_type, pattern, amount_min, amount_max, account_id, priority, is_active, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            id,
            data["categoryId"].as_str().unwrap_or(""),
            data["ruleType"].as_str().unwrap_or("payee_contains"),
            data["pattern"].as_str().unwrap_or(""),
            data["amountMin"].as_i64(),
            data["amountMax"].as_i64(),
            data["accountId"].as_str(),
            data["priority"].as_i64().unwrap_or(0) as i32,
            data["isActive"].as_bool().unwrap_or(true),
            now,
            now,
        ],
    )?;

    conn.query_row(
        "SELECT id, category_id, rule_type, pattern, amount_min, amount_max,
                account_id, priority, is_active, created_at, updated_at
         FROM category_rules WHERE id = ?1",
        [&id],
        |row| {
            Ok(CategoryRule {
                id: row.get(0)?,
                category_id: row.get(1)?,
                rule_type: row.get(2)?,
                pattern: row.get(3)?,
                amount_min: row.get(4)?,
                amount_max: row.get(5)?,
                account_id: row.get(6)?,
                priority: row.get(7)?,
                is_active: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        },
    )
    .map_err(|e| e.into())
}

#[tauri::command]
pub fn update_category_rule(
    id: String,
    data: serde_json::Value,
    db: State<'_, Mutex<Database>>,
) -> Result<CategoryRule> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE category_rules SET
            category_id = COALESCE(?1, category_id),
            rule_type = COALESCE(?2, rule_type),
            pattern = COALESCE(?3, pattern),
            amount_min = ?4,
            amount_max = ?5,
            account_id = ?6,
            priority = COALESCE(?7, priority),
            is_active = COALESCE(?8, is_active),
            updated_at = ?9
         WHERE id = ?10",
        rusqlite::params![
            data["categoryId"].as_str(),
            data["ruleType"].as_str(),
            data["pattern"].as_str(),
            data["amountMin"].as_i64(),
            data["amountMax"].as_i64(),
            data["accountId"].as_str(),
            data["priority"].as_i64().map(|v| v as i32),
            data["isActive"].as_bool(),
            now,
            id,
        ],
    )?;

    conn.query_row(
        "SELECT id, category_id, rule_type, pattern, amount_min, amount_max,
                account_id, priority, is_active, created_at, updated_at
         FROM category_rules WHERE id = ?1",
        [&id],
        |row| {
            Ok(CategoryRule {
                id: row.get(0)?,
                category_id: row.get(1)?,
                rule_type: row.get(2)?,
                pattern: row.get(3)?,
                amount_min: row.get(4)?,
                amount_max: row.get(5)?,
                account_id: row.get(6)?,
                priority: row.get(7)?,
                is_active: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        },
    )
    .map_err(|e| e.into())
}

#[tauri::command]
pub fn delete_category_rule(id: String, db: State<'_, Mutex<Database>>) -> Result<()> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    conn.execute("DELETE FROM category_rules WHERE id = ?1", [&id])?;

    Ok(())
}

#[tauri::command]
pub fn apply_category_rules(
    transaction_ids: Option<Vec<String>>,
    db: State<'_, Mutex<Database>>,
) -> Result<i32> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

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

    // Get uncategorized transactions
    let tx_query = if let Some(ref ids) = transaction_ids {
        if ids.is_empty() {
            return Ok(0);
        }
        let placeholders: Vec<String> = ids.iter().map(|_| "?".to_string()).collect();
        format!(
            "SELECT id, account_id, payee, amount FROM transactions
             WHERE id IN ({}) AND deleted_at IS NULL",
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

    Ok(categorized_count)
}
