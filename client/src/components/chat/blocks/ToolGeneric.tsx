import { escapeHtml } from "../../../lib/sanitize";

export interface ToolSharedProps {
  toolName: string;
  output?: string;
  durationMs?: number;
  status?: "success" | "error";
  isRunning?: boolean;
}

const SVG_GEAR = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export function ToolGeneric({ toolName, output, durationMs, isRunning }: ToolSharedProps) {
  const label = isRunning ? "Running tool…" : `\`${toolName}\` completed`;

  if (isRunning) {
    return (
      <div className="tool-card tool-running my-1 px-2 py-1.5 rounded border border-[var(--color-bdl)] bg-[var(--color-bg2)]">
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-warning)]">
          <span className="animate-spin inline-block">{SVG_GEAR}</span>
          <span className="font-medium">{label}</span>
        </div>
      </div>
    );
  }

  const truncated = output && output.length > 5000
    ? output.slice(0, 5000) + "\n…(truncated)"
    : (output || "");

  return (
    <details className="tool-card my-1 px-2 py-1.5 rounded border border-[var(--color-bdl)] bg-[var(--color-bg2)]" open>
      <summary className="text-[10px] text-[var(--color-t2)] cursor-pointer hover:text-[var(--color-t1)] select-none flex items-center gap-1.5">
        <span>{SVG_GEAR}</span>
        <span>{label}</span>
        {durationMs != null && (
          <span className="text-[8px] text-[var(--color-t3)] ml-auto">⏱ {(durationMs / 1000).toFixed(1)}s</span>
        )}
      </summary>
      <div className="mt-1">
        <pre className="p-1.5 bg-[#0d1117] rounded border border-[var(--color-bd)] overflow-x-auto max-h-[300px] overflow-y-auto text-[11px] leading-relaxed">
          <code>{escapeHtml(truncated)}</code>
        </pre>
      </div>
    </details>
  );
}
