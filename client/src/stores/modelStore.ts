import { create } from "zustand";
import type { Model } from "../lib/api";
import * as api from "../lib/api";

export interface RecentModelEntry {
  providerId: string;
  modelId: string;
  displayName?: string;
}

const RECENT_KEY = "pi-web-recent-models";

function loadRecentModels(): RecentModelEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function persistRecentModels(entries: RecentModelEntry[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(entries.slice(0, 5)));
}

interface ModelState {
  models: Model[];
  providers: string[];
  defaultProvider: string;
  defaultModel: string;
  loading: boolean;
  recentModels: RecentModelEntry[];

  loadModels: () => Promise<void>;
  addRecentModel: (providerId: string, modelId: string) => void;
}

export const useModelStore = create<ModelState>((set, get) => ({
  models: [],
  providers: [],
  defaultProvider: "",
  defaultModel: "",
  loading: false,
  recentModels: loadRecentModels(),

  loadModels: async () => {
    set({ loading: true });
    try {
      const data = await api.fetchModels();
      set({
        models: data.models,
        providers: data.providers,
        defaultProvider: data.defaultProvider,
        defaultModel: data.defaultModel,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  addRecentModel: (providerId, modelId) => {
    const current = get().recentModels;
    const model = get().models.find(m => m.providerId === providerId && m.modelId === modelId);
    const entry: RecentModelEntry = {
      providerId,
      modelId,
      displayName: model?.displayName,
    };
    // Remove existing duplicate, add to front, keep 5
    const filtered = current.filter(e => !(e.providerId === providerId && e.modelId === modelId));
    const next = [entry, ...filtered].slice(0, 5);
    set({ recentModels: next });
    persistRecentModels(next);
  },
}));
