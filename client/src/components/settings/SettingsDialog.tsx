import { useState, useEffect } from "react";
import { X, Settings, Sun, Moon, Monitor, Palette, Type, User, Plus, Trash2 } from "lucide-react";
import { useThemeStore, type ThemeMode, type AccentColor, ACCENT_MAP, type Density } from "../../stores/themeStore";
import { useProfileStore } from "../../stores/profileStore";
import { useModelStore } from "../../stores/modelStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: Props) {
  const { mode, accent, density, fontScale, setMode, setAccent, setDensity, setFontScale } = useThemeStore();
  const { profiles, addProfile, removeProfile } = useProfileStore();
  const { models } = useModelStore();
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileModel, setNewProfileModel] = useState("");
  const [newProfileThinking, setNewProfileThinking] = useState("off");
  const [activeTab, setActiveTab] = useState<"appearance" | "models" | "shortcuts" | "profiles">("appearance");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-[520px] max-h-[80vh] bg-[var(--color-bg2)] border border-[var(--color-bdl)] rounded-xl shadow-2xl flex flex-col overflow-hidden z-10">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-bd)] flex-shrink-0">
          <Settings size={16} className="text-[var(--color-accent)]" />
          <span className="text-sm font-semibold">Settings</span>
          <button onClick={onClose} className="ml-auto text-[var(--color-t3)] hover:text-[var(--color-t1)] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--color-bd)] px-4 flex-shrink-0">
          {(["appearance", "models", "shortcuts", "profiles"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-[11px] font-medium border-b-2 transition-colors ${activeTab === tab ? "border-[var(--color-accent)] text-[var(--color-accent)]" : "border-transparent text-[var(--color-t3)] hover:text-[var(--color-t2)]"}`}
            >
              {tab === "appearance" ? "Appearance" : tab === "models" ? "Models" : tab === "shortcuts" ? "Shortcuts" : "Profiles"}
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
            </div>
          )}

          {activeTab === "shortcuts" && (
            <div className="flex flex-col gap-1 text-[11px]">
              {[
                ["Ctrl+T", "New panel"],
                ["Ctrl+W", "Close panel"],
                ["Ctrl+Tab", "Next panel"],
                ["Ctrl+1-8", "Switch to panel"],
                ["Ctrl+B", "Toggle sidebar"],
                ["Ctrl+Shift+F", "Focus mode"],
                ["Ctrl+P", "Command palette"],
                ["Ctrl+Shift+1", "Single layout"],
                ["Ctrl+Shift+H", "Horizontal split"],
                ["Ctrl+Shift+V", "Vertical split"],
                ["Ctrl+Shift+G", "2×2 grid"],
                ["Ctrl+Shift+3", "3 columns"],
                ["Enter", "Send message"],
                ["Shift+Enter", "New line"],
                ["Escape", "Cancel edit"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[var(--color-bgh)]">
                  <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg3)] border border-[var(--color-bd)] text-[10px] font-mono text-[var(--color-t2)] min-w-[80px] text-center">
                    {key}
                  </kbd>
                  <span className="text-[var(--color-t2)]">{desc}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "models" && (
            <div className="text-[11px] text-[var(--color-t2)]">
              <p>Model configuration is managed via the pi CLI.</p>
              <p className="mt-1">Run <code className="bg-[var(--color-bg3)] px-1 py-0.5 rounded text-[10px]">pi models</code> to manage providers and API keys.</p>
            </div>
          )}

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
        </div>
      </div>
    </div>
  );
}
