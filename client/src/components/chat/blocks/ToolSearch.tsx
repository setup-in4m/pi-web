import { useMemo } from "react";
import { escapeHtml } from "../../../lib/sanitize";
import type { ToolSharedProps } from "./ToolGeneric";

const SVG_ICON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);

export function ToolSearch({ output, durationMs, isRunning }: ToolSharedProps) {
  const label = isRunning ? "Searching…" : "Search results";
  const parsed = useMemo(() => {
    if (!output) return [];
    const truncated = output.length > 5000 ? output.slice(0, 5000) + "\n…(truncated)" : output;
    const lines = truncated.split("\n").filter(Boolean);
    const results: { file: string; line: string; match: string }[] = [];
    for (const raw of lines) {
      const clean = raw.replace(/\x1b\[[0-9;]*m/g, "");
      const m = clean.match(/^(.+?):(\d+):\s*(.*)$/);
      if (m) {
        results.push({ file: m[1], line: m[2], match: m[3] });
      } else if (clean.trim()) {
        results.push({ file: "", line: "", match: clean });
      }
    }
    return results;
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

  if (parsed.length === 0) {
    return (
      <details className="tool-card my-1 px-2 py-1.5 rounded border border-[var(--color-bdl)] bg-[var(--color-bg2)]" open>
        <summary className="text-[10px] text-[var(--color-t2)] cursor-pointer hover:text-[var(--color-t1)] select-none flex items-center gap-1.5">
          <span>{SVG_ICON}</span>
          <span>{label}</span>
          {durationMs != null && (
            <span className="text-[8px] text-[var(--color-t3)] ml-auto">⏱ {(durationMs / 1000).toFixed(1)}s</span>
          )}
        </summary>
        <div className="mt-1 text-[10px] text-[var(--color-t3)]">No matches found</div>
      </details>
    );
  }

  return (
    <details className="tool-card my-1 px-2 py-1.5 rounded border border-[var(--color-bdl)] bg-[var(--color-bg2)]" open>
      <summary className="text-[10px] text-[var(--color-t2)] cursor-pointer hover:text-[var(--color-t1)] select-none flex items-center gap-1.5">
        <span>{SVG_ICON}</span>
        <span>{label}</span>
        {durationMs != null && (
          <span className="text-[8px] text-[var(--color-t3)] ml-auto">⏱ {(durationMs / 1000).toFixed(1)}s</span>
        )}
      </summary>
      <div className="mt-1 overflow-auto max-h-[250px] rounded border border-[var(--color-bd)]">
        <table className="w-full text-[10px] leading-relaxed border-collapse">
          <thead className="sticky top-0 bg-[var(--color-bg3)] text-[var(--color-t2)] font-medium">
            <tr>
              <th className="text-left px-2 py-0.5 border-b border-[var(--color-bd)]">File</th>
              <th className="text-right px-2 py-0.5 border-b border-[var(--color-bd)] w-[4ch]">#</th>
              <th className="text-left px-2 py-0.5 border-b border-[var(--color-bd)]">Match</th>
            </tr>
          </thead>
          <tbody>
            {parsed.slice(0, 200).map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-[#0d1117]" : "bg-[#0a0e14]"}>
                <td className="px-2 py-0 font-mono text-[var(--color-accent)] whitespace-nowrap">{escapeHtml(row.file)}</td>
                <td className="px-2 py-0 text-right text-[#6e7681] font-mono">{escapeHtml(row.line)}</td>
                <td className="px-2 py-0 text-[var(--color-t1)] font-mono whitespace-pre-wrap break-all">{escapeHtml(row.match)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
