import { useEffect, useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Target, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { useCategoryStore } from "@/stores/useCategoryStore";
import {
  listBudgets,
  getBudgetSummary,
  createBudget,
  updateBudget,
  deleteBudget,
} from "@/lib/tauri";
import { formatMoney } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { Budget, Category } from "@/types";

interface BudgetSummary {
  budget: Budget;
  category: Category;
  spent: number;
  remaining: number;
}

export function Budgets() {
  const { categories, fetchCategories } = useCategoryStore();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [summaries, setSummaries] = useState<BudgetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);

  // Month navigation
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Form state
  const [formData, setFormData] = useState({
    categoryId: "",
    amount: "",
    periodType: "monthly",
    rollover: false,
  });

  useEffect(() => {
    fetchCategories();
    loadBudgets();
  }, [fetchCategories]);

  useEffect(() => {
    if (budgets.length > 0) {
      loadSummaries();
    }
  }, [budgets, currentMonth]);

  const loadBudgets = async () => {
    try {
      const data = await listBudgets();
      setBudgets(data);
    } catch (err) {
      console.error("Failed to load budgets:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadSummaries = async () => {
    try {
      const data = await getBudgetSummary(currentMonth);
      setSummaries(data);
    } catch (err) {
      console.error("Failed to load budget summaries:", err);
    }
  };

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.categoryType === "expense"),
    [categories]
  );

  const unusedCategories = useMemo(
    () => expenseCategories.filter((c) => !budgets.some((b) => b.categoryId === c.id)),
    [expenseCategories, budgets]
  );

  const navigateMonth = (direction: "prev" | "next") => {
    const parts = currentMonth.split("-").map(Number);
    const year = parts[0] ?? new Date().getFullYear();
    const month = parts[1] ?? 1;
    let newYear = year;
    let newMonth = month + (direction === "next" ? 1 : -1);

    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }

    setCurrentMonth(`${newYear}-${String(newMonth).padStart(2, "0")}`);
  };

  const formatMonthDisplay = (monthStr: string) => {
    const parts = monthStr.split("-").map(Number);
    const year = parts[0] ?? new Date().getFullYear();
    const month = parts[1] ?? 1;
    return new Date(year, month - 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  const handleCreate = () => {
    setSelectedBudget(null);
    setFormData({
      categoryId: unusedCategories[0]?.id || "",
      amount: "",
      periodType: "monthly",
      rollover: false,
    });
    setFormOpen(true);
  };

  const handleEdit = (budget: Budget) => {
    setSelectedBudget(budget);
    setFormData({
      categoryId: budget.categoryId,
      amount: String(budget.amount / 100),
      periodType: budget.periodType,
      rollover: budget.rollover,
    });
    setFormOpen(true);
  };

  const handleDelete = (budget: Budget) => {
    setSelectedBudget(budget);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedBudget) return;
    try {
      await deleteBudget(selectedBudget.id);
      await loadBudgets();
    } catch (err) {
      console.error("Failed to delete budget:", err);
    }
    setDeleteDialogOpen(false);
  };

  const handleSubmit = async () => {
    try {
      const data = {
        categoryId: formData.categoryId,
        amount: Math.round(parseFloat(formData.amount) * 100),
        periodType: formData.periodType as "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly",
        rollover: formData.rollover,
      };

      if (selectedBudget) {
        await updateBudget(selectedBudget.id, data);
      } else {
        await createBudget(data);
      }
      await loadBudgets();
      setFormOpen(false);
    } catch (err) {
      console.error("Failed to save budget:", err);
    }
  };

  // Calculate totals
  const totalBudgeted = summaries.reduce((sum, s) => sum + s.budget.amount, 0);
  const totalSpent = summaries.reduce((sum, s) => sum + s.spent, 0);
  const totalRemaining = totalBudgeted - totalSpent;

  return (
    <>
      <Header
        title="Budgets"
        actions={
          <Button onClick={handleCreate} disabled={unusedCategories.length === 0}>
            <Plus className="h-4 w-4 mr-2" />
            Add Budget
          </Button>
        }
      />
      <PageContainer>
        {/* Month Navigation */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => navigateMonth("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold min-w-[200px] text-center">
            {formatMonthDisplay(currentMonth)}
          </h2>
          <Button variant="outline" size="icon" onClick={() => navigateMonth("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Budgeted
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatMoney(totalBudgeted)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Spent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{formatMoney(totalSpent)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Remaining
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={cn(
                  "text-2xl font-bold",
                  totalRemaining >= 0 ? "text-green-600" : "text-red-600"
                )}
              >
                {formatMoney(totalRemaining)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Budget List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Category Budgets
            </CardTitle>
            <CardDescription>
              Set spending limits for each category
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading budgets...</p>
            ) : summaries.length === 0 ? (
              <div className="text-center py-8">
                <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  No budgets set. Create a budget to track your spending.
                </p>
                <Button onClick={handleCreate} disabled={unusedCategories.length === 0}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Budget
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {summaries.map((summary) => {
                  const percentUsed = Math.min(
                    (summary.spent / summary.budget.amount) * 100,
                    100
                  );
                  const isOverBudget = summary.spent > summary.budget.amount;

                  return (
                    <div
                      key={summary.budget.id}
                      className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-4 w-4 rounded-full"
                            style={{ backgroundColor: summary.category.color || "#6b7280" }}
                          />
                          <span className="font-medium">{summary.category.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(summary.budget)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(summary.budget)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Progress
                          value={percentUsed}
                          className={cn(
                            "h-3",
                            isOverBudget && "[&>div]:bg-red-500"
                          )}
                        />
                        <div className="flex justify-between text-sm">
                          <span className={cn(isOverBudget && "text-red-600")}>
                            {formatMoney(summary.spent)} spent
                          </span>
                          <span className="text-muted-foreground">
                            {formatMoney(summary.budget.amount)} budgeted
                          </span>
                        </div>
                        <div className="text-sm">
                          <span
                            className={cn(
                              "font-medium",
                              summary.remaining >= 0 ? "text-green-600" : "text-red-600"
                            )}
                          >
                            {summary.remaining >= 0
                              ? `${formatMoney(summary.remaining)} remaining`
                              : `${formatMoney(Math.abs(summary.remaining))} over budget`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedBudget ? "Edit Budget" : "Create Budget"}</DialogTitle>
              <DialogDescription>
                Set a monthly spending limit for a category.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.categoryId}
                  onValueChange={(v) => setFormData((p) => ({ ...p, categoryId: v }))}
                  disabled={!!selectedBudget}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {(selectedBudget
                      ? expenseCategories
                      : unusedCategories
                    ).map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Monthly Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData((p) => ({ ...p, amount: e.target.value }))}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.rollover}
                  onCheckedChange={(checked) => setFormData((p) => ({ ...p, rollover: checked }))}
                />
                <Label>Roll over unused budget to next month</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.categoryId || !formData.amount}
              >
                {selectedBudget ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Budget</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this budget? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageContainer>
    </>
  );
}
