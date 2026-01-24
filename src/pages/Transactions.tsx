import { useEffect, useState, useMemo } from "react";
import {
  Plus,
  Search,
  Filter,
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
  const [formData, setFormData] = useState({
    accountId: "",
    date: getTodayString(),
    amount: "",
    isExpense: true,
    payee: "",
    categoryId: "",
    notes: "",
  });

  // Compute sum of selected transactions
  const selectedSum = useMemo(() => {
    return transactions
      .filter((tx) => selectedIds.has(tx.id))
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions, selectedIds]);

  // Sort transactions
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
          const catA = categories.find((c) => c.id === a.categoryId)?.name || "";
          const catB = categories.find((c) => c.id === b.categoryId)?.name || "";
          comparison = catA.localeCompare(catB);
          break;
        case "account":
          const accA = accounts.find((acc) => acc.id === a.accountId)?.name || "";
          const accB = accounts.find((acc) => acc.id === b.accountId)?.name || "";
          comparison = accA.localeCompare(accB);
          break;
        case "amount":
          comparison = a.amount - b.amount;
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [transactions, sortColumn, sortDirection, categories, accounts]);

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

  useEffect(() => {
    fetchTransactions();
    fetchAccounts();
    fetchCategories();
  }, [fetchTransactions, fetchAccounts, fetchCategories]);

  const handleOpenDialog = (transaction?: Transaction) => {
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
  };

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

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Delete ${selectedIds.size} transaction(s)?`)) {
      await deleteTransactions(Array.from(selectedIds));
    }
  };

  const handleBulkCategorize = async () => {
    if (selectedIds.size === 0 || !selectedCategoryId) return;
    await bulkCategorize(Array.from(selectedIds), selectedCategoryId);
    setIsCategorizeDialogOpen(false);
    setSelectedCategoryId("");
    clearSelection();
  };

  const getAccountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name || "Unknown";

  const getCategoryName = (id: string | null) =>
    id ? categories.find((c) => c.id === id)?.name || "Uncategorized" : "Uncategorized";

  const handleSelectTransaction = (index: number, event: React.MouseEvent) => {
    const tx = transactions[index];
    if (!tx) return;

    if (event.shiftKey && lastClickedIndex !== null) {
      // Shift-click: select range between last clicked and current
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      for (let i = start; i <= end; i++) {
        const t = transactions[i];
        if (t && !selectedIds.has(t.id)) {
          selectTransaction(t.id);
        }
      }
    } else {
      // Regular click: toggle single item
      selectTransaction(tx.id);
    }
    setLastClickedIndex(index);
  };

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
      <PageContainer>
        {/* Filters */}
        <Card className="mb-4">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search transactions..."
                    value={filters.searchQuery}
                    onChange={(e) => setFilters({ searchQuery: e.target.value })}
                    className="pl-9"
                  />
                </div>
              </div>
              <Select
                value={filters.accountId || "all"}
                onValueChange={(value) =>
                  setFilters({ accountId: value === "all" ? null : value })
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Accounts" />
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
              <Input
                type="date"
                value={filters.startDate || ""}
                onChange={(e) => setFilters({ startDate: e.target.value || null })}
                className="w-[150px]"
              />
              <span className="flex items-center text-muted-foreground">to</span>
              <Input
                type="date"
                value={filters.endDate || ""}
                onChange={(e) => setFilters({ endDate: e.target.value || null })}
                className="w-[150px]"
              />
              <Button variant="outline" onClick={() => fetchTransactions()}>
                <Filter className="h-4 w-4 mr-2" />
                Apply
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Transaction List */}
        <Card>
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
                      onClick={handleDelete}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
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
              <>
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
                <ScrollArea className="h-[500px]">
                  <div className="space-y-1">
                    {sortedTransactions.map((tx, index) => (
                    <div
                      key={tx.id}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1 rounded hover:bg-accent transition-colors overflow-hidden select-none",
                        selectedIds.has(tx.id) && "bg-accent"
                      )}
                    >
                      <div
                        className="shrink-0"
                        onClick={(e) => handleSelectTransaction(index, e)}
                      >
                        <Checkbox
                          checked={selectedIds.has(tx.id)}
                          onCheckedChange={() => {}}
                          className="pointer-events-none"
                        />
                      </div>
                      <span className="text-sm text-muted-foreground shrink-0 w-[100px] whitespace-nowrap">
                        {formatDate(tx.date)}
                      </span>
                      <TooltipProvider delayDuration={300}>
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
                      </TooltipProvider>
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
                          <DropdownMenuItem onClick={() => handleOpenDialog(tx)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => deleteTransactions([tx.id])}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                  </div>
                </ScrollArea>
              </>
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
    </>
  );
}
