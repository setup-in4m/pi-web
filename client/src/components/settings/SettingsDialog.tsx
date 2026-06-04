import { useState, useEffect, useRef } from "react";
import { X, Settings, Sun, Moon, Monitor, Palette, Type, User, Plus, Trash2, Pencil, RotateCcw, Database, Download, Trash, Zap, Code } from "lucide-react";
import { useThemeStore, type ThemeMode, type AccentColor, ACCENT_MAP, type Density, type FontFamily, type UIFontFamily, type CodeTheme, FONT_MAP, UI_FONT_MAP } from "../../stores/themeStore";
import { useProfileStore } from "../../stores/profileStore";
import { useModelStore } from "../../stores/modelStore";
import { useSettingsStore, DEFAULT_KEYBINDINGS } from "../../stores/settingsStore";
import { ExtensionManager } from "./ExtensionManager";
import { useToastStore } from "../../stores/toastStore";
import * as api from "../../lib/api";
import type { Model } from "../../lib/api";

// ── Models Tab ───────────────────────────────────────────

function ModelsTab() {
  const { models, providers, loading } = useModelStore();

  return (
    <div className="flex flex-col gap-3">
      {loading && <div className="text-[11px] text-[var(--color-t3)] italic">Loading models…</div>}
      {!loading && providers.length === 0 && (
        <div className="text-[11px] text-[var(--color-t2)]">
          <p>No models configured.</p>
          <p className="mt-1">Run <code className="bg-[var(--color-bg3)] px-1 py-0.5 rounded text-[10px]">pi models</code> to manage providers and API keys.</p>
        </div>
      )}
      {providers.map((prov) => {
        const provModels = models.filter((m) => m.providerId === prov);
        return (
          <div key={prov}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`w-2 h-2 rounded-full ${provModels.length > 0 ? "bg-[var(--color-success)]" : "bg-[var(--color-danger)]"}`} />
              <span className="text-[11px] font-semibold text-[var(--color-t2)] capitalize">{prov}</span>
              <span className="text-[9px] text-[var(--color-t3)]">
                ({provModels.length} model{provModels.length !== 1 ? "s" : ""})
              </span>
            </div>
            <div className="flex flex-col gap-0.5 ml-4">
              {provModels.map((m) => (
                <ModelCard key={m.modelId} model={m} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ModelCard({ model }: { model: Model }) {
  const ctxStr = model.contextWindow ? `${(model.contextWindow / 1000).toFixed(0)}K ctx` : null;
  const costStr = model.cost
    ? `$${model.cost.input.toFixed(2)}/$1M in · $${model.cost.output.toFixed(2)}/$1M out`
    : null;

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--color-bgh)] transition-colors">
      <Zap size={12} className="text-[var(--color-warning)] flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-[var(--color-t1)]">{model.displayName}</div>
        <div className="text-[9px] text-[var(--color-t3)]">
          {[ctxStr, costStr, model.supportsThinking ? "🧠" : null].filter(Boolean).join(" · ")}
        </div>
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
}

// ── Data Tab ────────────────────────────────────────────

function DataTab() {
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  const handleExportAll = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/export/all");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pi-web-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast("Export downloaded", "success");
    } catch (e: any) {
      addToast(e.message, "error");
    }
    setExporting(false);
  };

  const handleClearAll = async () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    setClearing(true);
    try {
      await api.api.delete("/api/data");
      addToast("All data cleared", "success");
      setConfirmClear(false);
    } catch (e: any) {
      addToast(e.message, "error");
    }
    setClearing(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-[11px] font-medium text-[var(--color-t2)] mb-2 flex items-center gap-1.5">
          <Database size={12} />
          Data Management
        </div>
        <div className="flex flex-col gap-2">
          <div className="p-3 rounded-lg border border-[var(--color-bd)] bg-[var(--color-bg3)]">
            <div className="text-[11px] text-[var(--color-t2)] mb-1">Export all sessions</div>
            <div className="text-[9px] text-[var(--color-t3)] mb-2">Download all workspaces and sessions as a JSON backup.</div>
            <button
              onClick={handleExportAll}
              disabled={exporting}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--color-accent)] text-white text-[11px] font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-25 transition-colors"
            >
              <Download size={11} />
              Export All
            </button>
          </div>

          <div className="p-3 rounded-lg border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5">
            <div className="text-[11px] text-[var(--color-t2)] mb-1">Clear all data</div>
            <div className="text-[9px] text-[var(--color-t3)] mb-2">
              Remove all workspaces, sessions, and stored data. This cannot be undone.
            </div>
            <button
              onClick={handleClearAll}
              disabled={clearing}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                confirmClear
                  ? "bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger)]/80"
                  : "border border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
              } disabled:opacity-25`}
            >
              <Trash size={11} />
              {confirmClear ? "Confirm — click again to delete" : clearing ? "Clearing…" : "Clear All Data"}
            </button>
            {confirmClear && (
              <button
                onClick={() => setConfirmClear(false)}
                className="text-[10px] text-[var(--color-t3)] hover:text-[var(--color-t2)] mt-1 ml-1 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsDialog({ open, onClose }: Props) {
  const { mode, accent, density, fontScale, fontFamily, uiFontFamily, codeTheme, setMode, setAccent, setDensity, setFontScale, setFontFamily, setUIFontFamily, setCodeTheme } = useThemeStore();
  const { profiles, addProfile, removeProfile } = useProfileStore();
  const { models } = useModelStore();
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileModel, setNewProfileModel] = useState("");
  const [newProfileThinking, setNewProfileThinking] = useState("off");
  const [activeTab, setActiveTab] = useState<"appearance" | "models" | "shortcuts" | "profiles" | "data" | "extensions">("appearance");
  const { keybindings, setKeybinding, resetKeybindings } = useSettingsStore();
  const [editingAction, setEditingAction] = useState<string | null>(null);
  const addToast = useToastStore((s) => s.addToast);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap + Escape handler
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const initTimer = setTimeout(() => {
      const first = dialog.querySelector<HTMLElement>(focusableSelector);
      first?.focus();
    }, 50);

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      clearTimeout(initTimer);
      window.removeEventListener("keydown", handler);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-[520px] max-h-[80vh] bg-[var(--color-bg2)] border border-[var(--color-bdl)] rounded-xl shadow-2xl flex flex-col overflow-hidden z-10" ref={dialogRef} role="dialog" aria-modal="true" aria-label="Settings">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-bd)] flex-shrink-0">
          <Settings size={16} className="text-[var(--color-accent)]" />
          <span className="text-sm font-semibold">Settings</span>
          <button onClick={onClose} className="ml-auto text-[var(--color-t3)] hover:text-[var(--color-t1)] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--color-bd)] px-4 flex-shrink-0 overflow-x-auto">
          {(["appearance", "models", "shortcuts", "profiles", "data", "extensions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-[11px] font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab ? "border-[var(--color-accent)] text-[var(--color-accent)]" : "border-transparent text-[var(--color-t3)] hover:text-[var(--color-t2)]"}`}
            >
              {tab === "appearance" ? "Appearance" : tab === "models" ? "Models" : tab === "shortcuts" ? "Shortcuts" : tab === "profiles" ? "Profiles" : tab === "data" ? "Data" : "Extensions"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "appearance" && (
            <div className="flex flex-col gap-5">
              {/* Theme mode */}
              <div>
                <div className="text-[11px] font-medium text-[var(--color-t2)] mb-2">Theme</div>
                <div className="flex gap-2">
                  {([
                    { value: "dark" as ThemeMode, icon: Moon, label: "Dark" },
                    { value: "light" as ThemeMode, icon: Sun, label: "Light" },
                    { value: "system" as ThemeMode, icon: Monitor, label: "System" },
                  ]).map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setMode(opt.value)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] transition-colors ${mode === opt.value ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]" : "border-[var(--color-bd)] text-[var(--color-t2)] hover:border-[var(--color-bdl)]"}`}
                      >
                        <Icon size={14} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Accent color */}
              <div>
                <div className="text-[11px] font-medium text-[var(--color-t2)] mb-2">
                  <Palette size={12} className="inline mr-1" />
                  Accent Color
                </div>
                <div className="flex gap-2">
                  {(Object.entries(ACCENT_MAP) as [AccentColor, { name: string; color: string; hover: string; glow: string }][]).map(([key, def]) => (
                    <button
                      key={key}
                      onClick={() => setAccent(key)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${accent === key ? "border-[var(--color-t1)] scale-110" : "border-transparent hover:scale-105"}`}
                      style={{ backgroundColor: def.color }}
                      title={def.name}
                    />
                  ))}
                </div>
              </div>

              {/* Density */}
              <div>
                <div className="text-[11px] font-medium text-[var(--color-t2)] mb-2">
                  <Type size={12} className="inline mr-1" />
                  Density
                </div>
                <div className="flex gap-2">
                  {([
                    { value: "compact" as Density, label: "Compact" },
                    { value: "normal" as Density, label: "Normal" },
                    { value: "comfortable" as Density, label: "Comfortable" },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setDensity(opt.value)}
                      className={`px-3 py-1.5 rounded-lg border text-[11px] transition-colors ${density === opt.value ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]" : "border-[var(--color-bd)] text-[var(--color-t2)] hover:border-[var(--color-bdl)]"}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font scale */}
              <div>
                <div className="text-[11px] font-medium text-[var(--color-t2)] mb-2">Font Size: {Math.round(fontScale * 100)}%</div>
                <input
                  type="range"
                  min={0.8}
                  max={1.5}
                  step={0.05}
                  value={fontScale}
                  onChange={(e) => setFontScale(parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none bg-[var(--color-bd)] outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--color-accent)] [&::-webkit-slider-thumb]:cursor-pointer"
                />
              </div>

              {/* Font family — code */}
              <div>
                <div className="text-[11px] font-medium text-[var(--color-t2)] mb-2">
                  <Type size={12} className="inline mr-1" />
                  Code Font
                </div>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value as FontFamily)}
                  className="w-full bg-[var(--color-bg3)] text-[var(--color-t2)] border border-[var(--color-bd)] rounded px-2 py-1.5 text-[11px] font-sans cursor-pointer outline-none focus:border-[var(--color-accent)]"
                >
                  {(Object.entries(FONT_MAP) as [FontFamily, { name: string; css: string }][]).map(([key, def]) => (
                    <option key={key} value={key}>{def.name}</option>
                  ))}
                </select>
              </div>

              {/* Font family — UI */}
              <div>
                <div className="text-[11px] font-medium text-[var(--color-t2)] mb-2">
                  <Type size={12} className="inline mr-1" />
                  UI Font
                </div>
                <select
                  value={uiFontFamily}
                  onChange={(e) => setUIFontFamily(e.target.value as UIFontFamily)}
                  className="w-full bg-[var(--color-bg3)] text-[var(--color-t2)] border border-[var(--color-bd)] rounded px-2 py-1.5 text-[11px] font-sans cursor-pointer outline-none focus:border-[var(--color-accent)]"
                >
                  {(Object.entries(UI_FONT_MAP) as [UIFontFamily, { name: string; css: string }][]).map(([key, def]) => (
                    <option key={key} value={key}>{def.name}</option>
                  ))}
                </select>
              </div>

              {/* Code theme */}
              <div>
                <div className="text-[11px] font-medium text-[var(--color-t2)] mb-2">
                  <Code size={12} className="inline mr-1" />
                  Code Theme
                </div>
                <div className="flex gap-2">
                  {([
                    { value: "dark" as CodeTheme, label: "Dark" },
                    { value: "light" as CodeTheme, label: "Light" },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setCodeTheme(opt.value)}
                      className={`px-3 py-1.5 rounded-lg border text-[11px] transition-colors ${codeTheme === opt.value ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]" : "border-[var(--color-bd)] text-[var(--color-t2)] hover:border-[var(--color-bdl)]"}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "shortcuts" && (
            <div className="flex flex-col gap-1 text-[11px]">
              {DEFAULT_KEYBINDINGS.map((kb) => {
                const current = keybindings[kb.action] || kb.default;
                const isEditing = editingAction === kb.action;
                const isModified = current !== kb.default;

                return (
                  <div key={kb.action} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[var(--color-bgh)] group">
                    <span className="flex-1 text-[var(--color-t2)]">{kb.description}</span>
                    {isEditing ? (
                      <input
                        className="px-1.5 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-accent)] text-[10px] font-mono text-[var(--color-t1)] outline-none w-[100px] text-center"
                        placeholder="Press keys…"
                        autoFocus
                        onKeyDown={(e) => {
                          e.preventDefault();
                          if (e.key === "Escape") { setEditingAction(null); return; }
                          if (e.key === "Control" || e.key === "Shift" || e.key === "Alt" || e.key === "Meta") return;
                          const parts: string[] = [];
                          if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
                          if (e.shiftKey) parts.push("Shift");
                          if (e.altKey) parts.push("Alt");
                          const keyName = e.key === " " ? "Space" : e.key.length === 1 ? e.key.toUpperCase() : e.key;
                          parts.push(keyName);
                          const shortcut = parts.join("+");
                          // Check for conflicts
                          const existing = Object.entries(keybindings).find(([act, sc]) => sc === shortcut && act !== kb.action);
                          if (existing) {
                            addToast(`Conflict: "${shortcut}" already used by ${DEFAULT_KEYBINDINGS.find(k => k.action === existing[0])?.description || existing[0]}`, "warning");
                            return;
                          }
                          setKeybinding(kb.action, shortcut);
                          setEditingAction(null);
                        }}
                        onBlur={() => setEditingAction(null)}
                      />
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <kbd className={`px-1.5 py-0.5 rounded border text-[10px] font-mono min-w-[80px] text-center ${isModified ? "bg-[var(--color-accent)]/10 border-[var(--color-accent)] text-[var(--color-accent)]" : "bg-[var(--color-bg3)] border-[var(--color-bd)] text-[var(--color-t2)]"}`}>
                          {current}
                        </kbd>
                        <button
                          onClick={() => setEditingAction(kb.action)}
                          className="opacity-0 group-hover:opacity-100 text-[var(--color-t3)] hover:text-[var(--color-accent)] transition-all p-0.5"
                          title="Edit shortcut"
                        >
                          <Pencil size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="border-t border-[var(--color-bd)] mt-2 pt-2">
                <button
                  onClick={resetKeybindings}
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-[var(--color-t3)] hover:text-[var(--color-t1)] hover:bg-[var(--color-bgh)] transition-colors"
                >
                  <RotateCcw size={11} />
                  Reset to defaults
                </button>
              </div>
            </div>
          )}

          {activeTab === "models" && <ModelsTab />}

          {activeTab === "profiles" && (
            <div className="flex flex-col gap-4">
              <div className="p-3 rounded-lg border border-[var(--color-bd)] bg-[var(--color-bg3)]">
                <div className="text-[11px] font-medium text-[var(--color-t2)] mb-2 flex items-center gap-1.5">
                  <User size={12} />
                  New Profile
                </div>
                <div className="flex gap-2">
                  <input
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    placeholder="Profile name…"
                    className="flex-1 bg-[var(--color-bg)] border border-[var(--color-bd)] rounded px-2 py-1 text-[11px] text-[var(--color-t1)] outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-t3)]"
                  />
                  <select
                    value={newProfileModel}
                    onChange={(e) => setNewProfileModel(e.target.value)}
                    className="bg-[var(--color-bg)] border border-[var(--color-bd)] rounded px-2 py-1 text-[11px] text-[var(--color-t2)] outline-none focus:border-[var(--color-accent)]"
                  >
                    <option value="">Select model</option>
                    {models.map((m) => (
                      <option key={m.modelId} value={`${m.providerId}/${m.modelId}`}>
                        {m.displayName}
                      </option>
                    ))}
                  </select>
                  <select
                    value={newProfileThinking}
                    onChange={(e) => setNewProfileThinking(e.target.value)}
                    className="bg-[var(--color-bg)] border border-[var(--color-bd)] rounded px-2 py-1 text-[11px] text-[var(--color-t2)] outline-none focus:border-[var(--color-accent)]"
                  >
                    <option value="off">think: off</option>
                    <option value="low">think: low</option>
                    <option value="medium">think: med</option>
                    <option value="high">think: high</option>
                  </select>
                  <button
                    onClick={() => {
                      if (!newProfileName.trim() || !newProfileModel) return;
                      const [provider, modelId] = newProfileModel.split("/");
                      addProfile({
                        id: `custom-${Date.now()}`,
                        name: newProfileName.trim(),
                        provider,
                        modelId,
                        thinking: newProfileThinking,
                      });
                      setNewProfileName("");
                      setNewProfileModel("");
                      setNewProfileThinking("off");
                    }}
                    disabled={!newProfileName.trim() || !newProfileModel}
                    className="px-2 py-1 rounded bg-[var(--color-accent)] text-white text-[11px] font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-25 transition-colors flex items-center gap-1"
                  >
                    <Plus size={12} />
                    Add
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                {profiles.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--color-bgh)] transition-colors">
                    <span className="text-sm">{p.icon || "🤖"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] text-[var(--color-t1)]">{p.name}</div>
                      <div className="text-[10px] text-[var(--color-t3)]">
                        {p.provider}/{p.modelId} · think: {p.thinking}
                      </div>
                    </div>
                    {!["code-reviewer", "architect", "debugger", "speed"].includes(p.id) && (
                      <button
                        onClick={() => removeProfile(p.id)}
                        className="text-[var(--color-t3)] hover:text-[var(--color-danger)] transition-colors p-1"
                        title="Remove profile"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                    {["code-reviewer", "architect", "debugger", "speed"].includes(p.id) && (
                      <span className="text-[9px] text-[var(--color-t3)]">built-in</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "data" && <DataTab />}

          {activeTab === "extensions" && <ExtensionManager />}
        </div>
      </div>
    </div>
  );
}
