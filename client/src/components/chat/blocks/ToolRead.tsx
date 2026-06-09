import { useMemo } from "react";
import { escapeHtml } from "../../../lib/sanitize";
import type { ToolSharedProps } from "./ToolGeneric";

const SVG_ICON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

export function ToolRead({ output, durationMs, isRunning }: ToolSharedProps) {
  const label = isRunning ? "Reading file…" : "File read";
  const rows = useMemo(() => {
    if (!output) return [];
    const truncated = output.length > 5000 ? output.slice(0, 5000) + "\n…(truncated)" : output;
    return truncated.split("\n").map((line, i) => ({ num: i + 1, text: line }));
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

  const numWidth = String(rows.length).length;

  return (
    <details className="tool-card my-1 px-2 py-1.5 rounded border border-[var(--color-bdl)] bg-[var(--color-bg2)]" open>
      <summary className="text-[10px] text-[var(--color-t2)] cursor-pointer hover:text-[var(--color-t1)] select-none flex items-center gap-1.5">
        <span>{SVG_ICON}</span>
        <span>{label}</span>
        {durationMs != null && (
          <span className="text-[8px] text-[var(--color-t3)] ml-auto">⏱ {(durationMs / 1000).toFixed(1)}s</span>
        )}
      </summary>
      <div className="mt-1 overflow-auto max-h-[350px] rounded border border-[var(--color-bd)]">
        <table className="w-full text-[11px] leading-relaxed font-mono border-collapse">
          <tbody className="font-mono">
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-[#0d1117]" : "bg-[#0a0e14]"}>
                <td
                  className="text-right pr-3 pl-2 py-0 text-[#6e7681] select-none border-r border-[var(--color-bd)] align-top whitespace-nowrap"
                  style={{ minWidth: `${numWidth + 2}ch` }}
                >
                  {row.num}
                </td>
                <td className="pl-2 py-0 text-[var(--color-t1)] whitespace-pre-wrap break-all">
                  {escapeHtml(row.text) || " "}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
