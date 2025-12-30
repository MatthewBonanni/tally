import type { AccountType, TransactionStatus, CategoryType, BudgetPeriod } from "@/lib/constants";

export interface Account {
  id: string;
  name: string;
  accountType: AccountType;
  institutionId: string | null;
  accountNumberMasked: string | null;
  currency: string;
  currentBalance: number;
  availableBalance: number | null;
  creditLimit: number | null;
  interestRate: number | null;
  isActive: boolean;
  isHidden: boolean;
  displayOrder: number;
  ofxAccountId: string | null;
  lastSyncAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Institution {
  id: string;
  name: string;
  ofxOrg: string | null;
  ofxFid: string | null;
  ofxUrl: string | null;
  ofxBrokerId: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  website: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  date: string;
  postedDate: string | null;
  amount: number;
  payee: string | null;
  originalPayee: string | null;
  categoryId: string | null;
  notes: string | null;
  memo: string | null;
  checkNumber: string | null;
  transactionType: string | null;
  status: TransactionStatus;
  isRecurring: boolean;
  recurringTransactionId: string | null;
  transferId: string | null;
  transferAccountId: string | null;
  importId: string | null;
  importSource: string | null;
  importBatchId: string | null;
  isSplit: boolean;
  parentTransactionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionSplit {
  id: string;
  parentTransactionId: string;
  categoryId: string | null;
  amount: number;
  memo: string | null;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  categoryType: CategoryType;
  icon: string | null;
  color: string | null;
  isSystem: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  children?: Category[];
}

export interface CategoryRule {
  id: string;
  categoryId: string;
  ruleType: "payee_contains" | "payee_exact" | "amount_equals" | "amount_range" | "regex";
  pattern: string;
  amountMin: number | null;
  amountMax: number | null;
  accountId: string | null;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  periodType: BudgetPeriod;
  amount: number;
  rollover: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetPeriodData {
  id: string;
  budgetId: string;
  periodStart: string;
  periodEnd: string;
  budgetedAmount: number;
  rolloverAmount: number;
  spent: number;
  remaining: number;
  createdAt: string;
}

export interface Goal {
  id: string;
  name: string;
  goalType: "savings" | "debt_payoff" | "spending_limit";
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  linkedAccountId: string | null;
  icon: string | null;
  color: string | null;
  isAchieved: boolean;
  achievedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringTransaction {
  id: string;
  accountId: string;
  payee: string;
  amount: number;
  categoryId: string | null;
  frequency: "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
  startDate: string;
  endDate: string | null;
  nextExpectedDate: string | null;
  lastMatchedTransactionId: string | null;
  toleranceDays: number;
  toleranceAmount: number;
  isAutoDetected: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Security {
  id: string;
  symbol: string;
  name: string | null;
  securityType: "stock" | "etf" | "mutual_fund" | "bond" | "crypto" | "other" | null;
  currentPrice: number | null;
  priceUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Holding {
  id: string;
  accountId: string;
  securityId: string;
  quantity: number;
  costBasis: number | null;
  acquisitionDate: string | null;
  createdAt: string;
  updatedAt: string;
  security?: Security;
}

export interface NetWorthSnapshot {
  id: string;
  snapshotDate: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  createdAt: string;
}

export interface TransactionFilters {
  accountId: string | null;
  categoryId: string | null;
  startDate: string | null;
  endDate: string | null;
  searchQuery: string;
  status: TransactionStatus | null;
  minAmount: number | null;
  maxAmount: number | null;
  isTransfer: boolean | null;
}

export interface ImportPreview {
  transactions: Partial<Transaction>[];
  duplicateCount: number;
  newCount: number;
}

export interface TransferCandidate {
  transactionA: Transaction;
  transactionB: Transaction;
  confidence: number;
}

export interface SpendingByCategory {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
  color: string | null;
}

export interface CashFlowData {
  period: string;
  income: number;
  expenses: number;
  net: number;
}
