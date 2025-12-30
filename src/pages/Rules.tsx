import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Wand2, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { useCategoryStore } from "@/stores/useCategoryStore";
import {
  listCategoryRules,
  createCategoryRule,
  updateCategoryRule,
  deleteCategoryRule,
  applyCategoryRules,
} from "@/lib/tauri";
import type { CategoryRule } from "@/types";

const RULE_TYPES = [
  { value: "payee_contains", label: "Payee Contains" },
  { value: "payee_exact", label: "Payee Exact Match" },
  { value: "payee_starts_with", label: "Payee Starts With" },
  { value: "payee_regex", label: "Payee Regex" },
];

export function Rules() {
  const { categories, fetchCategories } = useCategoryStore();
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<CategoryRule | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    categoryId: "",
    ruleType: "payee_contains",
    pattern: "",
    amountMin: "",
    amountMax: "",
    priority: "0",
    isActive: true,
  });

  useEffect(() => {
    fetchCategories();
    loadRules();
  }, [fetchCategories]);

  const loadRules = async () => {
    try {
      const data = await listCategoryRules();
      setRules(data);
    } catch (err) {
      console.error("Failed to load rules:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedRule(null);
    setFormData({
      categoryId: categories[0]?.id || "",
      ruleType: "payee_contains",
      pattern: "",
      amountMin: "",
      amountMax: "",
      priority: "0",
      isActive: true,
    });
    setFormOpen(true);
  };

  const handleEdit = (rule: CategoryRule) => {
    setSelectedRule(rule);
    setFormData({
      categoryId: rule.categoryId,
      ruleType: rule.ruleType,
      pattern: rule.pattern,
      amountMin: rule.amountMin ? String(rule.amountMin / 100) : "",
      amountMax: rule.amountMax ? String(rule.amountMax / 100) : "",
      priority: String(rule.priority),
      isActive: rule.isActive,
    });
    setFormOpen(true);
  };

  const handleDelete = (rule: CategoryRule) => {
    setSelectedRule(rule);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedRule) return;
    try {
      await deleteCategoryRule(selectedRule.id);
      await loadRules();
    } catch (err) {
      console.error("Failed to delete rule:", err);
    }
    setDeleteDialogOpen(false);
  };

  const handleSubmit = async () => {
    try {
      const data = {
        categoryId: formData.categoryId,
        ruleType: formData.ruleType,
        pattern: formData.pattern,
        amountMin: formData.amountMin ? Math.round(parseFloat(formData.amountMin) * 100) : null,
        amountMax: formData.amountMax ? Math.round(parseFloat(formData.amountMax) * 100) : null,
        priority: parseInt(formData.priority) || 0,
        isActive: formData.isActive,
      };

      if (selectedRule) {
        await updateCategoryRule(selectedRule.id, data);
      } else {
        await createCategoryRule(data);
      }
      await loadRules();
      setFormOpen(false);
    } catch (err) {
      console.error("Failed to save rule:", err);
    }
  };

  const handleApplyRules = async () => {
    setApplying(true);
    setApplyResult(null);
    try {
      const count = await applyCategoryRules();
      setApplyResult(count);
    } catch (err) {
      console.error("Failed to apply rules:", err);
    } finally {
      setApplying(false);
    }
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || "Unknown";
  };

  const getRuleTypeLabel = (ruleType: string) => {
    return RULE_TYPES.find((t) => t.value === ruleType)?.label || ruleType;
  };

  return (
    <>
      <Header
        title="Auto-Categorization Rules"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleApplyRules} disabled={applying}>
              <Play className="h-4 w-4 mr-2" />
              {applying ? "Applying..." : "Apply Rules"}
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </div>
        }
      />
      <PageContainer>
        {applyResult !== null && (
          <Card className="mb-4 border-green-500 bg-green-50 dark:bg-green-950">
            <CardContent className="py-4">
              <p className="text-green-700 dark:text-green-300">
                Successfully categorized {applyResult} transaction{applyResult !== 1 ? "s" : ""} using rules.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Category Rules
            </CardTitle>
            <CardDescription>
              Rules automatically categorize transactions based on payee names and amounts.
              Higher priority rules are checked first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading rules...</p>
            ) : rules.length === 0 ? (
              <div className="text-center py-8">
                <Wand2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  No rules yet. Create a rule to automatically categorize transactions.
                </p>
                <Button onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Rule
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <Badge variant={rule.isActive ? "default" : "secondary"}>
                          {rule.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Priority: {rule.priority}
                        </span>
                      </div>
                      <p className="font-medium">
                        When <span className="text-primary">{getRuleTypeLabel(rule.ruleType)}</span>{" "}
                        &quot;<code className="bg-muted px-1 rounded">{rule.pattern}</code>&quot;
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Set category to{" "}
                        <Badge variant="outline">{getCategoryName(rule.categoryId)}</Badge>
                        {(rule.amountMin || rule.amountMax) && (
                          <span>
                            {" "}
                            (Amount: {rule.amountMin ? `$${(rule.amountMin / 100).toFixed(2)}` : "$0"}
                            {" - "}
                            {rule.amountMax ? `$${(rule.amountMax / 100).toFixed(2)}` : "any"})
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(rule)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(rule)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedRule ? "Edit Rule" : "Create Rule"}</DialogTitle>
              <DialogDescription>
                Define a pattern to automatically categorize matching transactions.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Rule Type</Label>
                <Select
                  value={formData.ruleType}
                  onValueChange={(v) => setFormData((p) => ({ ...p, ruleType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Pattern</Label>
                <Input
                  value={formData.pattern}
                  onChange={(e) => setFormData((p) => ({ ...p, pattern: e.target.value }))}
                  placeholder={
                    formData.ruleType === "payee_regex"
                      ? ".*amazon.*"
                      : "Amazon"
                  }
                />
                <p className="text-sm text-muted-foreground">
                  {formData.ruleType === "payee_contains" && "Match if payee contains this text (case-insensitive)"}
                  {formData.ruleType === "payee_exact" && "Match if payee exactly matches this text (case-insensitive)"}
                  {formData.ruleType === "payee_starts_with" && "Match if payee starts with this text (case-insensitive)"}
                  {formData.ruleType === "payee_regex" && "Match using regular expression pattern"}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.categoryId}
                  onValueChange={(v) => setFormData((p) => ({ ...p, categoryId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Min Amount (optional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amountMin}
                    onChange={(e) => setFormData((p) => ({ ...p, amountMin: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Amount (optional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amountMax}
                    onChange={(e) => setFormData((p) => ({ ...p, amountMax: e.target.value }))}
                    placeholder="1000.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData((p) => ({ ...p, priority: e.target.value }))}
                  placeholder="0"
                />
                <p className="text-sm text-muted-foreground">
                  Higher numbers are checked first. Use this to prioritize specific rules.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData((p) => ({ ...p, isActive: checked }))}
                />
                <Label>Active</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!formData.pattern || !formData.categoryId}>
                {selectedRule ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Rule</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this rule? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageContainer>
    </>
  );
}
