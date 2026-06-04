import { create } from "zustand";

// ── Default keybindings ──────────────────────────────────

export interface KeybindingDef {
  action: string;
  default: string;
  description: string;
}

export const DEFAULT_KEYBINDINGS: KeybindingDef[] = [
  { action: "newPanel", default: "Ctrl+T", description: "New panel" },
  { action: "closePanel", default: "Ctrl+W", description: "Close panel" },
  { action: "nextPanel", default: "Ctrl+Tab", description: "Next panel" },
  { action: "switchPanel1", default: "Ctrl+1", description: "Switch to panel 1" },
  { action: "switchPanel2", default: "Ctrl+2", description: "Switch to panel 2" },
  { action: "switchPanel3", default: "Ctrl+3", description: "Switch to panel 3" },
  { action: "switchPanel4", default: "Ctrl+4", description: "Switch to panel 4" },
  { action: "switchPanel5", default: "Ctrl+5", description: "Switch to panel 5" },
  { action: "switchPanel6", default: "Ctrl+6", description: "Switch to panel 6" },
  { action: "switchPanel7", default: "Ctrl+7", description: "Switch to panel 7" },
  { action: "switchPanel8", default: "Ctrl+8", description: "Switch to panel 8" },
  { action: "toggleSidebar", default: "Ctrl+B", description: "Toggle sidebar" },
  { action: "focusMode", default: "Ctrl+Shift+F", description: "Focus mode" },
  { action: "commandPalette", default: "Ctrl+P", description: "Command palette" },
  { action: "layoutSingle", default: "Ctrl+Shift+1", description: "Single layout" },
  { action: "layoutHorizontal", default: "Ctrl+Shift+H", description: "Horizontal split" },
  { action: "layoutVertical", default: "Ctrl+Shift+V", description: "Vertical split" },
  { action: "layoutGrid", default: "Ctrl+Shift+G", description: "2×2 grid" },
  { action: "layoutColumns3", default: "Ctrl+Shift+3", description: "3 columns" },
  { action: "sendMessage", default: "Enter", description: "Send message" },
  { action: "newLine", default: "Shift+Enter", description: "New line" },
  { action: "cancelEdit", default: "Escape", description: "Cancel edit" },
];

// ── Store ────────────────────────────────────────────────

interface SettingsState {
  keybindings: Record<string, string>; // action → shortcut string

  setKeybinding: (action: string, shortcut: string) => void;
  resetKeybindings: () => void;
  getKeybinding: (action: string) => string;
  resolveAction: (shortcut: string) => string | null;
}

function loadKeybindings(): Record<string, string> {
  try {
    const raw = localStorage.getItem("pi-web-keybindings");
    if (raw) return JSON.parse(raw);
  } catch {}
  const defaults: Record<string, string> = {};
  for (const k of DEFAULT_KEYBINDINGS) {
    defaults[k.action] = k.default;
  }
  return defaults;
}

function persist(keybindings: Record<string, string>) {
  localStorage.setItem("pi-web-keybindings", JSON.stringify(keybindings));
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  keybindings: loadKeybindings(),

  setKeybinding: (action, shortcut) => {
    set((s) => {
      const keybindings = { ...s.keybindings, [action]: shortcut };
      persist(keybindings);
      return { keybindings };
    });
  },

  resetKeybindings: () => {
    const defaults: Record<string, string> = {};
    for (const k of DEFAULT_KEYBINDINGS) {
      defaults[k.action] = k.default;
    }
    set({ keybindings: defaults });
    persist(defaults);
  },

  getKeybinding: (action) => {
    return get().keybindings[action] || DEFAULT_KEYBINDINGS.find(k => k.action === action)?.default || "";
  },

  resolveAction: (shortcut) => {
    const kb = get().keybindings;
    for (const [action, sc] of Object.entries(kb)) {
      if (sc === shortcut) return action;
    }
    return null;
  },
}));
