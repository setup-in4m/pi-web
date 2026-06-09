import { useMemo } from "react";
import { escapeHtml } from "../../../lib/sanitize";
import type { ToolSharedProps } from "./ToolGeneric";

const SVG_ICON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </svg>
);

export function ToolWrite({ output, durationMs, isRunning }: ToolSharedProps) {
  const label = isRunning ? "Writing file…" : "Edit applied";
  const lines = useMemo(() => {
    if (!output) return [];
    const truncated = output.length > 5000 ? output.slice(0, 5000) + "\n…(truncated)" : output;
    return truncated.split("\n");
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
            {lines.map((line, i) => {
              const esc = escapeHtml(line) || " ";
              if (line.startsWith("+")) {
                return (
                  <tr key={i} className="bg-[rgba(34,197,94,0.08)]">
                    <td className="w-[1em] text-center text-[#22c55e] pl-2 py-0 select-none">+</td>
                    <td className="pl-1 py-0 text-[var(--color-t1)] whitespace-pre-wrap break-all">{esc}</td>
                  </tr>
                );
              }
              if (line.startsWith("-")) {
                return (
                  <tr key={i} className="bg-[rgba(239,68,68,0.08)]">
                    <td className="w-[1em] text-center text-[#ef4444] pl-2 py-0 select-none">-</td>
                    <td className="pl-1 py-0 text-[var(--color-t1)] whitespace-pre-wrap break-all">{esc}</td>
                  </tr>
                );
              }
              if (line.startsWith("@@")) {
                return (
                  <tr key={i} className="bg-[rgba(59,130,246,0.08)]">
                    <td className="text-[#3b82f6] pl-2 py-0 select-none">{esc}</td>
                  </tr>
                );
              }
              return (
                <tr key={i} className="bg-[#0d1117]">
                  <td className="w-[1em] text-center text-[#6e7681] pl-2 py-0 select-none"> </td>
                  <td className="pl-1 py-0 text-[var(--color-t1)] whitespace-pre-wrap break-all">{esc}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
