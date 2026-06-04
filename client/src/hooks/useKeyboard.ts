import { useEffect } from "react";
import { usePanelStore } from "../stores/panelStore";
import { useLayoutStore, type LayoutPreset } from "../stores/layoutStore";

export function useKeyboard() {
  const addPanel = usePanelStore((s) => s.addPanel);
  const removePanel = usePanelStore((s) => s.removePanel);
  const activeIndex = usePanelStore((s) => s.activeIndex);
  const setActive = usePanelStore((s) => s.setActive);
  const panels = usePanelStore((s) => s.panels);
  const { setPreset, toggleSidebar, toggleFocusMode } = useLayoutStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      // Ctrl+T: new panel
      if (mod && e.key === "t") {
        e.preventDefault();
        addPanel();
        return;
      }

      // Ctrl+W: close active panel
      if (mod && e.key === "w") {
        e.preventDefault();
        removePanel(activeIndex);
        return;
      }

      // Ctrl+Tab / Ctrl+Shift+Tab: cycle panels
      if (mod && e.key === "Tab") {
        e.preventDefault();
        const dir = e.shiftKey ? -1 : 1;
        const next = (activeIndex + dir + panels.length) % panels.length;
        setActive(next);
        return;
      }

      // Ctrl+1-8: switch to panel
      if (mod && e.key >= "1" && e.key <= "8") {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (idx < panels.length) setActive(idx);
        return;
      }

      // Ctrl+B: toggle sidebar
      if (mod && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // Ctrl+Shift+F: toggle focus mode (full screen single panel)
      if (mod && e.shiftKey && e.key === "f") {
        e.preventDefault();
        toggleFocusMode();
        return;
      }

      // Layout shortcuts: Ctrl+Shift+[H,V,G,1,2,3]
      if (mod && e.shiftKey) {
        const layoutMap: Record<string, LayoutPreset> = {
          "1": "single",
          "h": "2h",
          "v": "2v",
          "g": "2x2",
          "3": "col3",
        };
        const preset = layoutMap[e.key.toLowerCase()];
        if (preset) {
          e.preventDefault();
          setPreset(preset);
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [addPanel, removePanel, activeIndex, setActive, panels.length, setPreset, toggleSidebar, toggleFocusMode]);
}
