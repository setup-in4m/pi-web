import { create } from "zustand";
import type { WorkspaceData, UsageInfo } from "../lib/api";
import * as api from "../lib/api";

export type SortMode = "newest" | "oldest" | "az" | "za";

const PAGE_SIZE = 50;

interface WorkspaceState {
  workspaces: WorkspaceData[];
  loading: boolean;
  error: string | null;
  usageCache: Record<string, UsageInfo>;
  hasMore: Record<string, boolean>;   // workspace path → has more sessions
  sessionOffset: Record<string, number>; // workspace path → loaded offset

  loadWorkspaces: () => Promise<void>;
  addWorkspace: (path: string) => Promise<void>;
  removeWorkspace: (path: string) => void;
  removeWorkspaceRemote: (path: string) => Promise<void>;
  refreshWorkspace: (path: string) => Promise<void>;
  loadMoreSessions: (workspacePath: string) => Promise<void>;
  deleteSession: (workspacePath: string, sessionId: string) => Promise<void>;
  fetchSessionUsage: (workspacePath: string, sessionId: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  loading: false,
  error: null,
  usageCache: {},
  hasMore: {},
  sessionOffset: {},

  loadWorkspaces: async () => {
    set({ loading: true });
    try {
      const { workspaces } = await api.fetchWorkspaces();
      const loaded: WorkspaceData[] = [];
      const newHasMore: Record<string, boolean> = {};
      const newOffset: Record<string, number> = {};
      for (const w of workspaces) {
        try {
          const data = await api.fetchWorkspace(w.path, PAGE_SIZE, 0);
          loaded.push(data);
          newHasMore[w.path] = data.sessions.length >= PAGE_SIZE;
          newOffset[w.path] = data.sessions.length;
        } catch {
          // skip inaccessible workspaces
        }
      }
      set({ workspaces: loaded, loading: false, error: null, hasMore: newHasMore, sessionOffset: newOffset });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  addWorkspace: async (path: string) => {
    try {
      const data = await api.fetchWorkspace(path, PAGE_SIZE, 0);
      set((s) => ({
        workspaces: [data, ...s.workspaces.filter((w) => w.path !== path)],
        hasMore: { ...s.hasMore, [path]: data.sessions.length >= PAGE_SIZE },
        sessionOffset: { ...s.sessionOffset, [path]: data.sessions.length },
        error: null,
      }));
    } catch (e: any) {
      set({ error: e.message });
      throw e;
    }
  },

  removeWorkspace: (path: string) => {
    set((s) => ({
      workspaces: s.workspaces.filter((w) => w.path !== path),
    }));
  },

  removeWorkspaceRemote: async (path: string) => {
    await api.removeWorkspace(path);
    set((s) => ({
      workspaces: s.workspaces.filter((w) => w.path !== path),
    }));
  },

  refreshWorkspace: async (path: string) => {
    try {
      const data = await api.fetchWorkspace(path, PAGE_SIZE, 0);
      set((s) => ({
        workspaces: s.workspaces.map((w) => (w.path === path ? data : w)),
        hasMore: { ...s.hasMore, [path]: data.sessions.length >= PAGE_SIZE },
        sessionOffset: { ...s.sessionOffset, [path]: data.sessions.length },
      }));
    } catch {}
  },

  loadMoreSessions: async (workspacePath: string) => {
    const state = useWorkspaceStore.getState();
    const offset = state.sessionOffset[workspacePath] || 0;
    try {
      const data = await api.fetchWorkspace(workspacePath, PAGE_SIZE, offset);
      set((s) => ({
        workspaces: s.workspaces.map((w) => {
          if (w.path !== workspacePath) return w;
          // Merge appended sessions, dedup by id
          const existingIds = new Set(w.sessions.map(s => s.id));
          const newSessions = data.sessions.filter(s => !existingIds.has(s.id));
          return { ...w, sessions: [...w.sessions, ...newSessions] };
        }),
        hasMore: { ...s.hasMore, [workspacePath]: data.sessions.length >= PAGE_SIZE },
        sessionOffset: { ...s.sessionOffset, [workspacePath]: offset + data.sessions.length },
      }));
    } catch {}
  },

  deleteSession: async (workspacePath: string, sessionId: string) => {
    try {
      const key = `${workspacePath}::${sessionId}`;
      await api.deleteSession(key);
    } catch (e: any) {
      throw e;
    }
    // Remove from local state
    set((s) => ({
      workspaces: s.workspaces.map((w) => {
        if (w.path !== workspacePath) return w;
        return { ...w, sessions: w.sessions.filter(s => s.id !== sessionId) };
      }),
    }));
  },

  fetchSessionUsage: async (workspacePath, sessionId) => {
    const key = `${workspacePath}::${sessionId}`;
    try {
      const { usage } = await api.getSessionUsage(key);
      set((s) => ({
        usageCache: { ...s.usageCache, [key]: usage },
      }));
    } catch {
      // session may not be active
    }
  },
}));
