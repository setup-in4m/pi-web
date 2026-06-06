import { useState, useEffect, useRef, useCallback } from "react";
import { Search, ArrowRight, Clock } from "lucide-react";
import { useSearchStore } from "../stores/searchStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { usePanelStore } from "../stores/panelStore";
import { timeAgo } from "../lib/time";

export function CommandPalette() {
  const { query, setQuery, isOpen, close } = useSearchStore();
  const { workspaces } = useWorkspaceStore();
  const panels = usePanelStore((s) => s.panels);
  const activeIndex = usePanelStore((s) => s.activeIndex);
  const setActive = usePanelStore((s) => s.setActive);
  const openExistingSession = usePanelStore((s) => s.openExistingSession);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Collect all searchable items
  const items = useCallback(() => {
    const results: { type: "session" | "workspace" | "panel"; label: string; sub: string; action: () => void }[] = [];

    // Panels
    panels.forEach((p, i) => {
      const name = p.title || (p.workspacePath?.split(/[/\\]/).pop() || `Panel ${i + 1}`);
      results.push({
        type: "panel",
        label: name,
        sub: `Panel ${i + 1}${i === activeIndex ? " (active)" : ""}`,
        action: () => { setActive(i); close(); },
      });
    });

    // Sessions from all workspaces
    workspaces.forEach((ws) => {
      ws.sessions.forEach((s) => {
        results.push({
          type: "session",
          label: s.title || "(untitled)",
          sub: `${ws.name} · ${timeAgo(s.updatedAt)}`,
          action: () => {
            const idx = panels.findIndex((p) => !p.sessionKey);
            const targetIdx = idx >= 0 ? idx : activeIndex;
            openExistingSession(targetIdx, ws.path, s.id);
            close();
          },
        });
      });
    });

    if (!query) return results;

    const lower = query.toLowerCase();
    return results.filter(
      (r) => r.label.toLowerCase().includes(lower) || r.sub.toLowerCase().includes(lower)
    );
  }, [query, panels, activeIndex, workspaces, setActive, openExistingSession, close]);

  const results = items();

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        useSearchStore.getState().toggle();
      }
      if (e.key === "Escape" && isOpen) {
        close();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, close]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      results[selectedIndex]?.action();
    } else if (e.key === "Escape") {
      close();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/50" onClick={close} />
      <div className="relative w-[500px] max-h-[60vh] bg-[var(--color-bg2)] border border-[var(--color-bdl)] rounded-xl shadow-2xl flex flex-col overflow-hidden z-10">
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-bd)]">
          <Search size={16} className="text-[var(--color-t3)] flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search sessions, panels, workspaces…"
            className="flex-1 bg-transparent text-sm text-[var(--color-t1)] outline-none placeholder:text-[var(--color-t3)]"
            autoFocus
          />
          <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg3)] border border-[var(--color-bd)] text-[9px] text-[var(--color-t3)] font-mono">Esc</kbd>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-1">
          {results.length === 0 && (
            <div className="p-4 text-center text-[var(--color-t3)] text-[11px]">No results</div>
          )}
          {results.map((item, i) => (
            <button
              key={`${item.type}-${item.label}-${i}`}
              onClick={item.action}
              className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-[12px] transition-colors ${i === selectedIndex ? "bg-[var(--color-bga)]" : "hover:bg-[var(--color-bgh)]"}`}
            >
              {item.type === "session" && <Clock size={14} className="text-[var(--color-t3)] flex-shrink-0" />}
              {item.type === "panel" && <ArrowRight size={14} className="text-[var(--color-t3)] flex-shrink-0" />}
              {item.type === "workspace" && <Search size={14} className="text-[var(--color-t3)] flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="text-[var(--color-t1)] truncate">{item.label}</div>
                <div className="text-[10px] text-[var(--color-t3)]">{item.sub}</div>
              </div>
              {item.type === "panel" && <span className="text-[9px] text-[var(--color-t3)]">switch</span>}
              {item.type === "session" && <span className="text-[9px] text-[var(--color-t3)]">open</span>}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-3 py-1.5 border-t border-[var(--color-bd)] text-[9px] text-[var(--color-t3)] flex items-center gap-3">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>Esc close</span>
          <span className="ml-auto">Ctrl+P to open</span>
        </div>
      </div>
    </div>
  );
}
