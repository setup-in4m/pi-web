import { create } from "zustand";

interface SearchState {
  query: string;
  setQuery: (q: string) => void;
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: "",
  setQuery: (q) => set({ query: q }),
  isOpen: false,
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  close: () => set({ isOpen: false, query: "" }),
}));
