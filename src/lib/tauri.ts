import { invoke } from "@tauri-apps/api/core";
import type {
  Account,
  Transaction,
  Category,
  Budget,
  Goal,
  RecurringTransaction,
  DetectedRecurring,
  TransactionFilters,
  TransferCandidate,
  SpendingByCategory,
  CashFlowData,
  NetWorthSnapshot,
  CategoryRule,
  Holding,
} from "@/types";

// Database commands
export async function unlockDatabase(password: string): Promise<boolean> {
  return invoke("unlock_database", { password });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
  return invoke("change_password", { currentPassword, newPassword });
}

export async function isUnlocked(): Promise<boolean> {
  return invoke("is_unlocked");
}

// Account commands
export async function listAccounts(): Promise<Account[]> {
  return invoke("list_accounts");
}

export async function getAccount(id: string): Promise<Account> {
  return invoke("get_account", { id });
}

export async function createAccount(data: Omit<Account, "id" | "createdAt" | "updatedAt">): Promise<Account> {
  return invoke("create_account", { data });
}

export async function updateAccount(id: string, data: Partial<Account>): Promise<Account> {
  return invoke("update_account", { id, data });
}

export async function deleteAccount(id: string): Promise<void> {
  return invoke("delete_account", { id });
}

// Transaction commands
export async function listTransactions(filters: Partial<TransactionFilters> = {}): Promise<Transaction[]> {
  return invoke("list_transactions", { filters });
}

export async function getTransaction(id: string): Promise<Transaction> {
  return invoke("get_transaction", { id });
}

export async function createTransaction(
  data: Omit<Transaction, "id" | "createdAt" | "updatedAt">
): Promise<Transaction> {
  return invoke("create_transaction", { data });
}

export async function updateTransaction(id: string, data: Partial<Transaction>): Promise<Transaction> {
  return invoke("update_transaction", { id, data });
}

export async function deleteTransactions(ids: string[]): Promise<void> {
  return invoke("delete_transactions", { ids });
}

export async function bulkCategorize(ids: string[], categoryId: string): Promise<void> {
  return invoke("bulk_categorize", { ids, categoryId });
}

export async function detectTransfers(): Promise<TransferCandidate[]> {
  return invoke("detect_transfers");
}

export async function linkTransfer(transactionAId: string, transactionBId: string): Promise<void> {
  return invoke("link_transfer", { transactionAId, transactionBId });
}

export async function unlinkTransfer(transactionId: string): Promise<void> {
  return invoke("unlink_transfer", { transactionId });
}

// Category commands
export async function listCategories(): Promise<Category[]> {
  return invoke("list_categories");
}

export async function createCategory(
  data: Omit<Category, "id" | "createdAt" | "updatedAt" | "isSystem">
): Promise<Category> {
  return invoke("create_category", { data });
}

export async function updateCategory(id: string, data: Partial<Category>): Promise<Category> {
  return invoke("update_category", { id, data });
}

export async function deleteCategory(id: string): Promise<void> {
  return invoke("delete_category", { id });
}

// Category rule commands
export async function listCategoryRules(): Promise<CategoryRule[]> {
  return invoke("list_category_rules");
}

export async function createCategoryRule(
  data: Omit<CategoryRule, "id" | "createdAt" | "updatedAt">
): Promise<CategoryRule> {
  return invoke("create_category_rule", { data });
}

export async function updateCategoryRule(id: string, data: Partial<CategoryRule>): Promise<CategoryRule> {
  return invoke("update_category_rule", { id, data });
}

export async function deleteCategoryRule(id: string): Promise<void> {
  return invoke("delete_category_rule", { id });
}

export async function applyCategoryRules(transactionIds?: string[]): Promise<number> {
  return invoke("apply_category_rules", { transactionIds });
}

// Budget commands
export async function listBudgets(): Promise<Budget[]> {
  return invoke("list_budgets");
}

export async function getBudgetSummary(month: string): Promise<
  Array<{
    budget: Budget;
    category: Category;
    spent: number;
    remaining: number;
  }>
> {
  return invoke("get_budget_summary", { month });
}

export async function createBudget(data: Omit<Budget, "id" | "createdAt" | "updatedAt">): Promise<Budget> {
  return invoke("create_budget", { data });
}

export async function updateBudget(id: string, data: Partial<Budget>): Promise<Budget> {
  return invoke("update_budget", { id, data });
}

export async function deleteBudget(id: string): Promise<void> {
  return invoke("delete_budget", { id });
}

// Goal commands
export async function listGoals(): Promise<Goal[]> {
  return invoke("list_goals");
}

export async function createGoal(data: Omit<Goal, "id" | "createdAt" | "updatedAt" | "isAchieved" | "achievedAt">): Promise<Goal> {
  return invoke("create_goal", { data });
}

export async function updateGoal(id: string, data: Partial<Goal>): Promise<Goal> {
  return invoke("update_goal", { id, data });
}

export async function deleteGoal(id: string): Promise<void> {
  return invoke("delete_goal", { id });
}

export async function contributeToGoal(goalId: string, amount: number, transactionId?: string): Promise<void> {
  return invoke("contribute_to_goal", { goalId, amount, transactionId });
}

// Recurring transaction commands
export async function listRecurringTransactions(): Promise<RecurringTransaction[]> {
  return invoke("list_recurring_transactions");
}

export async function detectRecurringTransactions(): Promise<DetectedRecurring[]> {
  return invoke("detect_recurring_transactions");
}

export async function createRecurringTransaction(
  data: Omit<RecurringTransaction, "id" | "createdAt" | "updatedAt">
): Promise<RecurringTransaction> {
  return invoke("create_recurring_transaction", { data });
}

export async function updateRecurringTransaction(
  id: string,
  data: Partial<RecurringTransaction>
): Promise<RecurringTransaction> {
  return invoke("update_recurring_transaction", { id, data });
}

export async function deleteRecurringTransaction(id: string): Promise<void> {
  return invoke("delete_recurring_transaction", { id });
}

// Investment commands
export async function listHoldings(accountId?: string): Promise<Holding[]> {
  return invoke("list_holdings", { accountId });
}

export async function updateSecurityPrice(symbol: string, price: number): Promise<void> {
  return invoke("update_security_price", { symbol, price });
}

// Report commands
export async function getSpendingByCategory(startDate: string, endDate: string): Promise<SpendingByCategory[]> {
  return invoke("get_spending_by_category", { startDate, endDate });
}

export async function getCashFlow(startDate: string, endDate: string, groupBy: "day" | "week" | "month"): Promise<CashFlowData[]> {
  return invoke("get_cash_flow", { startDate, endDate, groupBy });
}

export async function getNetWorthHistory(startDate: string, endDate: string): Promise<NetWorthSnapshot[]> {
  return invoke("get_net_worth_history", { startDate, endDate });
}

export async function takeNetWorthSnapshot(): Promise<NetWorthSnapshot> {
  return invoke("take_net_worth_snapshot");
}

// Import commands
export interface CsvPreview {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

export interface ColumnMapping {
  dateColumn: number;
  amountColumn: number;
  debitColumn?: number;
  creditColumn?: number;
  payeeColumn?: number;
  memoColumn?: number;
  categoryColumn?: number;
  dateFormat: string;
  invertAmounts: boolean;
}

export interface ParsedTransaction {
  date: string;
  amount: number;
  payee?: string;
  memo?: string;
  categoryHint?: string;
  rawData: Record<string, string>;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  batchId: string;
}

export async function previewCsvFile(filePath: string): Promise<CsvPreview> {
  return invoke("preview_csv_file", { filePath });
}

export async function parseCsvFile(
  filePath: string,
  mapping: ColumnMapping
): Promise<ParsedTransaction[]> {
  return invoke("parse_csv_file", { filePath, mapping });
}

export async function importTransactions(
  accountId: string,
  transactions: Array<{
    date: string;
    amount: number;
    payee?: string;
    memo?: string;
    categoryId?: string;
  }>
): Promise<ImportResult> {
  return invoke("import_transactions", { accountId, transactions });
}

// Export commands
export async function exportToCsv(filters: Partial<TransactionFilters>): Promise<string> {
  return invoke("export_to_csv", { filters });
}

export async function exportToJson(): Promise<string> {
  return invoke("export_to_json");
}

// Settings commands
export async function getSetting(key: string): Promise<string | null> {
  return invoke("get_setting", { key });
}

export async function setSetting(key: string, value: string): Promise<void> {
  return invoke("set_setting", { key, value });
}
