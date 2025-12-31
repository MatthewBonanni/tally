import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

const CATEGORY_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e",
];

export function Categories() {
  const {
    categories,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  } = useCategoryStore();
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    categoryType: "expense",
    parentId: "",
    color: CATEGORY_COLORS[0],
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      await fetchCategories();
    } catch (err) {
      console.error("Failed to load categories:", err);
    } finally {
      setLoading(false);
    }
  };

  // Build hierarchical category tree
  const buildCategoryTree = (categories: Category[], parentId: string | null = null): Category[] => {
    return categories
      .filter((c) => c.parentId === parentId)
      .map((category) => ({
        ...category,
        children: buildCategoryTree(categories, category.id),
      }));
  };

  const categoryTree = buildCategoryTree(categories);

  const toggleExpand = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleCreate = (parentId?: string) => {
    setSelectedCategory(null);
    setFormData({
      name: "",
      categoryType: "expense",
      parentId: parentId || "",
      color: CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)],
    });
    setFormOpen(true);
  };

  const handleEdit = (category: Category) => {
    setSelectedCategory(category);
    setFormData({
      name: category.name,
      categoryType: category.categoryType,
      parentId: category.parentId || "",
      color: category.color || CATEGORY_COLORS[0],
    });
    setFormOpen(true);
  };

  const handleDelete = (category: Category) => {
    setSelectedCategory(category);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedCategory) return;
    try {
      await deleteCategory(selectedCategory.id);
      await fetchCategories();
    } catch (err) {
      console.error("Failed to delete category:", err);
    }
    setDeleteDialogOpen(false);
  };

  const handleSubmit = async () => {
    try {
      const data = {
        name: formData.name,
        categoryType: formData.categoryType as "income" | "expense" | "transfer",
        parentId: formData.parentId || null,
        color: formData.color,
      };

      if (selectedCategory) {
        await updateCategory(selectedCategory.id, data);
      } else {
        await createCategory(data as Parameters<typeof createCategory>[0]);
      }
      await fetchCategories();
      setFormOpen(false);
    } catch (err) {
      console.error("Failed to save category:", err);
    }
  };

  const renderCategoryItem = (category: Category, depth = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedCategories.has(category.id);

    return (
      <div key={category.id}>
        <div
          className={cn(
            "flex items-center justify-between gap-2 p-3 hover:bg-accent/50 rounded-lg transition-colors",
            depth > 0 && "ml-6"
          )}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {hasChildren ? (
              <button
                className="p-1 hover:bg-accent rounded shrink-0"
                onClick={() => toggleExpand(category.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <div className="w-6 shrink-0" />
            )}
            <div
              className="h-4 w-4 rounded-full shrink-0"
              style={{ backgroundColor: category.color || "#6b7280" }}
            />
            <span className="font-medium truncate">{category.name}</span>
            {category.isSystem && (
              <Badge variant="secondary" className="text-xs shrink-0">System</Badge>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant="outline" className="text-xs hidden sm:inline-flex">
              {category.categoryType}
            </Badge>
            {!category.isSystem && (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCreate(category.id)}>
                  <Plus className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(category)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(category)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div className="border-l-2 border-muted ml-6">
            {category.children!.map((child) => renderCategoryItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Get top-level categories for parent selection
  const topLevelCategories = categories.filter((c) => !c.parentId);

  return (
    <>
      <Header
        title="Categories"
        actions={
          <Button onClick={() => handleCreate()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        }
      />
      <PageContainer>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Expense Categories */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-red-600">Expense Categories</CardTitle>
              <CardDescription>Track where your money goes</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : (
                <div className="space-y-1">
                  {categoryTree
                    .filter((c) => c.categoryType === "expense")
                    .map((category) => renderCategoryItem(category))}
                  {categoryTree.filter((c) => c.categoryType === "expense").length === 0 && (
                    <p className="text-muted-foreground text-center py-4">No expense categories</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Income Categories */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-green-600">Income Categories</CardTitle>
              <CardDescription>Track where your money comes from</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : (
                <div className="space-y-1">
                  {categoryTree
                    .filter((c) => c.categoryType === "income")
                    .map((category) => renderCategoryItem(category))}
                  {categoryTree.filter((c) => c.categoryType === "income").length === 0 && (
                    <p className="text-muted-foreground text-center py-4">No income categories</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transfer Category */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-blue-600">Transfer Categories</CardTitle>
              <CardDescription>For moving money between accounts</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : (
                <div className="space-y-1">
                  {categoryTree
                    .filter((c) => c.categoryType === "transfer")
                    .map((category) => renderCategoryItem(category))}
                  {categoryTree.filter((c) => c.categoryType === "transfer").length === 0 && (
                    <p className="text-muted-foreground text-center py-4">No transfer categories</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Create/Edit Dialog */}
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedCategory ? "Edit Category" : "Create Category"}</DialogTitle>
              <DialogDescription>
                {selectedCategory
                  ? "Update the category details."
                  : "Create a new category to organize your transactions."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Category name"
                />
              </div>

              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={formData.categoryType}
                  onValueChange={(v) => setFormData((p) => ({ ...p, categoryType: v }))}
                  disabled={!!selectedCategory?.isSystem}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Parent Category (optional)</Label>
                <Select
                  value={formData.parentId}
                  onValueChange={(v) => setFormData((p) => ({ ...p, parentId: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No parent (top-level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No parent (top-level)</SelectItem>
                    {topLevelCategories
                      .filter((c) => c.id !== selectedCategory?.id)
                      .map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_COLORS.map((color) => (
                    <button
                      key={color}
                      className={cn(
                        "h-8 w-8 rounded-full border-2 transition-transform hover:scale-110",
                        formData.color === color ? "border-primary scale-110" : "border-transparent"
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
              <Button onClick={handleSubmit} disabled={!formData.name}>
                {selectedCategory ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Category</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;{selectedCategory?.name}&quot;?
                Transactions using this category will become uncategorized.
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
