pub mod commands;
pub mod db;
pub mod error;
pub mod import;
pub mod models;

use db::Database;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(Mutex::new(Database::new()))
        .invoke_handler(tauri::generate_handler![
            // Settings
            commands::unlock_database,
            commands::change_password,
            commands::is_unlocked,
            commands::get_setting,
            commands::set_setting,
            commands::export_to_json,
            // Accounts
            commands::list_accounts,
            commands::get_account,
            commands::create_account,
            commands::update_account,
            commands::delete_account,
            // Transactions
            commands::list_transactions,
            commands::get_transaction,
            commands::create_transaction,
            commands::update_transaction,
            commands::delete_transactions,
            commands::bulk_categorize,
            commands::detect_transfers,
            commands::link_transfer,
            commands::unlink_transfer,
            // Categories
            commands::list_categories,
            commands::create_category,
            commands::update_category,
            commands::delete_category,
            // Category Rules
            commands::list_category_rules,
            commands::create_category_rule,
            commands::update_category_rule,
            commands::delete_category_rule,
            commands::apply_category_rules,
            // Import
            commands::preview_csv_file,
            commands::parse_csv_file,
            commands::import_transactions,
            // Budgets
            commands::list_budgets,
            commands::get_budget_summary,
            commands::create_budget,
            commands::update_budget,
            commands::delete_budget,
            // Goals
            commands::list_goals,
            commands::create_goal,
            commands::update_goal,
            commands::delete_goal,
            commands::contribute_to_goal,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
