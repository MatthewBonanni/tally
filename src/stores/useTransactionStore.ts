import { create } from "zustand";
import type { Transaction, TransactionFilters, TransferCandidate } from "@/types";
import * as api from "@/lib/tauri";

interface TransactionState {
  transactions: Transaction[];
  selectedIds: Set<string>;
  filters: TransactionFilters;
  transferCandidates: TransferCandidate[];
  isLoading: boolean;
  error: string | null;

  fetchTransactions: (filters?: Partial<TransactionFilters>) => Promise<void>;
  createTransaction: (data: Omit<Transaction, "id" | "createdAt" | "updatedAt">) => Promise<Transaction>;
  updateTransaction: (id: string, data: Partial<Transaction>) => Promise<void>;
  deleteTransactions: (ids: string[]) => Promise<void>;
  bulkCategorize: (ids: string[], categoryId: string) => Promise<void>;
  detectTransfers: () => Promise<void>;
  linkTransfer: (transactionAId: string, transactionBId: string) => Promise<void>;

  selectTransaction: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setFilters: (filters: Partial<TransactionFilters>) => void;
  resetFilters: () => void;
}

const defaultFilters: TransactionFilters = {
  accountId: null,
  categoryId: null,
  startDate: null,
  endDate: null,
  searchQuery: "",
  status: null,
  minAmount: null,
  maxAmount: null,
  isTransfer: null,
};

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  selectedIds: new Set(),
  filters: defaultFilters,
  transferCandidates: [],
  isLoading: false,
  error: null,

  fetchTransactions: async (filters) => {
    const mergedFilters = { ...get().filters, ...filters };
    set({ isLoading: true, error: null });
    try {
      const transactions = await api.listTransactions(mergedFilters);
      set({ transactions, filters: mergedFilters, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  createTransaction: async (data) => {
    const transaction = await api.createTransaction(data);
    set((state) => ({
      transactions: [transaction, ...state.transactions],
    }));
    return transaction;
  },

  updateTransaction: async (id, data) => {
    const updated = await api.updateTransaction(id, data);
    set((state) => ({
      transactions: state.transactions.map((t) => (t.id === id ? updated : t)),
    }));
  },

  deleteTransactions: async (ids) => {
    await api.deleteTransactions(ids);
    set((state) => ({
      transactions: state.transactions.filter((t) => !ids.includes(t.id)),
      selectedIds: new Set(),
    }));
  },

  bulkCategorize: async (ids, categoryId) => {
    await api.bulkCategorize(ids, categoryId);
    set((state) => ({
      transactions: state.transactions.map((t) =>
        ids.includes(t.id) ? { ...t, categoryId } : t
      ),
      selectedIds: new Set(),
    }));
  },

  detectTransfers: async () => {
    const candidates = await api.detectTransfers();
    set({ transferCandidates: candidates });
  },

  linkTransfer: async (transactionAId, transactionBId) => {
    await api.linkTransfer(transactionAId, transactionBId);
    // Refetch to get updated transfer links
    await get().fetchTransactions();
    // Remove from candidates
    set((state) => ({
      transferCandidates: state.transferCandidates.filter(
        (c) =>
          c.transactionA.id !== transactionAId &&
          c.transactionB.id !== transactionBId
      ),
    }));
  },

  selectTransaction: (id) => {
    set((state) => {
      const newSelected = new Set(state.selectedIds);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return { selectedIds: newSelected };
    });
  },

  selectAll: () => {
    set((state) => ({
      selectedIds: new Set(state.transactions.map((t) => t.id)),
    }));
  },

  clearSelection: () => {
    set({ selectedIds: new Set() });
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
  },

  resetFilters: () => {
    set({ filters: defaultFilters });
  },
}));
