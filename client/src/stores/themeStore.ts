import { create } from "zustand";

export type ThemeMode = "dark" | "light" | "system";
export type Density = "compact" | "normal" | "comfortable";
export type AccentColor = "purple" | "blue" | "green" | "orange" | "pink" | "teal";

export interface AccentDef {
  name: string;
  color: string;
  hover: string;
  glow: string;
}

export const ACCENT_MAP: Record<AccentColor, AccentDef> = {
  purple: { name: "Purple", color: "#7c5cf0", hover: "#9678f4", glow: "rgba(124,92,240,0.3)" },
  blue: { name: "Blue", color: "#3b82f6", hover: "#60a5fa", glow: "rgba(59,130,246,0.3)" },
  green: { name: "Green", color: "#22c55e", hover: "#4ade80", glow: "rgba(34,197,94,0.3)" },
  orange: { name: "Orange", color: "#f97316", hover: "#fb923c", glow: "rgba(249,115,22,0.3)" },
  pink: { name: "Pink", color: "#ec4899", hover: "#f472b6", glow: "rgba(236,72,153,0.3)" },
  teal: { name: "Teal", color: "#14b8a6", hover: "#2dd4bf", glow: "rgba(20,184,166,0.3)" },
};

interface ThemeState {
  mode: ThemeMode;
  accent: AccentColor;
  density: Density;
  fontScale: number;

  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  setDensity: (density: Density) => void;
  setFontScale: (scale: number) => void;

  // Derived
  resolvedMode: () => "dark" | "light";
}

function loadTheme() {
  try {
    const raw = localStorage.getItem("pi-web-theme");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { mode: "dark" as ThemeMode, accent: "purple" as AccentColor, density: "normal" as Density, fontScale: 1 };
}

function persist(s: { mode: ThemeMode; accent: AccentColor; density: Density; fontScale: number }) {
  localStorage.setItem("pi-web-theme", JSON.stringify(s));
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initial = loadTheme();

  // Apply theme to document
  applyTheme(initial.mode, initial.accent, initial.density, initial.fontScale);

  return {
    ...initial,

    resolvedMode: () => {
      const mode = get().mode;
      if (mode === "system") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      return mode;
    },

    setMode: (mode) => {
      set({ mode });
      const s = get();
      applyTheme(mode, s.accent, s.density, s.fontScale);
      persist({ mode, accent: s.accent, density: s.density, fontScale: s.fontScale });
    },

    setAccent: (accent) => {
      set({ accent });
      const s = get();
      applyTheme(s.mode, accent, s.density, s.fontScale);
      persist({ mode: s.mode, accent, density: s.density, fontScale: s.fontScale });
    },

    setDensity: (density) => {
      set({ density });
      const s = get();
      applyTheme(s.mode, s.accent, density, s.fontScale);
      document.documentElement.setAttribute("data-density", density);
      persist({ mode: s.mode, accent: s.accent, density, fontScale: s.fontScale });
    },

    setFontScale: (fontScale) => {
      set({ fontScale });
      const s = get();
      document.documentElement.style.fontSize = `${13 * fontScale}px`;
      persist({ mode: s.mode, accent: s.accent, density: s.density, fontScale });
    },
  };
});

function applyTheme(mode: ThemeMode, accent: AccentColor, density: Density, fontScale: number) {
  const acc = ACCENT_MAP[accent];
  const resolved = mode === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : mode;

  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.setAttribute("data-density", density);
  document.documentElement.style.fontSize = `${13 * fontScale}px`;

  // CSS custom properties for accent
  document.documentElement.style.setProperty("--color-accent", acc.color);
  document.documentElement.style.setProperty("--color-accent-hover", acc.hover);
  document.documentElement.style.setProperty("--color-accent-glow", acc.glow);
}

// Listen for system theme changes
if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const state = useThemeStore.getState();
    if (state.mode === "system") {
      applyTheme("system", state.accent, state.density, state.fontScale);
    }
  });
}
