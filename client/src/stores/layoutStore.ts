import { create } from "zustand";

export type LayoutPreset = "single" | "2h" | "2v" | "2x2" | "3h" | "3v" | "col3";

interface LayoutState {
  preset: LayoutPreset;
  savedSizes: Partial<Record<LayoutPreset, number[]>>;
  sidebarVisible: boolean;
  focusMode: boolean;

  setPreset: (preset: LayoutPreset) => void;
  saveSizes: (preset: LayoutPreset, sizes: number[]) => void;
  toggleSidebar: () => void;
  toggleFocusMode: () => void;
}

function loadLayout(): { preset: LayoutPreset; savedSizes: Partial<Record<LayoutPreset, number[]>>; sidebarVisible: boolean; focusMode: boolean } {
  try {
    const raw = localStorage.getItem("pi-web-layout");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { preset: "single", savedSizes: {}, sidebarVisible: true, focusMode: false };
}

function persist(state: { preset: LayoutPreset; savedSizes: Partial<Record<LayoutPreset, number[]>>; sidebarVisible: boolean; focusMode: boolean }) {
  localStorage.setItem("pi-web-layout", JSON.stringify(state));
}

export const useLayoutStore = create<LayoutState>((set, get) => {
  const initial = loadLayout();

  return {
    ...initial,

    setPreset: (preset) => {
      set({ preset });
      persist({ ...get(), preset });
    },

    saveSizes: (preset, sizes) => {
      set((s) => {
        const savedSizes = { ...s.savedSizes, [preset]: sizes };
        persist({ ...get(), savedSizes });
        return { savedSizes };
      });
    },

    toggleSidebar: () => {
      set((s) => {
        const sidebarVisible = !s.sidebarVisible;
        persist({ ...get(), sidebarVisible });
        return { sidebarVisible };
      });
    },

    toggleFocusMode: () => {
      set((s) => {
        const focusMode = !s.focusMode;
        persist({ ...get(), focusMode });
        return { focusMode };
      });
    },
  };
});

// Helper: calculate pane distribution for a given preset and panel count
export function getLayoutStructure(preset: LayoutPreset, count: number): { rows: number; cols: number; panes: { row: number; col: number; rowSpan?: number; colSpan?: number }[] } {
  // For most presets, we use Allotment which handles resize
  // This returns a flat pane list
  switch (preset) {
    case "single":
      return { rows: 1, cols: 1, panes: Array(count).fill(null).map((_, i) => ({ row: 0, col: i })) };
    case "2h":
      return { rows: 1, cols: count, panes: Array(count).fill(null).map((_, i) => ({ row: 0, col: i })) };
    case "2v":
      return { rows: count, cols: 1, panes: Array(count).fill(null).map((_, i) => ({ row: i, col: 0 })) };
    case "2x2":
      return {
        rows: 2, cols: 2,
        panes: Array(Math.min(count, 4)).fill(null).map((_, i) => ({ row: Math.floor(i / 2), col: i % 2 })),
      };
    case "3h":
      return { rows: 1, cols: count, panes: Array(count).fill(null).map((_, i) => ({ row: 0, col: i })) };
    case "3v":
      return { rows: count, cols: 1, panes: Array(count).fill(null).map((_, i) => ({ row: i, col: 0 })) };
    case "col3":
      return { rows: Math.max(1, Math.ceil(count / 3)), cols: Math.min(3, count), panes: Array(count).fill(null).map((_, i) => ({ row: Math.floor(i / 3), col: i % 3 })) };
    default:
      return { rows: 1, cols: 1, panes: [{ row: 0, col: 0 }] };
  }
}
