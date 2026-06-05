import { create } from "zustand";

export type ThemeMode = "dark" | "light" | "system" | "solarized-dark" | "solarized-light" | "tokyo-night" | "catppuccin" | "catppuccin-latte" | "nord" | "rose-pine" | "rose-pine-dawn";
export type Density = "compact" | "normal" | "comfortable";
export type AccentColor = "purple" | "blue" | "green" | "orange" | "pink" | "teal" | "red" | "amber" | "cyan";
export type CodeTheme = "dark" | "light" | "monokai" | "dracula" | "nord" | "github";
export type FontFamily = "system" | "jetbrains" | "fira-code" | "source-code-pro" | "ibm-plex-mono" | "roboto-mono" | "space-mono" | "courier-prime";
export type UIFontFamily = "system" | "inter" | "nunito" | "roboto" | "open-sans" | "oswald" | "poppins" | "dm-sans" | "system-sans";

// ── Font loading (Google Fonts CDN) ─────────────────────

const GOOGLE_FONTS: Record<string, string> = {
  jetbrains: "JetBrains+Mono:wght@400;500;600;700",
  "fira-code": "Fira+Code:wght@400;500;600;700",
  "source-code-pro": "Source+Code+Pro:wght@400;500;600;700",
  "ibm-plex-mono": "IBM+Plex+Mono:wght@400;500;600;700",
  "roboto-mono": "Roboto+Mono:wght@400;500;600;700",
  "space-mono": "Space+Mono:wght@400;700",
  "courier-prime": "Courier+Prime:wght@400;700",
  inter: "Inter:wght@400;500;600;700",
  nunito: "Nunito:wght@400;500;600;700",
  roboto: "Roboto:wght@400;500;700",
  "open-sans": "Open+Sans:wght@400;500;600;700",
  oswald: "Oswald:wght@400;500;600;700",
  poppins: "Poppins:wght@400;500;600;700",
  "dm-sans": "DM+Sans:wght@400;500;600;700",
};

function loadGoogleFont(fontKey: string) {
  const family = GOOGLE_FONTS[fontKey];
  if (!family) return; // not on Google Fonts, rely on system fallback
  const id = `gf-${fontKey}`;
  if (document.getElementById(id)) return; // already loaded
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${family}&display=swap`;
  document.head.appendChild(link);
}

// ── Font maps ───────────────────────────────────────────

export const FONT_MAP: Record<FontFamily, { name: string; css: string }> = {
  system: { name: "System", css: 'ui-monospace, SFMono-Regular, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace' },
  jetbrains: { name: "JetBrains Mono", css: '"JetBrains Mono", ui-monospace, monospace' },
  "fira-code": { name: "Fira Code", css: '"Fira Code", ui-monospace, monospace' },
  "source-code-pro": { name: "Source Code Pro", css: '"Source Code Pro", ui-monospace, monospace' },
  "ibm-plex-mono": { name: "IBM Plex Mono", css: '"IBM Plex Mono", ui-monospace, monospace' },
  "roboto-mono": { name: "Roboto Mono", css: '"Roboto Mono", ui-monospace, monospace' },
  "space-mono": { name: "Space Mono", css: '"Space Mono", ui-monospace, monospace' },
  "courier-prime": { name: "Courier Prime", css: '"Courier Prime", ui-monospace, monospace' },
};

export const UI_FONT_MAP: Record<UIFontFamily, { name: string; css: string }> = {
  system: { name: "System", css: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  inter: { name: "Inter", css: '"Inter", system-ui, -apple-system, sans-serif' },
  nunito: { name: "Nunito", css: '"Nunito", system-ui, -apple-system, sans-serif' },
  roboto: { name: "Roboto", css: '"Roboto", system-ui, -apple-system, sans-serif' },
  "open-sans": { name: "Open Sans", css: '"Open Sans", system-ui, -apple-system, sans-serif' },
  oswald: { name: "Oswald", css: '"Oswald", system-ui, -apple-system, sans-serif' },
  poppins: { name: "Poppins", css: '"Poppins", system-ui, -apple-system, sans-serif' },
  "dm-sans": { name: "DM Sans", css: '"DM Sans", system-ui, -apple-system, sans-serif' },
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
  const defaults = { mode: "dark" as ThemeMode, accent: "purple" as AccentColor, density: "normal" as Density, fontScale: 1, fontFamily: "system" as FontFamily, uiFontFamily: "system" as UIFontFamily, codeTheme: "dark" as CodeTheme };
  try {
    const raw = localStorage.getItem("pi-web-theme");
    if (raw) {
      const parsed = JSON.parse(raw);
      // Validate font keys exist in maps (stale localStorage after theme updates)
      const fontFamily = parsed.fontFamily as FontFamily;
      if (!FONT_MAP[fontFamily]) parsed.fontFamily = defaults.fontFamily;
      const uiFontFamily = parsed.uiFontFamily as UIFontFamily;
      if (!UI_FONT_MAP[uiFontFamily]) parsed.uiFontFamily = defaults.uiFontFamily;
      return { ...defaults, ...parsed };
    }
  } catch {}
  return defaults;
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
      document.documentElement.style.setProperty("--font-scale", String(fontScale));
      persist({ mode: s.mode, accent: s.accent, density: s.density, fontScale, fontFamily: s.fontFamily, uiFontFamily: s.uiFontFamily, codeTheme: s.codeTheme });
    },

    setFontFamily: (fontFamily) => {
      set({ fontFamily });
      const s = get();
      loadGoogleFont(fontFamily);
      const font = FONT_MAP[fontFamily] ?? FONT_MAP.system;
      document.documentElement.style.setProperty("--font-mono", font.css);
      document.documentElement.setAttribute("data-font-family", fontFamily);
      applyCodeTheme(s.codeTheme);
      persist({ mode: s.mode, accent: s.accent, density: s.density, fontScale: s.fontScale, fontFamily, uiFontFamily: s.uiFontFamily, codeTheme: s.codeTheme });
    },

    setUIFontFamily: (uiFontFamily) => {
      set({ uiFontFamily });
      const s = get();
      loadGoogleFont(uiFontFamily);
      const font = UI_FONT_MAP[uiFontFamily] ?? UI_FONT_MAP.system;
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
  document.documentElement.style.setProperty("--font-scale", String(fontScale));

  // Code font
  loadGoogleFont(fontFamily);
  const font = FONT_MAP[fontFamily] ?? FONT_MAP.system;
  document.documentElement.style.setProperty("--font-mono", font.css);
  document.documentElement.setAttribute("data-font-family", fontFamily in FONT_MAP ? fontFamily : "system");

  // UI font
  loadGoogleFont(uiFontFamily);
  const uiFont = UI_FONT_MAP[uiFontFamily] ?? UI_FONT_MAP.system;
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
