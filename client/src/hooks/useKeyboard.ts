import { useEffect } from "react";
import { usePanelStore } from "../stores/panelStore";
import { useLayoutStore, type LayoutPreset } from "../stores/layoutStore";
import { useSettingsStore } from "../stores/settingsStore";

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

      // Resolve action from custom keybindings by checking the pressed combo
      const pressedKey = e.key.length === 1 ? e.key.toUpperCase() : e.key === " " ? "Space" : e.key;
      const pressedParts: string[] = [];
      if (mod) pressedParts.push("Ctrl");
      if (e.shiftKey) pressedParts.push("Shift");
      if (e.altKey) pressedParts.push("Alt");
      pressedParts.push(pressedKey);
      const pressedShortcut = pressedParts.join("+");

      // Check against custom keybindings first
      const action = useSettingsStore.getState().keybindings;
      let matchedAction: string | undefined;
      for (const [act, sc] of Object.entries(action)) {
        if (sc === pressedShortcut) { matchedAction = act; break; }
      }

      // Map actions to handlers
      if (matchedAction) {
        if (matchedAction.startsWith("switchPanel")) {
          const num = parseInt(matchedAction.replace("switchPanel", ""), 10);
          e.preventDefault();
          if (num - 1 < panels.length) setActive(num - 1);
          return;
        }

        if (matchedAction.startsWith("layout")) {
          e.preventDefault();
          const layoutMap: Record<string, LayoutPreset> = {
            layoutSingle: "single",
            layoutHorizontal: "2h",
            layoutVertical: "2v",
            layoutGrid: "2x2",
            layoutColumns3: "col3",
          };
          const preset = layoutMap[matchedAction];
          if (preset) setPreset(preset);
          return;
        }

        switch (matchedAction) {
          case "newPanel":
            e.preventDefault();
            addPanel();
            return;
          case "closePanel":
            e.preventDefault();
            removePanel(activeIndex);
            return;
          case "nextPanel":
            e.preventDefault();
            const dir = e.shiftKey ? -1 : 1;
            const next = (activeIndex + dir + panels.length) % panels.length;
            setActive(next);
            return;
          case "toggleSidebar":
            e.preventDefault();
            toggleSidebar();
            return;
          case "focusMode":
            e.preventDefault();
            toggleFocusMode();
            return;
          case "commandPalette":
            e.preventDefault();
            // Command palette dispatch handled by CommandPalette component
            window.dispatchEvent(new CustomEvent("pi-web:command-palette"));
            return;
          case "sendMessage":
          case "newLine":
          case "cancelEdit":
            // These are handled at Composer level, not globally
            return;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [addPanel, removePanel, activeIndex, setActive, panels.length, setPreset, toggleSidebar, toggleFocusMode]);
}
