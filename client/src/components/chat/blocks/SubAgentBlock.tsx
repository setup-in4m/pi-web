import type { ContentBlock, UsageInfo } from "../../../lib/api";
import { escapeHtml } from "../../../lib/sanitize";

type SubAgentBlock = Extract<ContentBlock, { type: `subagent_${string}` }>;

interface Props { block: SubAgentBlock }

export function SubAgentBlock({ block }: Props) {
  switch (block.type) {
    case "subagent_start":
      return <SubAgentRunning task={block.task} subAgentId={block.subAgentId} />;
    case "subagent_delta":
      return <SubAgentRunning task={block.task} subAgentId={block.subAgentId} content={block.content} />;
    case "subagent_end":
      return <SubAgentDone task={block.task} subAgentId={block.subAgentId} result={block.result} usage={block.usage} />;
    default:
      return null;
  }
}

function SubAgentRunning({ task, subAgentId, content }: { task: string; subAgentId: string; content?: string }) {
  return (
    <div
      className="sub-agent-card my-1.5 px-2.5 py-2 rounded-lg border border-[var(--color-accent)]/30 bg-[rgba(59,130,246,0.06)]"
      data-sub-agent={escapeHtml(subAgentId)}
      data-task={escapeHtml(task)}
    >
      <div className="flex items-center gap-2 text-[10px]">
        <span className="text-sm">🤖</span>
        <span className="font-medium text-[var(--color-t2)]">Sub-agent</span>
        <span className="text-[var(--color-t3)] flex-1 truncate">{escapeHtml(task)}</span>
        <span className="flex items-center gap-1 text-[var(--color-warning)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-warning)] animate-pulse" />
          running
        </span>
      </div>
      {content && (
        <div className="mt-2 text-[11px] text-[var(--color-t2)] whitespace-pre-wrap" style={{ display: 'block' }}>
          {escapeHtml(content)}
        </div>
      )}
    </div>
  );
}

function SubAgentDone({ task, subAgentId, result, usage }: { task: string; subAgentId: string; result: string; usage?: UsageInfo }) {
  const usageStr = usage
    ? [
        usage.inputTokens != null && `in:${usage.inputTokens}`,
        usage.outputTokens != null && `out:${usage.outputTokens}`,
        usage.cost != null && `$${Number(usage.cost).toFixed(4)}`,
      ].filter(Boolean).join(" ")
    : "";

  return (
    <details
      className="sub-agent-card my-1.5 px-2.5 py-2 rounded-lg border border-[rgba(59,130,246,0.3)] bg-[rgba(59,130,246,0.06)]"
      data-sub-agent={escapeHtml(subAgentId)}
      open
    >
      <summary className="flex items-center gap-2 text-[10px] cursor-pointer hover:text-[var(--color-t1)] select-none">
        <span className="text-sm">🤖</span>
        <span className="font-medium text-[var(--color-t2)]">Sub-agent</span>
        <span className="text-[var(--color-t3)] flex-1 truncate">{escapeHtml(task)}</span>
        <span className="text-[var(--color-success)]">✅ done</span>
        {usageStr && <span className="text-[8px] text-[var(--color-t3)]">{escapeHtml(usageStr)}</span>}
      </summary>
      <div className="mt-2 text-[11px] text-[var(--color-t1)] whitespace-pre-wrap">{escapeHtml(result)}</div>
    </details>
  );
}
