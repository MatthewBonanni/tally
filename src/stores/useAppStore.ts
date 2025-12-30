import { create } from "zustand";

interface AppState {
  isUnlocked: boolean;
  isLoading: boolean;
  error: string | null;
  theme: "light" | "dark" | "system";
  sidebarCollapsed: boolean;

  setUnlocked: (unlocked: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isUnlocked: false,
  isLoading: false,
  error: null,
  theme: "system",
  sidebarCollapsed: false,

  setUnlocked: (unlocked) => set({ isUnlocked: unlocked }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
}));
