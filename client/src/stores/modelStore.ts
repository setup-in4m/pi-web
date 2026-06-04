import { create } from "zustand";
import type { Model } from "../lib/api";
import * as api from "../lib/api";

interface ModelState {
  models: Model[];
  providers: string[];
  defaultProvider: string;
  defaultModel: string;
  loading: boolean;

  loadModels: () => Promise<void>;
}

export const useModelStore = create<ModelState>((set) => ({
  models: [],
  providers: [],
  defaultProvider: "",
  defaultModel: "",
  loading: false,

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
}));
