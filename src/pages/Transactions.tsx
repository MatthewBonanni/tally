import { useEffect, useState } from "react";
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
  Link2,
  Upload,
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
    selectTransaction,
    selectAll,
    clearSelection,
    setFilters,
  } = useTransactionStore();
  const { accounts, fetchAccounts } = useAccountStore();
  const { categories, fetchCategories } = useCategoryStore();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [formData, setFormData] = useState({
    accountId: "",
    date: getTodayString(),
    amount: "",
    isExpense: true,
    payee: "",
    categoryId: "",
    notes: "",
  });

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

  const getAccountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name || "Unknown";

  const getCategoryName = (id: string | null) =>
    id ? categories.find((c) => c.id === id)?.name || "Uncategorized" : "Uncategorized";

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

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <Card className="mb-4 bg-primary/5 border-primary/20">
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {selectedIds.size} selected
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={clearSelection}>
                    Clear
                  </Button>
                  <Button variant="outline" size="sm">
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
              </div>
            </CardContent>
          </Card>
        )}

        {/* Transaction List */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>All Transactions</CardTitle>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={
                    transactions.length > 0 &&
                    selectedIds.size === transactions.length
                  }
                  onCheckedChange={(checked) =>
                    checked ? selectAll() : clearSelection()
                  }
                />
                <span className="text-sm text-muted-foreground">Select all</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-1">
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
                  transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors",
                        selectedIds.has(tx.id) && "bg-accent"
                      )}
                    >
                      <Checkbox
                        checked={selectedIds.has(tx.id)}
                        onCheckedChange={() => selectTransaction(tx.id)}
                      />
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-full shrink-0",
                          tx.amount >= 0
                            ? "bg-green-100 text-green-600"
                            : "bg-red-100 text-red-600"
                        )}
                      >
                        {tx.transferId ? (
                          <ArrowLeftRight className="h-5 w-5" />
                        ) : tx.amount >= 0 ? (
                          <ArrowDownRight className="h-5 w-5" />
                        ) : (
                          <ArrowUpRight className="h-5 w-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">
                            {tx.payee || "Unknown"}
                          </p>
                          {tx.transferId && (
                            <Link2 className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{formatDate(tx.date)}</span>
                          <span>•</span>
                          <span>{getAccountName(tx.accountId)}</span>
                          <span>•</span>
                          <span>{getCategoryName(tx.categoryId)}</span>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "font-semibold shrink-0",
                          tx.amount >= 0 ? "text-green-600" : "text-red-600"
                        )}
                      >
                        {formatMoney(tx.amount)}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
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
                  ))
                )}
              </div>
            </ScrollArea>
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
    </>
  );
}
