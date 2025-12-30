use crate::db::Database;
use crate::error::Result;
use std::sync::Mutex;
use tauri::State;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Holding {
    pub id: String,
    pub account_id: String,
    pub account_name: String,
    pub symbol: String,
    pub name: Option<String>,
    pub security_type: Option<String>,
    pub quantity: f64,
    pub current_price: Option<i64>,
    pub cost_basis: Option<i64>,
    pub market_value: i64,
    pub gain_loss: Option<i64>,
    pub gain_loss_percent: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvestmentSummary {
    pub total_value: i64,
    pub total_cost_basis: i64,
    pub total_gain_loss: i64,
    pub total_gain_loss_percent: f64,
    pub holdings_by_type: Vec<HoldingsByType>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HoldingsByType {
    pub security_type: String,
    pub value: i64,
    pub percentage: f64,
}

#[tauri::command]
pub fn list_holdings(account_id: Option<String>, db: State<'_, Mutex<Database>>) -> Result<Vec<Holding>> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let query = if account_id.is_some() {
        "SELECT h.id, h.account_id, a.name as account_name, s.symbol, s.name, s.security_type,
                h.quantity, s.current_price, h.cost_basis
         FROM holdings h
         JOIN accounts a ON h.account_id = a.id
         JOIN securities s ON h.security_id = s.id
         WHERE h.account_id = ?1
         ORDER BY s.symbol"
    } else {
        "SELECT h.id, h.account_id, a.name as account_name, s.symbol, s.name, s.security_type,
                h.quantity, s.current_price, h.cost_basis
         FROM holdings h
         JOIN accounts a ON h.account_id = a.id
         JOIN securities s ON h.security_id = s.id
         ORDER BY a.name, s.symbol"
    };

    let mut stmt = conn.prepare(query)?;

    let holdings: Vec<Holding> = if let Some(ref acc_id) = account_id {
        stmt.query_map([acc_id], |row| {
            let quantity: f64 = row.get(6)?;
            let current_price: Option<i64> = row.get(7)?;
            let cost_basis: Option<i64> = row.get(8)?;

            let market_value = current_price.map(|p| (quantity * p as f64) as i64).unwrap_or(0);
            let gain_loss = cost_basis.map(|cb| market_value - cb);
            let gain_loss_percent = cost_basis.and_then(|cb| {
                if cb != 0 {
                    Some((market_value - cb) as f64 / cb as f64 * 100.0)
                } else {
                    None
                }
            });

            Ok(Holding {
                id: row.get(0)?,
                account_id: row.get(1)?,
                account_name: row.get(2)?,
                symbol: row.get(3)?,
                name: row.get(4)?,
                security_type: row.get(5)?,
                quantity,
                current_price,
                cost_basis,
                market_value,
                gain_loss,
                gain_loss_percent,
            })
        })?
        .filter_map(|r| r.ok())
        .collect()
    } else {
        stmt.query_map([], |row| {
            let quantity: f64 = row.get(6)?;
            let current_price: Option<i64> = row.get(7)?;
            let cost_basis: Option<i64> = row.get(8)?;

            let market_value = current_price.map(|p| (quantity * p as f64) as i64).unwrap_or(0);
            let gain_loss = cost_basis.map(|cb| market_value - cb);
            let gain_loss_percent = cost_basis.and_then(|cb| {
                if cb != 0 {
                    Some((market_value - cb) as f64 / cb as f64 * 100.0)
                } else {
                    None
                }
            });

            Ok(Holding {
                id: row.get(0)?,
                account_id: row.get(1)?,
                account_name: row.get(2)?,
                symbol: row.get(3)?,
                name: row.get(4)?,
                security_type: row.get(5)?,
                quantity,
                current_price,
                cost_basis,
                market_value,
                gain_loss,
                gain_loss_percent,
            })
        })?
        .filter_map(|r| r.ok())
        .collect()
    };

    Ok(holdings)
}

#[tauri::command]
pub fn get_investment_summary(db: State<'_, Mutex<Database>>) -> Result<InvestmentSummary> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    // Get all holdings with their values
    let mut stmt = conn.prepare(
        "SELECT s.security_type, h.quantity, s.current_price, h.cost_basis
         FROM holdings h
         JOIN securities s ON h.security_id = s.id"
    )?;

    let mut total_value: i64 = 0;
    let mut total_cost_basis: i64 = 0;
    let mut type_values: std::collections::HashMap<String, i64> = std::collections::HashMap::new();

    stmt.query_map([], |row| {
        let security_type: Option<String> = row.get(0)?;
        let quantity: f64 = row.get(1)?;
        let current_price: Option<i64> = row.get(2)?;
        let cost_basis: Option<i64> = row.get(3)?;

        Ok((security_type, quantity, current_price, cost_basis))
    })?
    .filter_map(|r| r.ok())
    .for_each(|(security_type, quantity, current_price, cost_basis)| {
        let market_value = current_price.map(|p| (quantity * p as f64) as i64).unwrap_or(0);
        total_value += market_value;
        total_cost_basis += cost_basis.unwrap_or(0);

        let type_name = security_type.unwrap_or_else(|| "Other".to_string());
        *type_values.entry(type_name).or_insert(0) += market_value;
    });

    let total_gain_loss = total_value - total_cost_basis;
    let total_gain_loss_percent = if total_cost_basis != 0 {
        total_gain_loss as f64 / total_cost_basis as f64 * 100.0
    } else {
        0.0
    };

    let holdings_by_type: Vec<HoldingsByType> = type_values
        .into_iter()
        .map(|(security_type, value)| {
            let percentage = if total_value != 0 {
                value as f64 / total_value as f64 * 100.0
            } else {
                0.0
            };
            HoldingsByType {
                security_type,
                value,
                percentage,
            }
        })
        .collect();

    Ok(InvestmentSummary {
        total_value,
        total_cost_basis,
        total_gain_loss,
        total_gain_loss_percent,
        holdings_by_type,
    })
}

#[tauri::command]
pub fn update_security_price(symbol: String, price: i64, db: State<'_, Mutex<Database>>) -> Result<()> {
    let database = db.lock().unwrap();
    let conn = database.get_connection()?;

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE securities SET current_price = ?1, price_updated_at = ?2, updated_at = ?3 WHERE symbol = ?4",
        rusqlite::params![price, now, now, symbol],
    )?;

    Ok(())
}
