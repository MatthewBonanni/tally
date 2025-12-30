import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Flag, Check, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
import { useAccountStore } from "@/stores/useAccountStore";
import {
  listGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  contributeToGoal,
} from "@/lib/tauri";
import { formatMoney } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { Goal } from "@/types";

const GOAL_TYPES = [
  { value: "savings", label: "Savings Goal" },
  { value: "debt_payoff", label: "Debt Payoff" },
  { value: "spending_limit", label: "Spending Limit" },
];

const GOAL_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
  "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6",
  "#a855f7", "#ec4899",
];

export function Goals() {
  const { accounts, fetchAccounts } = useAccountStore();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [contributeOpen, setContributeOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    goalType: "savings",
    targetAmount: "",
    currentAmount: "",
    targetDate: "",
    linkedAccountId: "",
    color: GOAL_COLORS[0],
  });

  // Contribution state
  const [contributionAmount, setContributionAmount] = useState("");

  useEffect(() => {
    fetchAccounts();
    loadGoals();
  }, [fetchAccounts]);

  const loadGoals = async () => {
    try {
      const data = await listGoals();
      setGoals(data);
    } catch (err) {
      console.error("Failed to load goals:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedGoal(null);
    setFormData({
      name: "",
      goalType: "savings",
      targetAmount: "",
      currentAmount: "0",
      targetDate: "",
      linkedAccountId: "",
      color: GOAL_COLORS[Math.floor(Math.random() * GOAL_COLORS.length)],
    });
    setFormOpen(true);
  };

  const handleEdit = (goal: Goal) => {
    setSelectedGoal(goal);
    setFormData({
      name: goal.name,
      goalType: goal.goalType,
      targetAmount: String(goal.targetAmount / 100),
      currentAmount: String(goal.currentAmount / 100),
      targetDate: goal.targetDate || "",
      linkedAccountId: goal.linkedAccountId || "",
      color: goal.color || GOAL_COLORS[0],
    });
    setFormOpen(true);
  };

  const handleContribute = (goal: Goal) => {
    setSelectedGoal(goal);
    setContributionAmount("");
    setContributeOpen(true);
  };

  const handleDelete = (goal: Goal) => {
    setSelectedGoal(goal);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedGoal) return;
    try {
      await deleteGoal(selectedGoal.id);
      await loadGoals();
    } catch (err) {
      console.error("Failed to delete goal:", err);
    }
    setDeleteDialogOpen(false);
  };

  const handleSubmit = async () => {
    try {
      const data = {
        name: formData.name,
        goalType: formData.goalType,
        targetAmount: Math.round(parseFloat(formData.targetAmount) * 100),
        currentAmount: Math.round(parseFloat(formData.currentAmount || "0") * 100),
        targetDate: formData.targetDate || null,
        linkedAccountId: formData.linkedAccountId || null,
        color: formData.color,
      };

      if (selectedGoal) {
        await updateGoal(selectedGoal.id, data);
      } else {
        await createGoal(data as Parameters<typeof createGoal>[0]);
      }
      await loadGoals();
      setFormOpen(false);
    } catch (err) {
      console.error("Failed to save goal:", err);
    }
  };

  const handleContributeSubmit = async () => {
    if (!selectedGoal) return;
    try {
      const amount = Math.round(parseFloat(contributionAmount) * 100);
      await contributeToGoal(selectedGoal.id, amount);
      await loadGoals();
      setContributeOpen(false);
    } catch (err) {
      console.error("Failed to contribute:", err);
    }
  };

  const activeGoals = goals.filter((g) => !g.isAchieved);
  const achievedGoals = goals.filter((g) => g.isAchieved);

  const calculateDaysRemaining = (targetDate: string | null) => {
    if (!targetDate) return null;
    const target = new Date(targetDate);
    const today = new Date();
    const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <>
      <Header
        title="Goals"
        actions={
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Goal
          </Button>
        }
      />
      <PageContainer>
        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Goals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{activeGoals.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Target
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatMoney(activeGoals.reduce((sum, g) => sum + g.targetAmount, 0))}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Saved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">
                {formatMoney(activeGoals.reduce((sum, g) => sum + g.currentAmount, 0))}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Active Goals */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5" />
              Active Goals
            </CardTitle>
            <CardDescription>
              Track your progress towards financial goals
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading goals...</p>
            ) : activeGoals.length === 0 ? (
              <div className="text-center py-8">
                <Flag className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  No goals yet. Create a goal to start tracking your progress.
                </p>
                <Button onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Goal
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeGoals.map((goal) => {
                  const percentComplete = Math.min(
                    (goal.currentAmount / goal.targetAmount) * 100,
                    100
                  );
                  const remaining = goal.targetAmount - goal.currentAmount;
                  const daysRemaining = calculateDaysRemaining(goal.targetDate);

                  return (
                    <Card key={goal.id} className="relative overflow-hidden">
                      <div
                        className="absolute top-0 left-0 right-0 h-1"
                        style={{ backgroundColor: goal.color || "#3b82f6" }}
                      />
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{goal.name}</CardTitle>
                          <Badge variant="outline">
                            {GOAL_TYPES.find((t) => t.value === goal.goalType)?.label}
                          </Badge>
                        </div>
                        {goal.targetDate && (
                          <CardDescription>
                            {daysRemaining !== null && daysRemaining >= 0
                              ? `${daysRemaining} days remaining`
                              : "Target date passed"}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>{formatMoney(goal.currentAmount)}</span>
                            <span className="text-muted-foreground">
                              of {formatMoney(goal.targetAmount)}
                            </span>
                          </div>
                          <Progress
                            value={percentComplete}
                            className="h-3"
                            style={
                              {
                                "--progress-background": goal.color || "#3b82f6",
                              } as React.CSSProperties
                            }
                          />
                          <p className="text-sm text-muted-foreground mt-1">
                            {formatMoney(remaining)} to go ({percentComplete.toFixed(0)}%)
                          </p>
                        </div>

                        <div className="flex justify-between">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleContribute(goal)}
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            Add Funds
                          </Button>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(goal)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(goal)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Achieved Goals */}
        {achievedGoals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <Check className="h-5 w-5" />
                Achieved Goals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {achievedGoals.map((goal) => (
                  <div
                    key={goal.id}
                    className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Check className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium">{goal.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatMoney(goal.targetAmount)} achieved
                          {goal.achievedAt && ` on ${new Date(goal.achievedAt).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(goal)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedGoal ? "Edit Goal" : "Create Goal"}</DialogTitle>
              <DialogDescription>
                Set a financial goal to track your progress.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Goal Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g., Emergency Fund, Vacation, Pay off credit card"
                />
              </div>

              <div className="space-y-2">
                <Label>Goal Type</Label>
                <Select
                  value={formData.goalType}
                  onValueChange={(v) => setFormData((p) => ({ ...p, goalType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GOAL_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Target Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.targetAmount}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, targetAmount: e.target.value }))
                      }
                      placeholder="0.00"
                      className="pl-7"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Current Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.currentAmount}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, currentAmount: e.target.value }))
                      }
                      placeholder="0.00"
                      className="pl-7"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Target Date (optional)</Label>
                <Input
                  type="date"
                  value={formData.targetDate}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, targetDate: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Link to Account (optional)</Label>
                <Select
                  value={formData.linkedAccountId}
                  onValueChange={(v) =>
                    setFormData((p) => ({ ...p, linkedAccountId: v === "none" ? "" : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No linked account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked account</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {GOAL_COLORS.map((color) => (
                    <button
                      key={color}
                      className={cn(
                        "h-8 w-8 rounded-full border-2 transition-transform hover:scale-110",
                        formData.color === color
                          ? "border-primary scale-110"
                          : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData((p) => ({ ...p, color }))}
                    />
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.name || !formData.targetAmount}
              >
                {selectedGoal ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Contribute Dialog */}
        <Dialog open={contributeOpen} onOpenChange={setContributeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Funds to Goal</DialogTitle>
              <DialogDescription>
                Add a contribution to &quot;{selectedGoal?.name}&quot;
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    value={contributionAmount}
                    onChange={(e) => setContributionAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                    autoFocus
                  />
                </div>
                {selectedGoal && (
                  <p className="text-sm text-muted-foreground">
                    Current: {formatMoney(selectedGoal.currentAmount)} /{" "}
                    {formatMoney(selectedGoal.targetAmount)}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setContributeOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleContributeSubmit} disabled={!contributionAmount}>
                Add Funds
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Goal</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;{selectedGoal?.name}&quot;? This action
                cannot be undone.
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
