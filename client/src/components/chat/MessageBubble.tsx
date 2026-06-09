import { useMemo, useCallback, useState, useEffect, memo } from "react";
import type { MessageRecord } from "../../lib/api";
import { renderMarkdown, escapeHtml } from "../../lib/markdown";
import { formatTime } from "../../lib/time";
import { useModelStore } from "../../stores/modelStore";
import { usePanelStore, blocksToHtml } from "../../stores/panelStore";
import { useSettingsStore } from "../../stores/settingsStore";

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

/** Thinking block as a React component — owns its own collapse state via useState.
 *  Toggle survives re-renders because React preserves component state
 *  when key/index stays the same across renders. */
function ThinkingBlock({ content, streaming, defaultCollapsed, thinkId }: { content: string; streaming: boolean; defaultCollapsed: boolean; thinkId?: string }) {
  // Restore toggle from global state if remounted (virtualizer recycle safety)
  const initialExpanded = thinkId && (window as any).__thinkIsExpanded
    ? (window as any).__thinkIsExpanded(thinkId)
    : null;
  const [collapsed, setCollapsed] = useState(
    initialExpanded !== null ? !initialExpanded : defaultCollapsed
  );
  const toggle = useCallback(() => {
    setCollapsed(c => {
      const next = !c;
      if (thinkId && (window as any).__thinkToggle) {
        (window as any).__thinkToggle(thinkId, !next);
      }
      return next;
    });
  }, [thinkId]);

  if (streaming) {
    return (
      <div className={`thinking-section${collapsed ? ' collapsed' : ''}`} data-live-thinking="true">
        <div className="thinking-header" onClick={toggle} style={{cursor:'pointer'}}>
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse flex-shrink-0"></span>
          <span>Thinking…</span>
          <span className="thinking-toggle" style={{transform:'none'}}>▾</span>
        </div>
        <div className="thinking-content">
          <div className="thinking-content-inner">{escapeHtml(content)}<span className="streaming-cursor">▊</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`thinking-section${collapsed ? ' collapsed' : ''}`}>
      <div className="thinking-header" onClick={toggle}>
        <span>View thinking process</span>
        <span className="thinking-toggle">▾</span>
      </div>
      <div className="thinking-content">
        <div className="thinking-content-inner" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
      </div>
    </div>
  );
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

/** Infrastructure messages (thinking, tool cards, sub-agents) — render HTML as-is */
  const isInfra = !!(message.content) && (
    message.content.includes('thinking-section') ||
    message.content.includes('tool-card') ||
    message.content.includes('sub-agent-card') ||
    message.content.includes('data-live-thinking')
  );

  /** True if message is pure infra (no text blocks, only infra HTML).
   *  When all blocks are thinking + no text blocks, treat as infra. */
  const isPureInfra = isInfra && (
    !message.blocks ||
    message.blocks.length === 0 ||
    message.blocks.every(b => b.type === 'thinking')
  );

  // Blocks-based message (new unified format): render from blocks within one message
  const hasBlocks = message.blocks && message.blocks.length > 0;
  // True while streaming with no content yet (placeholder waiting for first delta)
  const isEmptyStreaming = streaming && !isUser && !hasBlocks && !message.content;

  const content = message.content ?? '';
  const defaultCollapsed = useSettingsStore((s) => s.thinkingCollapsed);
  const hideThinking = usePanelStore((s) => {
    if (panelIndex == null) return false;
    return s.panels[panelIndex]?.hideThinking ?? false;
  });

  const formatted = useMemo<string>(() => {
    if (isUser) return formatSimple(content);

    // Pure infra: render raw HTML, no role line
    if (isPureInfra) {
      return content;
    }

    if (streaming) {
      if (!hasBlocks) {
        // Legacy streaming (no blocks): escaped plain text
        return escapeHtml(content).replace(/\n/g, '<br>');
      }
      // Blocks-based streaming: rendered as React elements below (not HTML string)
      return '';
    }

    // After streaming: render full markdown or use blocks HTML
    if (hasBlocks && message.blocks) {
      // Convert blocks to proper HTML with thinking sections (for historical messages)
      if (message.content.includes('thinking-section')) {
        return message.content; // already has HTML from agent_end
      }
      return blocksToHtml(message.blocks, hideThinking, null, defaultCollapsed);
    }

    return renderMarkdown(content);
  }, [content, message.blocks, isUser, streaming, isPureInfra, hasBlocks, hideThinking, defaultCollapsed]);

  // During streaming with blocks, render each block as a React element.
  // Each ThinkingBlock manages its own collapse state — toggle survives re-renders.
  // thinkId prefix uses panelIndex so virtualizer recycles preserve state.
  const streamThinkPrefix = panelIndex != null ? `stream-${panelIndex}` : '';
  const blockElements = useMemo(() => {
    if (!(streaming && hasBlocks && message.blocks)) return null;
    return message.blocks.map((block, i) => {
        if (block.type === 'thinking') {
          const thinkId = streamThinkPrefix ? `${streamThinkPrefix}-${i}` : undefined;
          return (
            <ThinkingBlock
              key={i}
              thinkId={thinkId}
              content={block.content}
              streaming={true}
              defaultCollapsed={defaultCollapsed}
            />
          );
        }
        return (
          <span key={i}>
            {escapeHtml(block.content)}
            <span className="streaming-cursor">▊</span>
          </span>
        );
      });
  }, [streaming, hasBlocks, message.blocks, streamThinkPrefix, defaultCollapsed]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Post-streaming thinking toggle (dangerouslySetInnerHTML path)
    const thinkingHeader = target.closest("[data-pi-toggle='thinking']");
    if (thinkingHeader) {
      const section = thinkingHeader.closest(".thinking-section");
      if (section) {
        const wasCollapsed = section.classList.contains('collapsed');
        section.classList.toggle('collapsed');
        // Save toggle state so blocksToHtml preserves it across rebuilds
        const thinkId = section.getAttribute('data-think-id');
        if (thinkId && (window as any).__thinkToggle) {
          (window as any).__thinkToggle(thinkId, wasCollapsed); // wasCollapsed → nowExpanded=true
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

  // Pure infra messages (tool cards, standalone thinking blocks, sub-agent cards)
  // render inline without role line — visually attach to the main response.
  // When blocks contain text (not just thinking), keep role line.
  if (isPureInfra) {
    return (
      <div className="mb-0 animate-[fadeIn_0.2s_ease]">
        <div onClick={handleClick} className="text-[var(--color-t1)]">
          <span dangerouslySetInnerHTML={{ __html: formatted }} />
        </div>
      </div>
    );
  }

  // Empty streaming placeholder — show subtle waiting indicator, no full role line
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
      {/* Role line — clean: dot + label + time + tokens, no action buttons */}
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
          {blockElements || (formatted != null ? (
            <span dangerouslySetInnerHTML={{ __html: formatted }} />
          ) : null)}
          {streaming && !blockElements && <span className="streaming-cursor" aria-hidden="true">▊</span>}
        </div>
      </div>
    </div>
  );
});

function formatSimple(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
}
