-- Core Financial Entities

CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL,
    institution_id TEXT,
    account_number_masked TEXT,
    currency TEXT NOT NULL DEFAULT 'USD',
    current_balance INTEGER NOT NULL DEFAULT 0,
    available_balance INTEGER,
    credit_limit INTEGER,
    interest_rate REAL,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_hidden INTEGER NOT NULL DEFAULT 0,
    display_order INTEGER NOT NULL DEFAULT 0,
    ofx_account_id TEXT,
    last_sync_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS institutions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ofx_org TEXT,
    ofx_fid TEXT,
    ofx_url TEXT,
    ofx_broker_id TEXT,
    logo_url TEXT,
    primary_color TEXT,
    website TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    date TEXT NOT NULL,
    posted_date TEXT,
    amount INTEGER NOT NULL,
    payee TEXT,
    original_payee TEXT,
    category_id TEXT,
    notes TEXT,
    memo TEXT,
    check_number TEXT,
    transaction_type TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    is_recurring INTEGER NOT NULL DEFAULT 0,
    recurring_transaction_id TEXT,
    transfer_id TEXT,
    transfer_account_id TEXT,
    import_id TEXT,
    import_source TEXT,
    import_batch_id TEXT,
    is_split INTEGER NOT NULL DEFAULT 0,
    parent_transaction_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS transaction_splits (
    id TEXT PRIMARY KEY,
    parent_transaction_id TEXT NOT NULL,
    category_id TEXT,
    amount INTEGER NOT NULL,
    memo TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT,
    category_type TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    is_system INTEGER NOT NULL DEFAULT 0,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS category_rules (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    rule_type TEXT NOT NULL,
    pattern TEXT NOT NULL,
    amount_min INTEGER,
    amount_max INTEGER,
    account_id TEXT,
    priority INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Budgeting

CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    period_type TEXT NOT NULL DEFAULT 'monthly',
    amount INTEGER NOT NULL,
    rollover INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS budget_periods (
    id TEXT PRIMARY KEY,
    budget_id TEXT NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    budgeted_amount INTEGER NOT NULL,
    rollover_amount INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Goals

CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    goal_type TEXT NOT NULL,
    target_amount INTEGER NOT NULL,
    current_amount INTEGER NOT NULL DEFAULT 0,
    target_date TEXT,
    linked_account_id TEXT,
    icon TEXT,
    color TEXT,
    is_achieved INTEGER NOT NULL DEFAULT 0,
    achieved_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS goal_contributions (
    id TEXT PRIMARY KEY,
    goal_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    date TEXT NOT NULL,
    transaction_id TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Recurring Transactions

CREATE TABLE IF NOT EXISTS recurring_transactions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    payee TEXT NOT NULL,
    amount INTEGER NOT NULL,
    category_id TEXT,
    frequency TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT,
    next_expected_date TEXT,
    last_matched_transaction_id TEXT,
    tolerance_days INTEGER NOT NULL DEFAULT 3,
    tolerance_amount INTEGER NOT NULL DEFAULT 0,
    is_auto_detected INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Investment Tracking

CREATE TABLE IF NOT EXISTS holdings (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    security_id TEXT NOT NULL,
    quantity REAL NOT NULL,
    cost_basis INTEGER,
    acquisition_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS securities (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL UNIQUE,
    name TEXT,
    security_type TEXT,
    current_price INTEGER,
    price_updated_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS investment_transactions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    security_id TEXT,
    transaction_type TEXT NOT NULL,
    date TEXT NOT NULL,
    quantity REAL,
    price_per_unit INTEGER,
    total_amount INTEGER NOT NULL,
    fees INTEGER DEFAULT 0,
    import_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Net Worth Snapshots

CREATE TABLE IF NOT EXISTS net_worth_snapshots (
    id TEXT PRIMARY KEY,
    snapshot_date TEXT NOT NULL,
    total_assets INTEGER NOT NULL,
    total_liabilities INTEGER NOT NULL,
    net_worth INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS account_snapshots (
    id TEXT PRIMARY KEY,
    net_worth_snapshot_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    balance INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Import History

CREATE TABLE IF NOT EXISTS import_batches (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    import_source TEXT NOT NULL,
    file_name TEXT,
    transactions_imported INTEGER NOT NULL DEFAULT 0,
    transactions_skipped INTEGER NOT NULL DEFAULT 0,
    import_date TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- User Preferences

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for Performance

CREATE INDEX IF NOT EXISTS idx_transactions_account_date ON transactions(account_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_import_id ON transactions(import_id);
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_id ON transactions(transfer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_payee ON transactions(payee);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_holdings_account ON holdings(account_id);
CREATE INDEX IF NOT EXISTS idx_budget_periods_dates ON budget_periods(period_start, period_end);
