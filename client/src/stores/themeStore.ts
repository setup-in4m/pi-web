import { create } from "zustand";

export type ThemeMode = "dark" | "light" | "system" | "solarized-dark" | "tokyo-night" | "catppuccin" | "nord";
export type Density = "compact" | "normal" | "comfortable";
export type AccentColor = "purple" | "blue" | "green" | "orange" | "pink" | "teal" | "red" | "amber" | "cyan";
export type CodeTheme = "dark" | "light" | "monokai" | "dracula" | "nord" | "github";
export type FontFamily = "system" | "jetbrains" | "fira-code" | "source-code-pro" | "ibm-plex-mono" | "cascadia-code";
export type UIFontFamily = "system" | "inter" | "geist" | "roboto" | "open-sans" | "lato" | "poppins" | "dm-sans" | "system-sans";

export const FONT_MAP: Record<FontFamily, { name: string; css: string }> = {
  system: { name: "System", css: "JetBrains Mono, Fira Code, monospace" },
  jetbrains: { name: "JetBrains Mono", css: '"JetBrains Mono", monospace' },
  "fira-code": { name: "Fira Code", css: '"Fira Code", monospace' },
  "source-code-pro": { name: "Source Code Pro", css: '"Source Code Pro", monospace' },
  "ibm-plex-mono": { name: "IBM Plex Mono", css: '"IBM Plex Mono", monospace' },
  "cascadia-code": { name: "Cascadia Code", css: '"Cascadia Code", monospace' },
};

export const UI_FONT_MAP: Record<UIFontFamily, { name: string; css: string }> = {
  system: { name: "System", css: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  inter: { name: "Inter", css: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif' },
  geist: { name: "Geist", css: '"Geist", -apple-system, BlinkMacSystemFont, sans-serif' },
  roboto: { name: "Roboto", css: '"Roboto", -apple-system, BlinkMacSystemFont, sans-serif' },
  "open-sans": { name: "Open Sans", css: '"Open Sans", -apple-system, BlinkMacSystemFont, sans-serif' },
  lato: { name: "Lato", css: '"Lato", -apple-system, BlinkMacSystemFont, sans-serif' },
  poppins: { name: "Poppins", css: '"Poppins", -apple-system, BlinkMacSystemFont, sans-serif' },
  "dm-sans": { name: "DM Sans", css: '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif' },
  "system-sans": { name: "System Sans", css: 'system-ui, -apple-system, sans-serif' },
};

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
  red: { name: "Red", color: "#ef4444", hover: "#f87171", glow: "rgba(239,68,68,0.3)" },
  amber: { name: "Amber", color: "#f59e0b", hover: "#fbbf24", glow: "rgba(245,158,11,0.3)" },
  cyan: { name: "Cyan", color: "#06b6d4", hover: "#22d3ee", glow: "rgba(6,182,212,0.3)" },
};

interface ThemeState {
  mode: ThemeMode;
  accent: AccentColor;
  density: Density;
  fontScale: number;
  fontFamily: FontFamily;
  uiFontFamily: UIFontFamily;
  codeTheme: CodeTheme;

  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  setDensity: (density: Density) => void;
  setFontScale: (scale: number) => void;
  setFontFamily: (font: FontFamily) => void;
  setUIFontFamily: (font: UIFontFamily) => void;
  setCodeTheme: (theme: CodeTheme) => void;

  // Derived
  resolvedMode: () => "dark" | "light";
}

function loadTheme() {
  try {
    const raw = localStorage.getItem("pi-web-theme");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { mode: "dark" as ThemeMode, accent: "purple" as AccentColor, density: "normal" as Density, fontScale: 1, fontFamily: "system" as FontFamily, uiFontFamily: "system" as UIFontFamily, codeTheme: "dark" as CodeTheme };
}

function persist(s: { mode: ThemeMode; accent: AccentColor; density: Density; fontScale: number; fontFamily: FontFamily; uiFontFamily: UIFontFamily; codeTheme: CodeTheme }) {
  localStorage.setItem("pi-web-theme", JSON.stringify(s));
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initial = loadTheme();

  // Apply theme to document
  applyTheme(initial.mode, initial.accent, initial.density, initial.fontScale, initial.fontFamily, initial.uiFontFamily, initial.codeTheme);

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
      applyTheme(mode, s.accent, s.density, s.fontScale, s.fontFamily, s.uiFontFamily, s.codeTheme);
      persist({ mode, accent: s.accent, density: s.density, fontScale: s.fontScale, fontFamily: s.fontFamily, uiFontFamily: s.uiFontFamily, codeTheme: s.codeTheme });
    },

    setAccent: (accent) => {
      set({ accent });
      const s = get();
      applyTheme(s.mode, accent, s.density, s.fontScale, s.fontFamily, s.uiFontFamily, s.codeTheme);
      persist({ mode: s.mode, accent, density: s.density, fontScale: s.fontScale, fontFamily: s.fontFamily, uiFontFamily: s.uiFontFamily, codeTheme: s.codeTheme });
    },

    setDensity: (density) => {
      set({ density });
      const s = get();
      applyTheme(s.mode, s.accent, density, s.fontScale, s.fontFamily, s.uiFontFamily, s.codeTheme);
      document.documentElement.setAttribute("data-density", density);
      persist({ mode: s.mode, accent: s.accent, density, fontScale: s.fontScale, fontFamily: s.fontFamily, uiFontFamily: s.uiFontFamily, codeTheme: s.codeTheme });
    },

    setFontScale: (fontScale) => {
      set({ fontScale });
      const s = get();
      document.documentElement.style.fontSize = `${13 * fontScale}px`;
      persist({ mode: s.mode, accent: s.accent, density: s.density, fontScale, fontFamily: s.fontFamily, uiFontFamily: s.uiFontFamily, codeTheme: s.codeTheme });
    },

    setFontFamily: (fontFamily) => {
      set({ fontFamily });
      const s = get();
      const font = FONT_MAP[fontFamily];
      document.documentElement.style.setProperty("--font-mono", font.css);
      document.documentElement.setAttribute("data-font-family", fontFamily);
      applyCodeTheme(s.codeTheme);
      persist({ mode: s.mode, accent: s.accent, density: s.density, fontScale: s.fontScale, fontFamily, uiFontFamily: s.uiFontFamily, codeTheme: s.codeTheme });
    },

    setUIFontFamily: (uiFontFamily) => {
      set({ uiFontFamily });
      const s = get();
      const font = UI_FONT_MAP[uiFontFamily];
      document.documentElement.style.setProperty("--font-sans", font.css);
      applyCodeTheme(s.codeTheme);
      persist({ mode: s.mode, accent: s.accent, density: s.density, fontScale: s.fontScale, fontFamily: s.fontFamily, uiFontFamily, codeTheme: s.codeTheme });
    },

    setCodeTheme: (codeTheme) => {
      set({ codeTheme });
      const s = get();
      applyCodeTheme(codeTheme);
      persist({ mode: s.mode, accent: s.accent, density: s.density, fontScale: s.fontScale, fontFamily: s.fontFamily, uiFontFamily: s.uiFontFamily, codeTheme });
    },
  };
});

function applyTheme(mode: ThemeMode, accent: AccentColor, density: Density, fontScale: number, fontFamily: FontFamily, uiFontFamily: UIFontFamily, codeTheme: CodeTheme) {
  const acc = ACCENT_MAP[accent];
  let resolved = mode;
  if (mode === "system") {
    resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.setAttribute("data-density", density);
  document.documentElement.style.fontSize = `${13 * fontScale}px`;

  // Code font
  const font = FONT_MAP[fontFamily];
  document.documentElement.style.setProperty("--font-mono", font.css);
  document.documentElement.setAttribute("data-font-family", fontFamily);

  // UI font
  const uiFont = UI_FONT_MAP[uiFontFamily];
  document.documentElement.style.setProperty("--font-sans", uiFont.css);

  // Code theme
  applyCodeTheme(codeTheme);

  // CSS custom properties for accent
  document.documentElement.style.setProperty("--color-accent", acc.color);
  document.documentElement.style.setProperty("--color-accent-hover", acc.hover);
  document.documentElement.style.setProperty("--color-accent-glow", acc.glow);
}

function applyCodeTheme(theme: CodeTheme) {
  // Remove all previous code theme attributes
  document.documentElement.removeAttribute("data-code-theme");
  if (theme !== "dark") {
    document.documentElement.setAttribute("data-code-theme", theme);
  }
}

// Listen for system theme changes
if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const state = useThemeStore.getState();
    if (state.mode === "system") {
      applyTheme("system", state.accent, state.density, state.fontScale, state.fontFamily, state.uiFontFamily, state.codeTheme);
    }
  });
}
