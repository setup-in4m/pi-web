import { useState, useEffect, useMemo } from "react";
import { FolderOpen, Plus, Folder, ChevronRight, MessageSquare, Settings } from "lucide-react";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useModelStore } from "../../stores/modelStore";
import { usePanelStore } from "../../stores/panelStore";
import { useToastStore } from "../../stores/toastStore";
import * as api from "../../lib/api";
import { isConnected } from "../../lib/ws";

export function Sidebar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { workspaces, loading, addWorkspace, refreshWorkspace, usageCache } = useWorkspaceStore();
  const { models } = useModelStore();
  const { panels, openExistingSession } = usePanelStore();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [version, setVersion] = useState("");

  useEffect(() => {
    api.fetchInfo().then((r) => setVersion(r.piVersion)).catch(() => {});
  }, []);

  const toggleExpand = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const addToast = useToastStore((s) => s.addToast);

  const handleBrowse = async () => {
    try {
      const result = await api.browseFolder();
      if (!result.cancelled && result.path) {
        await addWorkspace(result.path);
        setExpanded((prev) => new Set(prev).add(result.path!));
      }
    } catch (e: any) {
      addToast(e.message || "Failed to browse folder", "error");
    }
  };

  const handleNewThread = async (workspacePath: string) => {
    const state = usePanelStore.getState();
    if (state.panels.length >= 8) {
      addToast("Max 8 panels", "warning");
      return;
    }
    state.addPanel();
    const newIndex = usePanelStore.getState().panels.length - 1;
    usePanelStore.getState().setWorkspace(newIndex, workspacePath);
  };

  const handleOpenSession = async (workspacePath: string, sessionId: string) => {
    // Open session in a new panel/tab instead of replacing current
    const state = usePanelStore.getState();
    if (state.panels.length >= 8) {
      addToast("Max 8 panels", "warning");
      return;
    }
    state.addPanel();
    // Set workspace on the new panel before opening session
    const newIndex = usePanelStore.getState().panels.length - 1;
    usePanelStore.getState().setWorkspace(newIndex, workspacePath);
    await openExistingSession(newIndex, workspacePath, sessionId);
    refreshWorkspace(workspacePath);
  };

  const connected = isConnected();

  // Global usage totals
  const globalUsage = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let totalCost = 0;
    for (const key of Object.keys(usageCache)) {
      const u = usageCache[key];
      if (u.inputTokens != null) totalIn += u.inputTokens;
      if (u.outputTokens != null) totalOut += u.outputTokens;
      if (u.cost != null) totalCost += Number(u.cost);
    }
    return { totalIn, totalOut, totalCost };
  }, [usageCache]);

  return (
    <aside className="w-[240px] min-w-[240px] bg-[var(--color-bg2)] border-r border-[var(--color-bd)] flex flex-col z-10">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[var(--color-bd)] flex items-center gap-2 flex-shrink-0">
        <div className="w-5 h-5 bg-[var(--color-accent)] rounded flex items-center justify-center font-bold text-[10px] text-white shadow-[0_0_8px_var(--color-accent-glow)] flex-shrink-0">
          π
        </div>
        <span className="text-xs font-semibold">pi</span>
        {version && <span className="text-[9px] text-[var(--color-t3)] ml-auto">v{version}</span>}
      </div>

      {/* Actions */}
      <div className="p-2 flex-shrink-0">
        <button
          onClick={handleBrowse}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded text-[11px] font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          <FolderOpen size={13} />
          Open folder
        </button>
      </div>

      {/* Workspace list */}
      <div className="flex-1 overflow-y-auto px-1 py-0.5">
        {loading && workspaces.length === 0 && (
          <div className="p-4 text-center text-[var(--color-t3)] text-[10px]">Loading…</div>
        )}

        {!loading && workspaces.length === 0 && (
          <div className="p-4 text-center text-[var(--color-t3)] text-[10px]">
            No folders open.
          </div>
        )}

        {workspaces.map((ws) => {
          const isOpen = expanded.has(ws.path);
          return (
            <div key={ws.path} className="mb-0.5">
              {/* Workspace row */}
              <div
                onClick={() => toggleExpand(ws.path)}
                className={`flex items-center gap-1 px-1.5 py-1 rounded cursor-pointer text-[11px] transition-colors hover:bg-[var(--color-bgh)] ${isOpen ? "bg-[var(--color-bga)]" : ""}`}
              >
                <ChevronRight
                  size={10}
                  className={`text-[var(--color-t3)] flex-shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
                />
                <Folder size={12} className="text-[var(--color-t2)] flex-shrink-0" />
                <span className="font-medium truncate">{ws.name}</span>
                <span className="text-[9px] text-[var(--color-t3)] ml-auto flex-shrink-0">
                  {ws.sessions.length}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNewThread(ws.path);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:opacity-100 p-0.5 rounded text-[var(--color-t3)] hover:text-[var(--color-accent)] transition-all ml-0.5"
                  title="New thread"
                >
                  <Plus size={11} />
                </button>
              </div>

              {/* Sessions */}
              {isOpen && (
                <div className="ml-3 border-l border-[var(--color-bd)]">
                  {ws.sessions.length === 0 && (
                    <div className="px-2 py-1 text-[9px] text-[var(--color-t3)]">No sessions yet</div>
                  )}
                  {ws.sessions.map((s) => {
                    const isActive = panels.some(p => p.sessionId === s.id);
                    const cacheKey = `${ws.path}::${s.id}`;
                    const usage = usageCache[cacheKey];
                    return (
                      <div
                        key={s.id}
                        onClick={() => handleOpenSession(ws.path, s.id)}
                        className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] cursor-pointer rounded transition-colors hover:bg-[var(--color-bgh)] ${isActive ? "bg-[var(--color-bga)] text-[var(--color-accent)]" : ""}`}
                      >
                        <MessageSquare size={10} className="flex-shrink-0" />
                        <span className="truncate flex-1 min-w-0">{s.title || "(untitled)"}</span>
                        {usage?.cost != null && usage.cost > 0 && (
                          <span className="text-[8px] text-[var(--color-warning)] flex-shrink-0" title="Session cost">
                            ${Number(usage.cost).toFixed(4)}
                          </span>
                        )}
                        <span className="text-[8px] text-[var(--color-t3)] flex-shrink-0">
                          {timeAgo(s.updatedAt)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-2 py-1 border-t border-[var(--color-bd)] text-[9px] text-[var(--color-t3)] flex items-center gap-2 flex-shrink-0">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${connected ? "bg-[var(--color-success)]" : "bg-[var(--color-danger)]"}`} />
        <span className="flex-1">{connected ? "Connected" : "Offline"}</span>
        {models.length > 0 && <span>{models.length} models</span>}
        {(globalUsage.totalIn > 0 || globalUsage.totalOut > 0) && (
          <span className="text-[var(--color-t3)]" title={`${globalUsage.totalIn.toLocaleString()} in · ${globalUsage.totalOut.toLocaleString()} out`}>
            {(globalUsage.totalIn + globalUsage.totalOut).toLocaleString()} tok
          </span>
        )}
        {globalUsage.totalCost > 0 && (
          <span className="text-[var(--color-warning)]" title="Total cost across all sessions">
            ${globalUsage.totalCost.toFixed(3)}
          </span>
        )}
        <button onClick={onOpenSettings} className="text-[var(--color-t3)] hover:text-[var(--color-t1)] transition-colors p-0.5" title="Settings">
          <Settings size={11} />
        </button>
      </div>
    </aside>
  );
}

function timeAgo(dateStr: string): string {
  const seconds = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
