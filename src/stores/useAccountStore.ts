import { create } from "zustand";
import type { Account } from "@/types";
import * as api from "@/lib/tauri";

interface AccountState {
  accounts: Account[];
  selectedAccountId: string | null;
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: number | null;

  fetchAccounts: () => Promise<void>;
  createAccount: (data: Omit<Account, "id" | "createdAt" | "updatedAt">) => Promise<Account>;
  updateAccount: (id: string, data: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  selectAccount: (id: string | null) => void;

  // Computed
  getAccountById: (id: string) => Account | undefined;
  getTotalAssets: () => number;
  getTotalLiabilities: () => number;
  getNetWorth: () => number;
}

export const useAccountStore = create<AccountState>((set, get) => ({
  accounts: [],
  selectedAccountId: null,
  isLoading: false,
  error: null,
  lastFetchedAt: null,

  fetchAccounts: async () => {
    // Only show loading state if we have no cached data
    const hasCache = get().accounts.length > 0;
    if (!hasCache) {
      set({ isLoading: true, error: null });
    }
    try {
      const accounts = await api.listAccounts();
      set({ accounts, isLoading: false, lastFetchedAt: Date.now() });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  createAccount: async (data) => {
    const account = await api.createAccount(data);
    set((state) => ({ accounts: [...state.accounts, account] }));
    return account;
  },

  updateAccount: async (id, data) => {
    const updated = await api.updateAccount(id, data);
    set((state) => ({
      accounts: state.accounts.map((a) => (a.id === id ? updated : a)),
    }));
  },

  deleteAccount: async (id) => {
    await api.deleteAccount(id);
    set((state) => ({
      accounts: state.accounts.filter((a) => a.id !== id),
      selectedAccountId: state.selectedAccountId === id ? null : state.selectedAccountId,
    }));
  },

  selectAccount: (id) => set({ selectedAccountId: id }),

  getAccountById: (id) => get().accounts.find((a) => a.id === id),

  getTotalAssets: () => {
    const assetTypes = ["checking", "savings", "investment", "cash"];
    return get()
      .accounts.filter((a) => assetTypes.includes(a.accountType) && a.isActive)
      .reduce((sum, a) => sum + a.currentBalance, 0);
  },

  getTotalLiabilities: () => {
    const liabilityTypes = ["credit_card", "loan"];
    return get()
      .accounts.filter((a) => liabilityTypes.includes(a.accountType) && a.isActive)
      .reduce((sum, a) => sum + Math.abs(a.currentBalance), 0);
  },

  getNetWorth: () => {
    return get().getTotalAssets() - get().getTotalLiabilities();
  },
}));
