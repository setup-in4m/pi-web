import { create } from "zustand";
import type { WorkspaceData } from "../lib/api";
import * as api from "../lib/api";

interface WorkspaceState {
  workspaces: WorkspaceData[];
  loading: boolean;
  error: string | null;

  loadWorkspaces: () => Promise<void>;
  addWorkspace: (path: string) => Promise<void>;
  removeWorkspace: (path: string) => void;
  refreshWorkspace: (path: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  loading: false,
  error: null,

  loadWorkspaces: async () => {
    set({ loading: true, error: null });
    try {
      const { workspaces } = await api.fetchWorkspaces();
      const loaded: WorkspaceData[] = [];
      for (const w of workspaces) {
        try {
          const data = await api.fetchWorkspace(w.path);
          loaded.push(data);
        } catch {
          // skip inaccessible workspaces
        }
      }
      set({ workspaces: loaded, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  addWorkspace: async (path: string) => {
    try {
      const data = await api.fetchWorkspace(path);
      set((s) => ({
        workspaces: [data, ...s.workspaces.filter((w) => w.path !== path)],
      }));
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  removeWorkspace: (path: string) => {
    set((s) => ({
      workspaces: s.workspaces.filter((w) => w.path !== path),
    }));
  },

  refreshWorkspace: async (path: string) => {
    try {
      const data = await api.fetchWorkspace(path);
      set((s) => ({
        workspaces: s.workspaces.map((w) => (w.path === path ? data : w)),
      }));
    } catch {}
  },
}));
