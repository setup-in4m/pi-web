import { useState, useEffect } from "react";
import { usePanelStore } from "../../stores/panelStore";
import { useLayoutStore, type LayoutPreset } from "../../stores/layoutStore";
import { useModelStore } from "../../stores/modelStore";
import { useWorkflowStore } from "../../stores/workflowStore";
import { Plus, X, GripVertical, Square, Columns2, Rows2, Grid2x2, Columns3, Workflow } from "lucide-react";

const LAYOUT_OPTIONS: { preset: LayoutPreset; icon: typeof Square; label: string }[] = [
  { preset: "single", icon: Square, label: "Single panel" },
  { preset: "2h", icon: Columns2, label: "Split horizontal" },
  { preset: "2v", icon: Rows2, label: "Split vertical" },
  { preset: "2x2", icon: Grid2x2, label: "2×2 grid" },
  { preset: "col3", icon: Columns3, label: "3 columns" },
];

export function TabBar() {
  const panels = usePanelStore((s) => s.panels);
  const activeIndex = usePanelStore((s) => s.activeIndex);
  const addPanel = usePanelStore((s) => s.addPanel);
  const removePanel = usePanelStore((s) => s.removePanel);
  const setActive = usePanelStore((s) => s.setActive);
  const movePanel = usePanelStore((s) => s.movePanel);
  const spawnFromPanel = usePanelStore((s) => s.spawnFromPanel);
  const runOnOtherModel = usePanelStore((s) => s.runOnOtherModel);
  const closeOtherPanels = usePanelStore((s) => s.closeOtherPanels);
  const closeAllPanels = usePanelStore((s) => s.closeAllPanels);
  const { preset, setPreset } = useLayoutStore();
  const { models, providers } = useModelStore();
  const { open: workflowOpen, setOpen: setWorkflowOpen } = useWorkflowStore();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; index: number } | null>(null);

  useEffect(() => {
    const handler = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener("click", handler);
      return () => window.removeEventListener("click", handler);
    }
  }, [contextMenu]);

  const onDragStart = (e: React.DragEvent, idx: number) => {
    e.dataTransfer.setData("text/plain", String(idx));
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const onDrop = (e: React.DragEvent, toIdx: number) => {
    e.preventDefault();
    const fromIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (!isNaN(fromIdx) && fromIdx !== toIdx) {
      movePanel(fromIdx, toIdx);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, index });
  };

  return (
    <div className="flex items-center gap-0.5 px-2 py-0.5 bg-[var(--color-bg2)] border-b border-[var(--color-bd)] min-h-[28px] flex-shrink-0 overflow-x-auto">
      {panels.map((p, i) => (
        <div
          key={p.id}
          draggable
          onDragStart={(e) => onDragStart(e, i)}
          onDragOver={onDragOver}
          onDrop={(e) => onDrop(e, i)}
          onClick={() => setActive(i)}
          onContextMenu={(e) => handleContextMenu(e, i)}
          role="tab"
          aria-selected={i === activeIndex}
          aria-label={`Panel ${i + 1}: ${p.title || "Untitled"}`}
          tabIndex={i === activeIndex ? 0 : -1}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] cursor-pointer select-none whitespace-nowrap transition-colors
            ${i === activeIndex
              ? "bg-[var(--color-bga)] text-[var(--color-t1)] border border-[var(--color-accent)]"
              : "bg-[var(--color-bg3)] text-[var(--color-t2)] border border-transparent hover:bg-[var(--color-bgh)] hover:text-[var(--color-t1)]"
            }`}
        >
          <GripVertical size={10} className="text-[var(--color-t3)] flex-shrink-0" aria-hidden="true" />
          <span className="max-w-[120px] truncate">
            {p.title || (p.workspacePath ? p.workspacePath.split(/[/\\]/).pop() : "New tab")}
          </span>
          {p.streaming && (
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse flex-shrink-0" aria-label="Streaming" />
          )}
          {panels.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                removePanel(i);
              }}
              className="ml-0.5 text-[var(--color-t3)] hover:text-[var(--color-danger)] transition-opacity"
              style={{ opacity: i === activeIndex ? undefined : 0 }}
              tabIndex={-1}
              aria-label={`Close panel ${i + 1}`}
            >
              <X size={11} />
            </button>
          )}
        </div>
      ))}
      <button
        onClick={addPanel}
        className="flex-shrink-0 p-0.5 rounded text-[var(--color-t3)] hover:text-[var(--color-accent)] hover:bg-[var(--color-bgh)] transition-colors"
        title="New panel (Ctrl+T)"
        aria-label="Add new panel"
      >
        <Plus size={14} />
      </button>

      {/* Layout presets */}
      <div className="ml-auto flex items-center gap-0.5 flex-shrink-0" role="toolbar" aria-label="Layout presets">
        {/* Workflow builder button */}
        <button
          onClick={() => setWorkflowOpen(true)}
          className={`p-0.5 rounded transition-colors ${workflowOpen ? "text-[var(--color-accent)] bg-[var(--color-bga)]" : "text-[var(--color-t3)] hover:text-[var(--color-t2)] hover:bg-[var(--color-bgh)]"}`}
          title="Workflow Builder"
          aria-label="Open workflow builder"
        >
          <Workflow size={14} />
        </button>
        <div className="w-px h-3 bg-[var(--color-bd)] mx-0.5" />
        {LAYOUT_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.preset}
              onClick={() => setPreset(opt.preset)}
              className={`p-0.5 rounded transition-colors ${preset === opt.preset ? "text-[var(--color-accent)] bg-[var(--color-bga)]" : "text-[var(--color-t3)] hover:text-[var(--color-t2)] hover:bg-[var(--color-bgh)]"}`}
              title={opt.label}
              aria-label={opt.label}
              aria-pressed={preset === opt.preset}
            >
              <Icon size={14} />
            </button>
          );
        })}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[180px] bg-[var(--color-bg2)] border border-[var(--color-bdl)] rounded-lg shadow-xl py-1 overflow-hidden"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
        >
          <button
            className="w-full text-left px-3 py-1.5 text-[11px] text-[var(--color-t2)] hover:bg-[var(--color-bgh)] hover:text-[var(--color-t1)] transition-colors"
            onClick={() => { spawnFromPanel(contextMenu.index); setContextMenu(null); }}
            role="menuitem"
          >
            Spawn new panel
          </button>
          <div className="border-t border-[var(--color-bd)] my-0.5" />
          <div className="px-3 py-0.5 text-[9px] text-[var(--color-t3)] uppercase">Run last prompt on:</div>
          {providers.slice(0, 3).map((prov) =>
            models.filter(m => m.providerId === prov).slice(0, 2).map((m) => (
              <button
                key={m.modelId}
                className="w-full text-left px-3 py-1 text-[10px] text-[var(--color-t2)] hover:bg-[var(--color-bgh)] hover:text-[var(--color-t1)] transition-colors"
                onClick={() => {
                  const panel = panels[contextMenu.index];
                  const lastUser = [...panel.messages].reverse().find(msg => msg.role === "user");
                  if (lastUser) {
                    runOnOtherModel(contextMenu.index, m.providerId, m.modelId, lastUser.content);
                  }
                  setContextMenu(null);
                }}
                role="menuitem"
              >
                {m.displayName}
              </button>
            ))
          )}
          <div className="border-t border-[var(--color-bd)] my-0.5" />
          <button
            className="w-full text-left px-3 py-1.5 text-[11px] text-[var(--color-t2)] hover:bg-[var(--color-bgh)] hover:text-[var(--color-t1)] transition-colors"
            onClick={() => { closeOtherPanels(contextMenu.index); setContextMenu(null); }}
            role="menuitem"
          >
            Close other panels
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-[11px] text-[var(--color-t2)] hover:bg-[var(--color-bgh)] hover:text-[var(--color-t1)] transition-colors"
            onClick={() => { closeAllPanels(); setContextMenu(null); }}
            role="menuitem"
          >
            Close all panels
          </button>
        </div>
      )}
    </div>
  );
}
