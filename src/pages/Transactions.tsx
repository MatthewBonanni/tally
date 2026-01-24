import { useEffect, useState, useMemo, useCallback, memo, useRef } from "react";
import {
  Plus,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  Tags,
  Upload,
  ChevronUp,
  ChevronDown,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { ImportDialog } from "@/components/import/ImportDialog";
import { useTransactionStore } from "@/stores/useTransactionStore";
import { useAccountStore } from "@/stores/useAccountStore";
import { useCategoryStore } from "@/stores/useCategoryStore";
import { formatMoney, formatDate, parseMoney, getTodayString } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types";

// Memoized transaction row to prevent re-renders when parent state changes
interface TransactionRowProps {
  tx: Transaction;
  index: number;
  isSelected: boolean;
  onSelect: (index: number, event: React.MouseEvent) => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (ids: string[]) => void;
  getAccountName: (id: string) => string;
  getCategoryName: (id: string | null) => string;
}

const TransactionRow = memo(function TransactionRow({
  tx,
  index,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  getAccountName,
  getCategoryName,
}: TransactionRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1 rounded hover:bg-accent transition-colors overflow-hidden select-none",
        isSelected && "bg-accent"
      )}
    >
      <div className="shrink-0" onClick={(e) => onSelect(index, e)}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => {}}
          className="pointer-events-none"
        />
      </div>
      <span className="text-sm text-muted-foreground shrink-0 w-[100px] whitespace-nowrap">
        {formatDate(tx.date)}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-sm font-medium truncate w-0 flex-1 cursor-default">
            {tx.payee || "Unknown"}
            {tx.transferId && " ↔"}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="select-text">{tx.payee || "Unknown"}</p>
        </TooltipContent>
      </Tooltip>
      <span className="text-sm text-muted-foreground truncate shrink-0 w-[120px]">
        {getCategoryName(tx.categoryId)}
      </span>
      <span className="text-sm text-muted-foreground truncate shrink-0 w-[100px]">
        {getAccountName(tx.accountId)}
      </span>
      <span
        className={cn(
          "text-sm font-semibold font-mono shrink-0 text-right w-[110px] whitespace-nowrap",
          tx.amount >= 0 ? "text-green-600" : "text-red-600"
        )}
      >
        {formatMoney(tx.amount)}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
            <MoreHorizontal className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(tx)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDelete([tx.id])}
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});

export function Transactions() {
  const {
    transactions,
    selectedIds,
    filters,
    fetchTransactions,
    createTransaction,
    updateTransaction,
    deleteTransactions,
    bulkCategorize,
    selectTransaction,
    selectAll,
    clearSelection,
    setFilters,
  } = useTransactionStore();
  const { accounts, fetchAccounts } = useAccountStore();
  const { categories, fetchCategories } = useCategoryStore();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isCategorizeDialogOpen, setIsCategorizeDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [sortColumn, setSortColumn] = useState<"date" | "payee" | "category" | "account" | "amount">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [formData, setFormData] = useState({
    accountId: "",
    date: getTodayString(),
    amount: "",
    isExpense: true,
    payee: "",
    categoryId: "",
    notes: "",
  });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);

  // Create lookup Maps for O(1) access instead of O(n) find() calls
  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a.name])),
    [accounts]
  );
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  // Compute sum of selected transactions
  const selectedSum = useMemo(() => {
    return transactions
      .filter((tx) => selectedIds.has(tx.id))
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions, selectedIds]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.accountId) count++;
    if (filters.categoryId) count++;
    if (filters.startDate) count++;
    if (filters.endDate) count++;
    if (filters.minAmount !== null) count++;
    if (filters.maxAmount !== null) count++;
    return count;
  }, [filters]);

  const clearAllFilters = () => {
    setFilters({
      searchQuery: "",
      accountId: null,
      categoryId: null,
      startDate: null,
      endDate: null,
      minAmount: null,
      maxAmount: null,
    });
  };

  // Sort transactions - uses Maps for O(1) lookups instead of O(n) find()
  const sortedTransactions = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case "date":
          comparison = a.date.localeCompare(b.date);
          break;
        case "payee":
          comparison = (a.payee || "").localeCompare(b.payee || "");
          break;
        case "category":
          const catA = categoryMap.get(a.categoryId ?? "") || "";
          const catB = categoryMap.get(b.categoryId ?? "") || "";
          comparison = catA.localeCompare(catB);
          break;
        case "account":
          const accA = accountMap.get(a.accountId) || "";
          const accB = accountMap.get(b.accountId) || "";
          comparison = accA.localeCompare(accB);
          break;
        case "amount":
          comparison = a.amount - b.amount;
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [transactions, sortColumn, sortDirection, categoryMap, accountMap]);

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection(column === "date" ? "desc" : "asc");
    }
  };

  const SortIcon = ({ column }: { column: typeof sortColumn }) => {
    if (sortColumn !== column) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-3 w-3 inline ml-0.5" />
    ) : (
      <ChevronDown className="h-3 w-3 inline ml-0.5" />
    );
  };

  // Only fetch accounts/categories if not cached - transactions are fetched by filter useEffect
  useEffect(() => {
    if (accounts.length === 0) fetchAccounts();
    if (categories.length === 0) fetchCategories();
  }, [accounts.length, categories.length, fetchAccounts, fetchCategories]);

  // Track if this is the initial mount
  const isInitialMount = useRef(true);

  // Use refs for values that change frequently to keep callbacks stable
  // This prevents callback recreation which would break React.memo
  const sortedTransactionsRef = useRef(sortedTransactions);
  const lastClickedIndexRef = useRef(lastClickedIndex);
  const selectedIdsRef = useRef(selectedIds);

  // Keep refs in sync with current values
  sortedTransactionsRef.current = sortedTransactions;
  lastClickedIndexRef.current = lastClickedIndex;
  selectedIdsRef.current = selectedIds;

  // Auto-fetch when filters change (with debounce for search)
  // Skip initial fetch if we already have cached transactions
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      // Skip fetch on mount if we have cached data
      if (transactions.length > 0) return;
    }
    const timeoutId = setTimeout(() => {
      fetchTransactions(filters);
    }, filters.searchQuery ? 300 : 0);
    return () => clearTimeout(timeoutId);
  }, [
    filters.searchQuery,
    filters.accountId,
    filters.categoryId,
    filters.startDate,
    filters.endDate,
    filters.minAmount,
    filters.maxAmount,
    fetchTransactions,
    transactions.length,
  ]);

  const handleOpenDialog = useCallback(
    (transaction?: Transaction) => {
      if (transaction) {
        setEditingTransaction(transaction);
        setFormData({
          accountId: transaction.accountId,
          date: transaction.date,
          amount: Math.abs(transaction.amount / 100).toFixed(2),
          isExpense: transaction.amount < 0,
          payee: transaction.payee || "",
          categoryId: transaction.categoryId || "",
          notes: transaction.notes || "",
        });
      } else {
        setEditingTransaction(null);
        setFormData({
          accountId: accounts[0]?.id || "",
          date: getTodayString(),
          amount: "",
          isExpense: true,
          payee: "",
          categoryId: "",
          notes: "",
        });
      }
      setIsDialogOpen(true);
    },
    [accounts]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = parseMoney(formData.amount);
    const signedAmount = formData.isExpense ? -amountCents : amountCents;

    const data = {
      accountId: formData.accountId,
      date: formData.date,
      amount: signedAmount,
      payee: formData.payee || null,
      originalPayee: formData.payee || null,
      categoryId: formData.categoryId || null,
      notes: formData.notes || null,
      postedDate: null,
      memo: null,
      checkNumber: null,
      transactionType: null,
      status: "cleared" as const,
      isRecurring: false,
      recurringTransactionId: null,
      transferId: null,
      transferAccountId: null,
      importId: null,
      importSource: "manual",
      importBatchId: null,
      isSplit: false,
      parentTransactionId: null,
    };

    if (editingTransaction) {
      await updateTransaction(editingTransaction.id, data);
    } else {
      await createTransaction(data);
    }
    setIsDialogOpen(false);
  };

  // Stable callback - uses ref for selectedIds
  const handleDelete = useCallback(
    (ids?: string[]) => {
      const idsToDelete = ids || Array.from(selectedIdsRef.current);
      if (idsToDelete.length === 0) return;
      setPendingDeleteIds(idsToDelete);
      setDeleteConfirmOpen(true);
    },
    []
  );

  const confirmDelete = async () => {
    await deleteTransactions(pendingDeleteIds);
    setDeleteConfirmOpen(false);
    setPendingDeleteIds([]);
  };

  const handleBulkCategorize = async () => {
    if (selectedIds.size === 0 || !selectedCategoryId) return;
    await bulkCategorize(Array.from(selectedIds), selectedCategoryId);
    setIsCategorizeDialogOpen(false);
    setSelectedCategoryId("");
    clearSelection();
  };

  const getAccountName = useCallback(
    (id: string) => accountMap.get(id) || "Unknown",
    [accountMap]
  );

  const getCategoryName = useCallback(
    (id: string | null) => (id ? categoryMap.get(id) || "Uncategorized" : "Uncategorized"),
    [categoryMap]
  );

  // Stable callback - never changes, reads from refs
  const handleSelectTransaction = useCallback(
    (index: number, event: React.MouseEvent) => {
      const tx = sortedTransactionsRef.current[index];
      if (!tx) return;

      if (event.shiftKey && lastClickedIndexRef.current !== null) {
        // Shift-click: select range between last clicked and current
        const start = Math.min(lastClickedIndexRef.current, index);
        const end = Math.max(lastClickedIndexRef.current, index);
        for (let i = start; i <= end; i++) {
          const t = sortedTransactionsRef.current[i];
          if (t && !selectedIdsRef.current.has(t.id)) {
            selectTransaction(t.id);
          }
        }
      } else {
        // Regular click: toggle single item
        selectTransaction(tx.id);
      }
      setLastClickedIndex(index);
    },
    [selectTransaction]
  );

  return (
    <>
      <Header
        title="Transactions"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </Button>
          </div>
        }
      />
      <PageContainer className="flex flex-col">
        {/* Filters */}
        <Card className="mb-4 shrink-0">
          <CardContent className="py-3">
            <div className="flex flex-col gap-3">
              {/* Primary filter row */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search transactions..."
                    value={filters.searchQuery}
                    onChange={(e) => setFilters({ searchQuery: e.target.value })}
                    className="pl-8 h-9"
                  />
                </div>
                <Select
                  value={filters.accountId || "all"}
                  onValueChange={(value) => {
                    setFilters({ accountId: value === "all" ? null : value });
                  }}
                >
                  <SelectTrigger className="h-9 w-[130px]">
                    <SelectValue placeholder="Account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={filters.categoryId || "all"}
                  onValueChange={(value) => {
                    setFilters({ categoryId: value === "all" ? null : value });
                  }}
                >
                  <SelectTrigger className="h-9 w-[130px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className={cn("h-9 gap-1.5 shrink-0", showAdvancedFilters && "bg-accent")}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    <span className="hidden sm:inline">More</span>
                    {activeFilterCount > 0 && (
                      <span className="rounded-full bg-primary text-primary-foreground text-xs px-1.5 py-0.5 min-w-[1.25rem] text-center">
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>
                  {(activeFilterCount > 0 || filters.searchQuery) && (
                    <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-9 text-muted-foreground shrink-0">
                      <X className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Clear</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Advanced filters */}
              {showAdvancedFilters && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Date:</span>
                    <Input
                      type="date"
                      value={filters.startDate || ""}
                      onChange={(e) => setFilters({ startDate: e.target.value || null })}
                      className="h-8 w-[130px] text-sm"
                    />
                    <span className="text-muted-foreground">–</span>
                    <Input
                      type="date"
                      value={filters.endDate || ""}
                      onChange={(e) => setFilters({ endDate: e.target.value || null })}
                      className="h-8 w-[130px] text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Amount:</span>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Min"
                        value={filters.minAmount !== null ? (filters.minAmount / 100).toFixed(2) : ""}
                        onChange={(e) => setFilters({
                          minAmount: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null
                        })}
                        className="pl-5 h-8 w-[90px] text-sm"
                      />
                    </div>
                    <span className="text-muted-foreground">–</span>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Max"
                        value={filters.maxAmount !== null ? (filters.maxAmount / 100).toFixed(2) : ""}
                        onChange={(e) => setFilters({
                          maxAmount: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null
                        })}
                        className="pl-5 h-8 w-[90px] text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Transaction List */}
        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between h-9">
              <CardTitle className={selectedIds.size > 0 ? "sr-only" : ""}>All Transactions</CardTitle>
              {selectedIds.size > 0 && (
                <>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                      {selectedIds.size} selected
                    </span>
                    <span className={cn(
                      "text-sm font-semibold font-mono",
                      selectedSum >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {formatMoney(selectedSum)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={clearSelection}>
                      Clear
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsCategorizeDialogOpen(true)}>
                      <Tags className="h-4 w-4 mr-2" />
                      Categorize
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete()}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0">
            {transactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ArrowLeftRight className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg">No transactions yet</p>
                <p className="text-sm">
                  Add transactions manually or import from your bank
                </p>
                <div className="flex gap-2 justify-center mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsImportDialogOpen(true)}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                  </Button>
                  <Button onClick={() => handleOpenDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Transaction
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0 overflow-x-auto">
                <div className="min-w-[700px]">
                  <div className="flex items-center gap-2 px-2 py-1 border-b mb-1 text-xs text-muted-foreground font-medium">
                    <div className="shrink-0">
                      <Checkbox
                        checked={
                          transactions.length > 0 &&
                          selectedIds.size === transactions.length
                        }
                        onCheckedChange={(checked) =>
                          checked ? selectAll() : clearSelection()
                        }
                      />
                    </div>
                    <button
                      className="shrink-0 w-[100px] text-left hover:text-foreground transition-colors"
                      onClick={() => handleSort("date")}
                    >
                      Date<SortIcon column="date" />
                    </button>
                    <button
                      className="w-0 flex-1 text-left hover:text-foreground transition-colors"
                      onClick={() => handleSort("payee")}
                    >
                      Payee<SortIcon column="payee" />
                    </button>
                    <button
                      className="shrink-0 w-[120px] text-left hover:text-foreground transition-colors"
                      onClick={() => handleSort("category")}
                    >
                      Category<SortIcon column="category" />
                    </button>
                    <button
                      className="shrink-0 w-[100px] text-left hover:text-foreground transition-colors"
                      onClick={() => handleSort("account")}
                    >
                      Account<SortIcon column="account" />
                    </button>
                    <button
                      className="shrink-0 w-[110px] text-right hover:text-foreground transition-colors"
                      onClick={() => handleSort("amount")}
                    >
                      Amount<SortIcon column="amount" />
                    </button>
                    <span className="shrink-0 w-6"></span>
                  </div>
                  <TooltipProvider delayDuration={300}>
                    <ScrollArea className="flex-1 min-h-0">
                      <div className="space-y-1">
                        {sortedTransactions.map((tx, index) => (
                          <TransactionRow
                            key={tx.id}
                            tx={tx}
                            index={index}
                            isSelected={selectedIds.has(tx.id)}
                            onSelect={handleSelectTransaction}
                            onEdit={handleOpenDialog}
                            onDelete={handleDelete}
                            getAccountName={getAccountName}
                            getCategoryName={getCategoryName}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  </TooltipProvider>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </PageContainer>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTransaction ? "Edit Transaction" : "Add Transaction"}
            </DialogTitle>
            <DialogDescription>
              {editingTransaction
                ? "Update transaction details"
                : "Add a new transaction"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Account</Label>
              <Select
                value={formData.accountId}
                onValueChange={(value) =>
                  setFormData({ ...formData, accountId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    className="pl-7"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                type="button"
                variant={formData.isExpense ? "default" : "outline"}
                className="flex-1"
                onClick={() => setFormData({ ...formData, isExpense: true })}
              >
                <ArrowUpRight className="h-4 w-4 mr-2" />
                Expense
              </Button>
              <Button
                type="button"
                variant={!formData.isExpense ? "default" : "outline"}
                className="flex-1"
                onClick={() => setFormData({ ...formData, isExpense: false })}
              >
                <ArrowDownRight className="h-4 w-4 mr-2" />
                Income
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Payee</Label>
              <Input
                value={formData.payee}
                onChange={(e) =>
                  setFormData({ ...formData, payee: e.target.value })
                }
                placeholder="e.g., Amazon, Starbucks"
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={formData.categoryId || "none"}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    categoryId: value === "none" ? "" : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Any additional notes..."
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingTransaction ? "Save Changes" : "Add Transaction"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onComplete={() => fetchTransactions()}
      />

      {/* Bulk Categorize Dialog */}
      <Dialog open={isCategorizeDialogOpen} onOpenChange={setIsCategorizeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Categorize Transactions</DialogTitle>
            <DialogDescription>
              Select a category for {selectedIds.size} selected transaction{selectedIds.size === 1 ? "" : "s"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={selectedCategoryId || "none"}
                onValueChange={(value) => setSelectedCategoryId(value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategorizeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkCategorize} disabled={!selectedCategoryId}>
              Apply Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Transaction{pendingDeleteIds.length === 1 ? "" : "s"}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {pendingDeleteIds.length} transaction{pendingDeleteIds.length === 1 ? "" : "s"}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
