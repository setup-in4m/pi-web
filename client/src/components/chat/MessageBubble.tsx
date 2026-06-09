import { useMemo, useCallback, useState, useEffect, memo } from "react";
import type { MessageRecord, ContentBlock } from "../../lib/api";
import { renderMarkdown, escapeHtml } from "../../lib/markdown";
import { formatTime } from "../../lib/time";
import { useModelStore } from "../../stores/modelStore";
import { usePanelStore } from "../../stores/panelStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { TextBlock, ThinkingBlock, ToolBlock, SubAgentBlock } from "./blocks";

interface Props {
  message: MessageRecord;
  streaming?: boolean;
  panelIndex?: number;
}

/** Generate a consistent HSL color from a model name */
function modelDotColor(name?: string): string {
  if (!name) return 'var(--color-accent)';
  let hash = 0;
  const key = name.toLowerCase();
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  return `hsl(${((hash % 360) + 360) % 360}, 55%, 60%)`;
}

function estimateTokens(content: string): number {
  const div = document.createElement("div");
  div.innerHTML = content;
  const plain = (div.textContent || div.innerText || content).trim();
  return Math.max(1, Math.round(plain.length / 4));
}

function executeInlineCode(code: string, lang: string, btn: HTMLElement) {
  const decoded = code
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#039;/g, "'");

  const origHTML = btn.innerHTML;

  if (lang === "javascript" || lang === "js") {
    try {
      btn.innerHTML = '<span style="font-size:10px">Running…</span>';
      const result = new Function(`"use strict"; return (${decoded})`)();
      btn.innerHTML = origHTML;
      const el = document.createElement("div");
      el.style.cssText = "position:fixed;bottom:60px;right:16px;max-width:400px;max-height:200px;overflow:auto;background:var(--color-bg2);border:1px solid var(--color-bdl);border-radius:8px;padding:8px 12px;z-index:100;font-family:var(--font-mono);font-size:12px;color:var(--color-t1);box-shadow:0 4px 12px rgba(0,0,0,0.4)";
      el.textContent = String(result).slice(0, 1000);
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 5000);
    } catch (e: any) {
      btn.innerHTML = origHTML;
      const el = document.createElement("div");
      el.style.cssText = "position:fixed;bottom:60px;right:16px;max-width:400px;max-height:200px;overflow:auto;background:var(--color-danger);border:1px solid var(--color-danger);border-radius:8px;padding:8px 12px;z-index:100;font-family:var(--font-mono);font-size:12px;color:#fff;box-shadow:0 4px 12px rgba(0,0,0,0.4)";
      el.textContent = "Error: " + e.message;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 5000);
    }
  } else {
    btn.innerHTML = '<span style="font-size:10px">→ pi</span>';
    setTimeout(() => { btn.innerHTML = origHTML; }, 1000);
  }
}

/** Render a single content block as a React element */
function renderBlock(block: ContentBlock, index: number, opts: { streaming: boolean; panelIndex?: number; defaultCollapsed: boolean }): React.ReactNode {
  switch (block.type) {
    case "text":
      return opts.streaming ? (
        <span key={index}>
          {escapeHtml(block.content)}
          <span className="streaming-cursor">▊</span>
        </span>
      ) : (
        <div key={index} className="block-content">
          <TextBlock content={block.content} />
        </div>
      );
    case "thinking": {
      const thinkId = opts.panelIndex != null ? `stream-${opts.panelIndex}-${index}` : undefined;
      return (
        <div key={index} className="block-content">
          <ThinkingBlock
            content={block.content}
            streaming={opts.streaming}
            defaultCollapsed={opts.defaultCollapsed}
            thinkId={thinkId}
          />
        </div>
      );
    }
    case "tool_start":
    case "tool_end":
      return (
        <div key={index} className="block-content">
          <ToolBlock block={block} />
        </div>
      );
    case "subagent_start":
    case "subagent_delta":
    case "subagent_end":
      return (
        <div key={index} className="block-content">
          <SubAgentBlock block={block} />
        </div>
      );
    default:
      return null;
  }
}

export const MessageBubble = memo(function MessageBubble({ message, streaming, panelIndex }: Props) {
  const isUser = message.role === "user";
  const [modelInfoOpen, setModelInfoOpen] = useState(false);

  useEffect(() => {
    if (!streaming) return;
    const id = "streaming-cursor-css";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      @keyframes blink-cursor {
        0%,100%{opacity:1}
        50%{opacity:0}
      }
      .streaming-cursor{animation:blink-cursor 1s step-end infinite;color:var(--color-accent);font-weight:700}
    `;
    document.head.appendChild(style);
  }, [streaming]);

  // Blocks-based message: render from blocks array
  const hasBlocks = message.blocks && message.blocks.length > 0;
  // True while streaming with no content yet (placeholder waiting for first delta)
  const isEmptyStreaming = streaming && !isUser && !hasBlocks && !message.content;

  const content = message.content ?? '';
  const defaultCollapsed = useSettingsStore((s) => s.thinkingCollapsed);
  const hideThinking = usePanelStore((s) => {
    if (panelIndex == null) return false;
    return s.panels[panelIndex]?.hideThinking ?? false;
  });

  /** For user messages or messages without blocks: render markdown/plain text */
  const formatted = useMemo<string>(() => {
    if (isUser) return formatSimple(content);
    if (!hasBlocks) {
      // Legacy message (no blocks) or pure text: render as markdown
      if (streaming) {
        return escapeHtml(content).replace(/\n/g, '<br>');
      }
      return renderMarkdown(content);
    }
    // Messages with blocks: React elements handle rendering below
    return '';
  }, [content, isUser, streaming, hasBlocks]);

  /** During streaming or when blocks are present, render each block as a React component */
  const blockElements = useMemo(() => {
    if (!hasBlocks || !message.blocks) return null;
    if (!streaming && message.content) {
      // Post-streaming: message.content has the final HTML from agent_end blocksToHtml.
      // But blocks array is preferred for React rendering. If content has thinking-section,
      // it was rendered by blocksToHtml — but we render from blocks directly now.
      // Skip HTML rendering — blocks are the source of truth.
    }
    return message.blocks.map((block, i) =>
      renderBlock(block, i, { streaming: !!streaming, panelIndex, defaultCollapsed: !!defaultCollapsed })
    );
  }, [hasBlocks, message.blocks, streaming, panelIndex, defaultCollapsed]);

  // Check if ALL blocks are infra (tool/subagent/thinking) with no text — hide role line
  const allInfra = hasBlocks && message.blocks!.every(b => b.type !== "text");

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Legacy thinking toggle (HTML-rendered thinking sections)
    const thinkingHeader = target.closest("[data-pi-toggle='thinking']");
    if (thinkingHeader) {
      const section = thinkingHeader.closest(".thinking-section");
      if (section) {
        const wasCollapsed = section.classList.contains('collapsed');
        section.classList.toggle('collapsed');
        const thinkId = section.getAttribute('data-think-id');
        if (thinkId && (window as any).__thinkToggle) {
          (window as any).__thinkToggle(thinkId, wasCollapsed);
        }
      }
      return;
    }

    if (target.closest(".copy-code-btn")) {
      const btn = target.closest(".copy-code-btn") as HTMLElement;
      const c = btn.getAttribute("data-code");
      if (c) {
        const d = c.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#039;/g, "'");
        navigator.clipboard.writeText(d).then(() => {
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
          setTimeout(() => {
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
          }, 1500);
        }).catch(() => {});
      }
    }
    if (target.closest(".run-code-btn")) {
      const btn = target.closest(".run-code-btn") as HTMLElement;
      const c = btn.getAttribute("data-code");
      const l = btn.getAttribute("data-lang");
      if (c && l) executeInlineCode(c, l, btn);
    }
  }, []);

  // ── Model info for assistant messages ────────────────
  const panel = usePanelStore((s) => panelIndex != null ? s.panels[panelIndex] : undefined);
  const models = useModelStore((s) => s.models);
  const defaultProvider = useModelStore((s) => s.defaultProvider);
  const defaultModel = useModelStore((s) => s.defaultModel);
  const currentModel = panel?.model || { provider: defaultProvider, modelId: defaultModel };
  const modelObj = currentModel ? models.find(m => m.providerId === currentModel.provider && m.modelId === currentModel.modelId) : undefined;
  const modelDisplay = modelObj?.displayName || currentModel?.modelId || `${currentModel?.provider}/${currentModel?.modelId}`;

  const dotColor = isUser ? 'var(--color-accent)' : modelDotColor(modelDisplay);
  const roleLabel = isUser ? 'You' : (modelDisplay?.split('/').pop() || 'pi');
  const tokens = estimateTokens(message.content || '');

  // Pure infrastructure messages (no text blocks): render inline without role line
  if (allInfra && !isUser && !streaming) {
    return (
      <div className="mb-0 animate-[fadeIn_0.2s_ease]">
        <div onClick={handleClick} className="text-[var(--color-t1)]">
          {blockElements}
        </div>
      </div>
    );
  }

  // Empty streaming placeholder — show subtle waiting indicator
  if (isEmptyStreaming) {
    return (
      <div className="flex flex-col mb-2 animate-[fadeIn_0.2s_ease]">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
            style={{ backgroundColor: dotColor }}
          />
          <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: dotColor }}>
            {roleLabel}
          </span>
          <span className="text-[7px] text-[var(--color-t3)]">thinking…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col mb-2 animate-[fadeIn_0.2s_ease] group/msg">
      {/* Role line */}
      <div className="flex items-center gap-1.5 mb-0.5 relative">
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: dotColor }}
        />
        <span
          className="text-[9px] font-semibold uppercase tracking-wide cursor-pointer hover:underline"
          style={{ color: dotColor }}
          onClick={() => !isUser && setModelInfoOpen(!modelInfoOpen)}
          title={!isUser ? 'Click for model info' : undefined}
        >
          {roleLabel}
        </span>
        {/* Model info popup */}
        {!isUser && modelInfoOpen && modelObj && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setModelInfoOpen(false)} />
            <div className="absolute top-full left-0 mt-1 z-50 bg-[var(--color-bg2)] border border-[var(--color-bdl)] rounded-lg shadow-2xl p-3 min-w-[200px] text-[10px]">
              <div className="font-semibold text-[var(--color-t1)] text-[11px] mb-1">{modelObj.displayName}</div>
              <div className="text-[var(--color-t3)]">Provider: {modelObj.providerId}</div>
              {modelObj.contextWindow && <div className="text-[var(--color-t3)]">Context: {modelObj.contextWindow >= 1000 ? `${modelObj.contextWindow/1000}K` : modelObj.contextWindow} tokens</div>}
              {modelObj.cost && <div className="text-[var(--color-t3)]">Pricing: ${modelObj.cost.input.toFixed(0)}/${(modelObj.cost.output ?? modelObj.cost.input).toFixed(0)} per 1M</div>}
              {modelObj.supportsThinking && <div className="text-[var(--color-accent)] mt-1">✓ Extended thinking</div>}
            </div>
          </>
        )}
        <span className="text-[7px] text-[var(--color-t3)]">
          {formatTime(message.timestamp)}
        </span>
        <span
          className="text-[7px] text-[var(--color-t3)] cursor-help"
          title={`~${tokens.toLocaleString()} tokens`}
        >
          ~{tokens.toLocaleString()} tok
        </span>
      </div>

      {/* Message body */}
      <div className={`text-xs leading-relaxed ${
        isUser ? "bg-[var(--color-bg3)] border border-[var(--color-bdl)] rounded px-3 py-2" : ""
      }`}>
        <div onClick={handleClick} className="text-[var(--color-t1)] whitespace-pre-wrap break-words [&_p]:my-0.5">
          {/* Render block components when available */}
          {blockElements}
          {/* Fallback: rendered markdown/HTML for user messages or legacy */}
          {!blockElements && formatted && (
            <span dangerouslySetInnerHTML={{ __html: formatted }} />
          )}
          {streaming && !blockElements && !formatted && (
            <span className="streaming-cursor" aria-hidden="true">▊</span>
          )}
        </div>
      </div>
    </div>
  );
});

function formatSimple(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
}
