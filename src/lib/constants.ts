export const ACCOUNT_TYPES = {
  checking: { label: "Checking", icon: "Wallet", color: "blue" },
  savings: { label: "Savings", icon: "PiggyBank", color: "green" },
  credit_card: { label: "Credit Card", icon: "CreditCard", color: "purple" },
  investment: { label: "Investment", icon: "TrendingUp", color: "orange" },
  retirement: { label: "Retirement", icon: "TrendingUp", color: "amber" },
  loan: { label: "Loan", icon: "Landmark", color: "red" },
  cash: { label: "Cash", icon: "Banknote", color: "emerald" },
  other: { label: "Other", icon: "CircleDollarSign", color: "gray" },
} as const;

export type AccountType = keyof typeof ACCOUNT_TYPES;

export const TRANSACTION_STATUS = {
  pending: { label: "Pending", color: "yellow" },
  cleared: { label: "Cleared", color: "green" },
  reconciled: { label: "Reconciled", color: "blue" },
} as const;

export type TransactionStatus = keyof typeof TRANSACTION_STATUS;

export const CATEGORY_TYPES = {
  income: { label: "Income", color: "green" },
  expense: { label: "Expense", color: "red" },
  transfer: { label: "Transfer", color: "blue" },
} as const;

export type CategoryType = keyof typeof CATEGORY_TYPES;

export const BUDGET_PERIODS = {
  weekly: { label: "Weekly", days: 7 },
  biweekly: { label: "Bi-weekly", days: 14 },
  monthly: { label: "Monthly", days: 30 },
  quarterly: { label: "Quarterly", days: 90 },
  yearly: { label: "Yearly", days: 365 },
} as const;

export type BudgetPeriod = keyof typeof BUDGET_PERIODS;

export const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: "LayoutDashboard" },
  { path: "/accounts", label: "Accounts", icon: "Wallet" },
  { path: "/transactions", label: "Transactions", icon: "ArrowLeftRight" },
  { path: "/budgets", label: "Budgets", icon: "Target" },
  { path: "/goals", label: "Goals", icon: "Flag" },
  { path: "/reports", label: "Reports", icon: "BarChart3" },
  { path: "/categories", label: "Categories", icon: "Tags" },
  { path: "/recurring", label: "Recurring", icon: "Repeat" },
  { path: "/investments", label: "Investments", icon: "TrendingUp" },
  { path: "/rules", label: "Rules", icon: "Wand2" },
  { path: "/settings", label: "Settings", icon: "Settings" },
] as const;
