import { useState, useEffect } from "react";
import { Puzzle, Download, ToggleLeft, ToggleRight, RefreshCw, AlertTriangle } from "lucide-react";
import { getExtensions, installExtension, toggleExtension } from "../../lib/api";

interface Extension {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  description?: string;
}

export function ExtensionManager() {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);
  const [installPath, setInstallPath] = useState("");
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState("");

  const fetchExtensions = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getExtensions();
      setExtensions(data.extensions || []);
    } catch (e: any) {
      setError(e.message || "Failed to load extensions");
    }
    setLoading(false);
  };

  useEffect(() => { fetchExtensions(); }, []);

  const handleInstall = async () => {
    if (!installPath.trim()) return;
    setInstalling(true);
    setError("");
    try {
      await installExtension(installPath.trim());
      setInstallPath("");
      await fetchExtensions();
    } catch (e: any) {
      setError(e.message);
    }
    setInstalling(false);
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    setExtensions((prev) =>
      prev.map((ext) => (ext.id === id ? { ...ext, enabled: !enabled } : ext))
    );
    try {
      await toggleExtension(id, !enabled);
    } catch (e: any) {
      // Revert on error
      setExtensions((prev) =>
        prev.map((ext) => (ext.id === id ? { ...ext, enabled } : ext))
      );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Install */}
      <div className="p-3 rounded-lg border border-[var(--color-bd)] bg-[var(--color-bg3)]">
        <div className="text-[11px] font-medium text-[var(--color-t2)] mb-2 flex items-center gap-1.5">
          <Download size={12} />
          Install Extension
        </div>
        <div className="flex gap-2">
          <input
            value={installPath}
            onChange={(e) => setInstallPath(e.target.value)}
            placeholder="Path or URL to extension…"
            className="flex-1 bg-[var(--color-bg)] border border-[var(--color-bd)] rounded px-2 py-1 text-[11px] text-[var(--color-t1)] outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-t3)]"
          />
          <button
            onClick={handleInstall}
            disabled={!installPath.trim() || installing}
            className="px-2 py-1 rounded bg-[var(--color-accent)] text-white text-[11px] font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-25 transition-colors flex items-center gap-1"
          >
            {installing ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : (
              <Download size={12} />
            )}
            Install
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium text-[var(--color-t2)] flex items-center gap-1.5">
          <Puzzle size={12} />
          Installed Extensions
        </div>
        <button
          onClick={fetchExtensions}
          className="text-[var(--color-t3)] hover:text-[var(--color-t2)] transition-colors p-0.5"
          title="Refresh"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-[10px] text-[var(--color-danger)] px-3 py-1.5 rounded border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5">
          <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading && extensions.length === 0 && (
        <div className="text-[11px] text-[var(--color-t3)] italic">Loading extensions…</div>
      )}

      {!loading && extensions.length === 0 && !error && (
        <div className="text-[11px] text-[var(--color-t3)] italic">No extensions installed.</div>
      )}

      <div className="flex flex-col gap-1">
        {extensions.map((ext) => (
          <div
            key={ext.id}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--color-bgh)] transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-[var(--color-t1)]">{ext.name || ext.id}</div>
              <div className="text-[10px] text-[var(--color-t3)]">
                v{ext.version}
                {ext.name && <span> · <code className="text-[9px]">{ext.id}</code></span>}
                {ext.description && ` · ${ext.description}`}
              </div>
            </div>
            <button
              onClick={() => handleToggle(ext.id, ext.enabled)}
              className="text-[var(--color-t3)] hover:text-[var(--color-t2)] transition-colors"
              title={ext.enabled ? "Disable" : "Enable"}
            >
              {ext.enabled ? (
                <ToggleRight size={16} className="text-[var(--color-success)]" />
              ) : (
                <ToggleLeft size={16} />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
