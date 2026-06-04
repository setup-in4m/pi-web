import { Bot } from "lucide-react";

interface Props {
  task: string;
  status: "running" | "done" | "error";
  result?: string;
  usage?: { inputTokens?: number; outputTokens?: number; cost?: number };
}

export function SubAgentCard({ task, status, result, usage }: Props) {
  return (
    <details className="sub-agent-card my-1.5 px-2.5 py-2 rounded-lg border border-[rgba(59,130,246,0.3)] bg-[rgba(59,130,246,0.06)]" open={status === "done"}>
      <summary className="flex items-center gap-2 text-[10px] cursor-pointer hover:text-[var(--color-t1)] select-none">
        <Bot size={12} className="text-[#3b82f6]" />
        <span className="font-medium text-[var(--color-t2)]">Sub-agent</span>
        <span className="text-[var(--color-t3)] flex-1 truncate">{task}</span>
        {status === "running" && (
          <span className="flex items-center gap-1 text-[var(--color-warning)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-warning)] animate-pulse" />
            running
          </span>
        )}
        {status === "done" && <span className="text-[var(--color-success)] text-[9px]">✅ done</span>}
        {status === "error" && <span className="text-[var(--color-danger)] text-[9px]">❌ error</span>}
        {usage && (
          <span className="text-[8px] text-[var(--color-t3)]">
            {[
              usage.inputTokens != null && `in:${usage.inputTokens}`,
              usage.outputTokens != null && `out:${usage.outputTokens}`,
              usage.cost != null && `$${Number(usage.cost).toFixed(4)}`,
            ]
              .filter(Boolean)
              .join(" ")}
          </span>
        )}
      </summary>
      {result && (
        <div className="mt-2 text-[11px] text-[var(--color-t1)] whitespace-pre-wrap">{result}</div>
      )}
    </details>
  );
}
