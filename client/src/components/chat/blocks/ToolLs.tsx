import { useMemo } from "react";
import { escapeHtml } from "../../../lib/sanitize";
import type { ToolSharedProps } from "./ToolGeneric";

const SVG_ICON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

export function ToolLs({ output, durationMs, isRunning }: ToolSharedProps) {
  const label = isRunning ? "Listing directory…" : "Directory listing";
  const { dirs, files, raw } = useMemo(() => {
    if (!output) return { dirs: [] as string[], files: [] as string[], raw: "" };
    const truncated = output.length > 5000 ? output.slice(0, 5000) + "\n…(truncated)" : output;
    const lines = truncated.split("\n").filter(l => l.trim());
    const d: string[] = [];
    const f: string[] = [];
    for (const line of lines) {
      const clean = line.replace(/\x1b\[[0-9;]*m/g, "").replace(/^\s*[-–*>·]\s*/, "").trim();
      if (!clean) continue;
      if (clean.endsWith("/") || clean.endsWith("\\") || !clean.includes(".")) {
        d.push(clean.replace(/[/\\]$/, ""));
      } else {
        f.push(clean);
      }
    }
    return { dirs: d, files: f, raw: truncated };
  }, [output]);

  if (isRunning) {
    return (
      <div className="tool-card tool-running my-1 px-2 py-1.5 rounded border border-[var(--color-bdl)] bg-[var(--color-bg2)]">
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-warning)]">
          <span className="animate-spin inline-block">{SVG_ICON}</span>
          <span className="font-medium">{label}</span>
        </div>
      </div>
    );
  }

  const hasRawFallback = dirs.length === 0 && files.length === 0;

  return (
    <details className="tool-card my-1 px-2 py-1.5 rounded border border-[var(--color-bdl)] bg-[var(--color-bg2)]" open>
      <summary className="text-[10px] text-[var(--color-t2)] cursor-pointer hover:text-[var(--color-t1)] select-none flex items-center gap-1.5">
        <span>{SVG_ICON}</span>
        <span>{label}</span>
        {durationMs != null && (
          <span className="text-[8px] text-[var(--color-t3)] ml-auto">⏱ {(durationMs / 1000).toFixed(1)}s</span>
        )}
      </summary>

      {hasRawFallback ? (
        <div className="mt-1">
          <pre className="p-1.5 bg-[#0d1117] rounded border border-[var(--color-bd)] overflow-x-auto max-h-[300px] overflow-y-auto text-[11px] leading-relaxed">
            <code>{escapeHtml(raw)}</code>
          </pre>
        </div>
      ) : (
        <div className="mt-1 overflow-auto max-h-[300px] rounded border border-[var(--color-bd)] bg-[#0d1117] p-1.5">
          {dirs.sort().map((d, i) => (
            <div key={`d-${i}`} className="flex items-center gap-1 py-0 hover:bg-[var(--color-bgh)] px-1 rounded">
              <span className="text-xs">📁</span>
              <span className="text-[11px] font-mono text-[var(--color-accent)]">{escapeHtml(d)}/</span>
            </div>
          ))}
          {files.sort().map((f, i) => (
            <div key={`f-${i}`} className="flex items-center gap-1 py-0 hover:bg-[var(--color-bgh)] px-1 rounded">
              <span className="text-xs">📄</span>
              <span className="text-[11px] font-mono text-[var(--color-t1)]">{escapeHtml(f)}</span>
            </div>
          ))}
          <div className="text-[9px] text-[var(--color-t3)] mt-1 pt-1 border-t border-[var(--color-bd)]">
            {dirs.length} dirs, {files.length} files ({dirs.length + files.length} total)
          </div>
        </div>
      )}
    </details>
  );
}
