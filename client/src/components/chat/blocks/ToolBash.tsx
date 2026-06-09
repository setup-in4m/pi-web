import { useMemo } from "react";
import { escapeHtml } from "../../../lib/sanitize";
import type { ToolSharedProps } from "./ToolGeneric";

const SVG_ICON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

export function ToolBash({ output, durationMs, isRunning }: ToolSharedProps) {
  const label = isRunning ? "Running command…" : "Command completed";
  const truncated = useMemo(() => {
    if (!output) return "";
    return output.length > 5000 ? output.slice(0, 5000) + "\n…(truncated)" : output;
  }, [output]);

  const hasError = useMemo(() => {
    return /error|fail|command not found/i.test((output || "").slice(0, 500));
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

  const exitBadge = hasError ? (
    <span className="px-1 py-0 rounded text-[9px] font-medium bg-[rgba(239,68,68,0.15)] text-[#ef4444]">exit ≠ 0</span>
  ) : (
    <span className="px-1 py-0 rounded text-[9px] font-medium bg-[rgba(34,197,94,0.12)] text-[#22c55e]">exit 0</span>
  );

  return (
    <details className="tool-card my-1 px-2 py-1.5 rounded border border-[var(--color-bdl)] bg-[var(--color-bg2)]" open>
      <summary className="text-[10px] text-[var(--color-t2)] cursor-pointer hover:text-[var(--color-t1)] select-none flex items-center gap-1.5">
        <span>{SVG_ICON}</span>
        <span>{label}</span>
        {durationMs != null && (
          <span className="text-[8px] text-[var(--color-t3)] ml-auto">⏱ {(durationMs / 1000).toFixed(1)}s</span>
        )}
      </summary>
      <div className="mt-1">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[9px] text-[var(--color-t3)] uppercase">Output</span>
          {exitBadge}
        </div>
        <pre className="p-1.5 bg-[#0d1117] rounded border border-[var(--color-bd)] overflow-x-auto max-h-[300px] overflow-y-auto text-[11px] leading-relaxed">
          <code>{escapeHtml(truncated)}</code>
        </pre>
      </div>
    </details>
  );
}
