import { useState, useEffect, useMemo, useCallback } from "react";
import {
  FolderOpen, Plus, Folder, ChevronRight, Settings,
  Trash2, RefreshCw, ArrowUpDown, Search, Star, Copy, X
} from "lucide-react";
import { useWorkspaceStore, type SortMode } from "../../stores/workspaceStore";
import { useModelStore } from "../../stores/modelStore";
import { usePanelStore } from "../../stores/panelStore";
import { useToastStore } from "../../stores/toastStore";
import * as api from "../../lib/api";
import { openFolder } from "../../lib/tauri";
import { isConnected } from "../../lib/ws";

// ── LocalStorage helpers ──────────────────────────────────
const SORT_KEY = "pi-web-session-sort";
const PINNED_KEY = "pi-web-pinned-sessions";

function getStoredSort(): SortMode {
  try {
    return (localStorage.getItem(SORT_KEY) as SortMode) || "newest";
  } catch { return "newest"; }
}

function getPinnedSessions(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function setPinnedSessions(data: Record<string, string[]>) {
  localStorage.setItem(PINNED_KEY, JSON.stringify(data));
}

export function Sidebar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const {
    workspaces, loading, error, addWorkspace, removeWorkspace, removeWorkspaceRemote,
    refreshWorkspace, loadMoreSessions, deleteSession, usageCache, hasMore
  } = useWorkspaceStore();
  const { models } = useModelStore();
  const { panels, openExistingSession } = usePanelStore();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [version, setVersion] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>(getStoredSort);
  const [searchQuery, setSearchQuery] = useState("");
  const [pinned, setPinned] = useState<Record<string, string[]>>(getPinnedSessions);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null); // path to confirm
  const [confirmSessionDelete, setConfirmSessionDelete] = useState<string | null>(null); // "workspacePath::sessionId"

  // Right-click context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null);

  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    api.fetchInfo().then((r) => setVersion(r.piVersion)).catch(() => {});
  }, []);

  // Dismiss context menu on click outside or Escape
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  const toggleExpand = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleBrowse = async () => {
    try {
      const tauriPath = await openFolder();
      if (tauriPath) {
        await addWorkspace(tauriPath);
        setExpanded((prev) => new Set(prev).add(tauriPath));
        return;
      }
      const manualPath = window.prompt("Enter folder path:", "");
      if (manualPath && manualPath.trim()) {
        await addWorkspace(manualPath.trim());
        setExpanded((prev) => new Set(prev).add(manualPath.trim()));
        return;
      }
    } catch (e: any) {
      const msg = e?.message || String(e || "Failed to open folder");
      addToast(msg, "error");
      console.error("[sidebar] handleBrowse failed:", e);
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
    const state = usePanelStore.getState();
    if (state.panels.length >= 8) {
      addToast("Max 8 panels", "warning");
      return;
    }
    state.addPanel();
    const newIndex = usePanelStore.getState().panels.length - 1;
    usePanelStore.getState().setWorkspace(newIndex, workspacePath);
    await openExistingSession(newIndex, workspacePath, sessionId);
    refreshWorkspace(workspacePath);
  };

  const handleRemoveWorkspace = useCallback(async (path: string) => {
    try {
      await removeWorkspaceRemote(path);
    } catch {
      removeWorkspace(path);
    }
    setConfirmDelete(null);
    setContextMenu(null);
    addToast("Workspace removed from sidebar", "success");
  }, [removeWorkspace, removeWorkspaceRemote, addToast]);

  const handleDeleteSession = useCallback(async (wsPath: string, sessionId: string) => {
    try {
      await deleteSession(wsPath, sessionId);
      addToast("Session deleted", "success");
    } catch (e: any) {
      addToast(e.message || "Failed to delete session", "error");
    }
    setConfirmSessionDelete(null);
  }, [deleteSession, addToast]);

  const handleTogglePin = useCallback((workspacePath: string, sessionId: string) => {
    setPinned((prev) => {
      const next = { ...prev };
      const list = [...(next[workspacePath] || [])];
      const idx = list.indexOf(sessionId);
      if (idx >= 0) {
        list.splice(idx, 1);
      } else {
        list.unshift(sessionId);
      }
      if (list.length === 0) {
        delete next[workspacePath];
      } else {
        next[workspacePath] = list;
      }
      setPinnedSessions(next);
      return next;
    });
  }, []);

  const handleSortChange = useCallback((mode: SortMode) => {
    setSortMode(mode);
    localStorage.setItem(SORT_KEY, mode);
  }, []);

  const connected = isConnected();

  // Global usage totals
  const globalUsage = useMemo(() => {
    let totalIn = 0, totalOut = 0, totalCost = 0;
    for (const key of Object.keys(usageCache)) {
      const u = usageCache[key];
      if (u.inputTokens != null) totalIn += u.inputTokens;
      if (u.outputTokens != null) totalOut += u.outputTokens;
      if (u.cost != null) totalCost += Number(u.cost);
    }
    return { totalIn, totalOut, totalCost };
  }, [usageCache]);

  // Sort sessions based on sortMode
  const sortSessions = useCallback((sessions: { id: string; title: string; updatedAt: string }[], wsPath: string) => {
    const pinnedIds = new Set(pinned[wsPath] || []);
    const sorted = [...sessions];

    switch (sortMode) {
      case "oldest":
        sorted.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
        break;
      case "az":
        sorted.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
        break;
      case "za":
        sorted.sort((a, b) => (b.title || "").localeCompare(a.title || ""));
        break;
      case "newest":
      default:
        sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        break;
    }

    // Pinned first
    const pinnedItems = sorted.filter(s => pinnedIds.has(s.id));
    const unpinnedItems = sorted.filter(s => !pinnedIds.has(s.id));
    return [...pinnedItems, ...unpinnedItems];
  }, [sortMode, pinned]);

  // Filter workspaces by search
  const filteredWorkspaces = useMemo(() => {
    if (!searchQuery.trim()) return workspaces;
    const q = searchQuery.toLowerCase();
    return workspaces.map(ws => ({
      ...ws,
      sessions: ws.sessions.filter(s =>
        (s.title || "(untitled)").toLowerCase().includes(q)
      ),
    })).filter(ws => ws.sessions.length > 0 || ws.name.toLowerCase().includes(q));
  }, [workspaces, searchQuery]);

  return (
    <aside className="w-[240px] min-w-[240px] bg-[var(--color-bg2)] border-r border-[var(--color-bd)] flex flex-col z-10">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[var(--color-bd)] flex items-center gap-2 flex-shrink-0">
        <div className="w-5 h-5 bg-[var(--color-accent)] rounded flex items-center justify-center font-bold text-[10px] text-white shadow-[0_0_8px_var(--color-accent-glow)] flex-shrink-0">
          π
        </div>
        <span className="text-xs font-semibold">pi</span>
        {version && <span className="text-[9px] text-[var(--color-t3)] ml-auto">{version}</span>}
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

      {/* Search + Sort bar */}
      {workspaces.length > 0 && (
        <div className="px-1.5 py-1 flex items-center gap-1 flex-shrink-0 border-b border-[var(--color-bd)]">
          <div className="flex items-center gap-1 flex-1 bg-[var(--color-bg3)] rounded px-1.5 py-0.5">
            <Search size={10} className="text-[var(--color-t3)] flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter sessions…"
              className="flex-1 bg-transparent text-[10px] text-[var(--color-t1)] outline-none placeholder:text-[var(--color-t3)]"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-[var(--color-t3)] hover:text-[var(--color-t1)]">
                <X size={9} />
              </button>
            )}
          </div>
          {/* Sort dropdown */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => {
                const modes: SortMode[] = ["newest", "oldest", "az", "za"];
                const idx = modes.indexOf(sortMode);
                handleSortChange(modes[(idx + 1) % modes.length]);
              }}
              className="p-1 rounded text-[var(--color-t3)] hover:text-[var(--color-t1)] hover:bg-[var(--color-bgh)] transition-colors"
              title={`Sort: ${sortMode}`}
            >
              <ArrowUpDown size={10} />
            </button>
          </div>
        </div>
      )}

      {/* Workspace list */}
      <div className="flex-1 overflow-y-auto px-1 py-0.5">
        {loading && workspaces.length === 0 && (
          <div className="p-4 text-center text-[var(--color-t3)] text-[10px]">Loading…</div>
        )}

        {!loading && workspaces.length === 0 && !error && (
          <div className="p-4 text-center text-[var(--color-t3)] text-[10px]">
            No folders open.
          </div>
        )}

        {error && (
          <div className="mx-2 mb-2 p-2 bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded text-[10px] text-[var(--color-danger)]">
            {error}
          </div>
        )}

        {filteredWorkspaces.map((ws) => {
          const isOpen = expanded.has(ws.path);
          const sortedSessions = sortSessions(ws.sessions, ws.path);

          return (
            <div key={ws.path} className="mb-0.5 group/ws">
              {/* Workspace row */}
              <div
                onClick={() => toggleExpand(ws.path)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenu({ x: e.clientX, y: e.clientY, path: ws.path });
                }}
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

                {/* Hover actions */}
                <button
                  onClick={(e) => { e.stopPropagation(); refreshWorkspace(ws.path); }}
                  className="opacity-0 group-hover/ws:opacity-100 p-0.5 rounded text-[var(--color-t3)] hover:text-[var(--color-accent)] transition-all"
                  title="Refresh"
                >
                  <RefreshCw size={10} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleNewThread(ws.path); }}
                  className="opacity-0 group-hover/ws:opacity-100 p-0.5 rounded text-[var(--color-t3)] hover:text-[var(--color-accent)] transition-all"
                  title="New thread"
                >
                  <Plus size={11} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirmDelete === ws.path) {
                      handleRemoveWorkspace(ws.path);
                    } else {
                      setConfirmDelete(ws.path);
                    }
                  }}
                  className={`opacity-0 group-hover/ws:opacity-100 p-0.5 rounded transition-all ${
                    confirmDelete === ws.path
                      ? "text-[var(--color-danger)] opacity-100"
                      : "text-[var(--color-t3)] hover:text-[var(--color-danger)]"
                  }`}
                  title={confirmDelete === ws.path ? "Click again to confirm" : "Remove workspace"}
                >
                  <Trash2 size={10} />
                </button>
              </div>

              {confirmDelete === ws.path && (
                <div className="ml-3 mb-0.5 px-2 py-1 text-[9px] text-[var(--color-danger)] bg-[var(--color-danger)]/5 border border-[var(--color-danger)]/20 rounded">
                  Remove from sidebar? (Files on disk will NOT be deleted)
                  <div className="flex gap-1 mt-0.5">
                    <button onClick={() => handleRemoveWorkspace(ws.path)} className="px-1.5 py-0.5 bg-[var(--color-danger)] text-white rounded text-[8px]">Remove</button>
                    <button onClick={() => setConfirmDelete(null)} className="px-1.5 py-0.5 bg-[var(--color-bg3)] rounded text-[8px] text-[var(--color-t2)]">Cancel</button>
                  </div>
                </div>
              )}

              {/* Sessions */}
              {isOpen && (
                <div className="ml-3 border-l border-[var(--color-bd)]">
                  {sortedSessions.length === 0 && (
                    <div className="px-2 py-1 text-[9px] text-[var(--color-t3)]">
                      {searchQuery ? "No matching sessions" : "No sessions yet"}
                    </div>
                  )}
                  {sortedSessions.map((s) => {
                    const isActive = panels.some(p => p.sessionId === s.id);
                    const cacheKey = `${ws.path}::${s.id}`;
                    const usage = usageCache[cacheKey];
                    const isPinned = (pinned[ws.path] || []).includes(s.id);
                    const delKey = `${ws.path}::${s.id}`;

                    return (
                      <div
                        key={s.id}
                        className={`group/session flex items-center gap-1 px-1.5 py-0.5 text-[10px] cursor-pointer rounded transition-colors hover:bg-[var(--color-bgh)] ${isActive ? "bg-[var(--color-bga)] text-[var(--color-accent)]" : ""} ${confirmSessionDelete === delKey ? "bg-[var(--color-danger)]/10" : ""}`}
                      >
                        {/* Pin toggle */}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleTogglePin(ws.path, s.id); }}
                          className={`flex-shrink-0 p-0 ${isPinned ? "text-[var(--color-warning)]" : "text-[var(--color-t3)] opacity-0 group-hover/session:opacity-100 hover:text-[var(--color-warning)]"}`}
                          title={isPinned ? "Unpin" : "Pin"}
                        >
                          <Star size={9} fill={isPinned ? "currentColor" : "none"} />
                        </button>

                        <div className="flex-1 min-w-0" onClick={() => {
                          if (confirmSessionDelete !== delKey) handleOpenSession(ws.path, s.id);
                        }}>
                          <span className="truncate block">{s.title || "(untitled)"}</span>
                        </div>

                        {/* Hover: cost + time */}
                        <span className="text-[8px] text-[var(--color-t3)] flex-shrink-0 opacity-100 group-hover/session:opacity-0 transition-opacity">
                          {usage?.cost != null && usage.cost > 0 ? `$${Number(usage.cost).toFixed(2)} · ` : ""}{timeAgo(s.updatedAt)}
                        </span>

                        {/* Delete session button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirmSessionDelete === delKey) {
                              handleDeleteSession(ws.path, s.id);
                            } else {
                              setConfirmSessionDelete(delKey);
                            }
                          }}
                          className={`flex-shrink-0 p-0 rounded transition-all ${
                            confirmSessionDelete === delKey
                              ? "opacity-100 text-[var(--color-danger)]"
                              : "opacity-0 group-hover/session:opacity-100 text-[var(--color-t3)] hover:text-[var(--color-danger)]"
                          }`}
                          title={confirmSessionDelete === delKey ? "Click again to confirm PERMANENT delete" : "Delete session"}
                        >
                          <X size={9} />
                        </button>
                      </div>
                    );
                  })}

                  {/* Load more button */}
                  {hasMore[ws.path] && !searchQuery && (
                    <button
                      onClick={() => loadMoreSessions(ws.path)}
                      className="w-full text-center px-2 py-1 text-[9px] text-[var(--color-t3)] hover:text-[var(--color-accent)] transition-colors"
                    >
                      Load more…
                    </button>
                  )}
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

      {/* ── Context menu ────────────────────────────────── */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 bg-[var(--color-bg2)] border border-[var(--color-bdl)] rounded-lg shadow-2xl py-1 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => { refreshWorkspace(contextMenu.path); setContextMenu(null); }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] text-[var(--color-t2)] hover:bg-[var(--color-bgh)] transition-colors text-left"
            >
              <RefreshCw size={10} />
              Refresh sessions
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(contextMenu.path);
                addToast("Path copied", "success");
                setContextMenu(null);
              }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] text-[var(--color-t2)] hover:bg-[var(--color-bgh)] transition-colors text-left"
            >
              <Copy size={10} />
              Copy path
            </button>
            <div className="border-t border-[var(--color-bd)] my-0.5" />
            <button
              onClick={() => { setConfirmDelete(contextMenu.path); setContextMenu(null); }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors text-left"
            >
              <Trash2 size={10} />
              Remove workspace
            </button>
          </div>
        </>
      )}
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
