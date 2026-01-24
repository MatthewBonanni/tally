import { create } from "zustand";
import type { Category, CategoryRule } from "@/types";
import * as api from "@/lib/tauri";

interface CategoryState {
  categories: Category[];
  rules: CategoryRule[];
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: number | null;

  fetchCategories: () => Promise<void>;
  createCategory: (data: Omit<Category, "id" | "createdAt" | "updatedAt" | "isSystem">) => Promise<Category>;
  updateCategory: (id: string, data: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  fetchRules: () => Promise<void>;
  createRule: (data: Omit<CategoryRule, "id" | "createdAt" | "updatedAt">) => Promise<CategoryRule>;
  updateRule: (id: string, data: Partial<CategoryRule>) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  applyRules: (transactionIds?: string[]) => Promise<number>;

  // Computed
  getCategoryById: (id: string) => Category | undefined;
  getCategoryTree: () => Category[];
  getCategoriesByType: (type: "income" | "expense" | "transfer") => Category[];
}

export const useCategoryStore = create<CategoryState>((set, get) => ({
  categories: [],
  rules: [],
  isLoading: false,
  error: null,
  lastFetchedAt: null,

  fetchCategories: async () => {
    // Only show loading state if we have no cached data
    const hasCache = get().categories.length > 0;
    if (!hasCache) {
      set({ isLoading: true, error: null });
    }
    try {
      const categories = await api.listCategories();
      set({ categories, isLoading: false, lastFetchedAt: Date.now() });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  createCategory: async (data) => {
    const category = await api.createCategory(data);
    set((state) => ({ categories: [...state.categories, category] }));
    return category;
  },

  updateCategory: async (id, data) => {
    const updated = await api.updateCategory(id, data);
    set((state) => ({
      categories: state.categories.map((c) => (c.id === id ? updated : c)),
    }));
  },

  deleteCategory: async (id) => {
    await api.deleteCategory(id);
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== id),
    }));
  },

  fetchRules: async () => {
    try {
      const rules = await api.listCategoryRules();
      set({ rules });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  createRule: async (data) => {
    const rule = await api.createCategoryRule(data);
    set((state) => ({ rules: [...state.rules, rule] }));
    return rule;
  },

  updateRule: async (id, data) => {
    const updated = await api.updateCategoryRule(id, data);
    set((state) => ({
      rules: state.rules.map((r) => (r.id === id ? updated : r)),
    }));
  },

  deleteRule: async (id) => {
    await api.deleteCategoryRule(id);
    set((state) => ({
      rules: state.rules.filter((r) => r.id !== id),
    }));
  },

  applyRules: async (transactionIds) => {
    return api.applyCategoryRules(transactionIds);
  },

  getCategoryById: (id) => get().categories.find((c) => c.id === id),

  getCategoryTree: () => {
    const categories = get().categories;
    const rootCategories = categories.filter((c) => !c.parentId);
    return rootCategories.map((parent) => ({
      ...parent,
      children: categories.filter((c) => c.parentId === parent.id),
    }));
  },

  getCategoriesByType: (type) => {
    return get().categories.filter((c) => c.categoryType === type);
  },
}));
