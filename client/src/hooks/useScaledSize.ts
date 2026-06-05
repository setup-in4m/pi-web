import { useThemeStore } from "../stores/themeStore";

/** Returns a pixel size scaled by the current fontScale from themeStore */
export function useScaledSize(basePx: number): number {
  const fontScale = useThemeStore((s) => s.fontScale);
  return Math.round(basePx * fontScale);
}
