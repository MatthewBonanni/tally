use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: String,
    pub name: String,
    pub account_type: String,
    pub institution_id: Option<String>,
    pub account_number_masked: Option<String>,
    pub currency: String,
    pub current_balance: i64,
    pub available_balance: Option<i64>,
    pub credit_limit: Option<i64>,
    pub interest_rate: Option<f64>,
    pub is_active: bool,
    pub is_hidden: bool,
    pub display_order: i32,
    pub ofx_account_id: Option<String>,
    pub last_sync_at: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Transaction {
    pub id: String,
    pub account_id: String,
    pub date: String,
    pub posted_date: Option<String>,
    pub amount: i64,
    pub payee: Option<String>,
    pub original_payee: Option<String>,
    pub category_id: Option<String>,
    pub notes: Option<String>,
    pub memo: Option<String>,
    pub check_number: Option<String>,
    pub transaction_type: Option<String>,
    pub status: String,
    pub is_recurring: bool,
    pub recurring_transaction_id: Option<String>,
    pub transfer_id: Option<String>,
    pub transfer_account_id: Option<String>,
    pub import_id: Option<String>,
    pub import_source: Option<String>,
    pub import_batch_id: Option<String>,
    pub is_split: bool,
    pub parent_transaction_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub category_type: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub is_system: bool,
    pub display_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryRule {
    pub id: String,
    pub category_id: String,
    pub rule_type: String,
    pub pattern: String,
    pub amount_min: Option<i64>,
    pub amount_max: Option<i64>,
    pub account_id: Option<String>,
    pub priority: i32,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Budget {
    pub id: String,
    pub category_id: String,
    pub period_type: String,
    pub amount: i64,
    pub rollover: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Goal {
    pub id: String,
    pub name: String,
    pub goal_type: String,
    pub target_amount: i64,
    pub current_amount: i64,
    pub target_date: Option<String>,
    pub linked_account_id: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub is_achieved: bool,
    pub achieved_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionFilters {
    pub account_id: Option<String>,
    pub category_id: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub search_query: Option<String>,
    pub status: Option<String>,
    pub min_amount: Option<i64>,
    pub max_amount: Option<i64>,
    pub is_transfer: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferCandidate {
    pub transaction_a: Transaction,
    pub transaction_b: Transaction,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpendingByCategory {
    pub category_id: String,
    pub category_name: String,
    pub amount: i64,
    pub percentage: f64,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetWorthSnapshot {
    pub id: String,
    pub snapshot_date: String,
    pub total_assets: i64,
    pub total_liabilities: i64,
    pub net_worth: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringTransaction {
    pub id: String,
    pub account_id: String,
    pub payee: String,
    pub amount: i64,
    pub category_id: Option<String>,
    pub frequency: String,
    pub start_date: String,
    pub end_date: Option<String>,
    pub next_expected_date: Option<String>,
    pub last_matched_transaction_id: Option<String>,
    pub tolerance_days: i32,
    pub tolerance_amount: i64,
    pub is_auto_detected: bool,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}
