import { useMemo, useCallback, useState, useEffect } from "react";
import type { MessageRecord } from "../../lib/api";
import { renderMarkdown, escapeHtml } from "../../lib/markdown";
import { useModelStore } from "../../stores/modelStore";
import { usePanelStore } from "../../stores/panelStore";

interface Props {
  message: MessageRecord;
  streaming?: boolean;
  onRegen?: () => void;
  showRegen?: boolean;
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

export function MessageBubble({ message, streaming, onRegen, showRegen, panelIndex }: Props) {
  const isUser = message.role === "user";
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);

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

  const formatted = useMemo(() => {
    if (isUser) return formatSimple(message.content);
    if (streaming) {
      // Fast path during streaming: escape HTML only, no markdown parse
      return escapeHtml(message.content).replace(/\n/g, '<br>');
    }
    return renderMarkdown(message.content);
  }, [message.content, isUser, streaming]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
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
    if (!target.closest(".copy-menu-trigger") && !target.closest(".copy-menu-dropdown")) {
      setCopyMenuOpen(false);
    }
  }, []);

  const handleCopyText = useCallback(() => {
    const div = document.createElement("div");
    div.innerHTML = message.content;
    navigator.clipboard.writeText(div.textContent || "").catch(() => {});
    setCopyMenuOpen(false);
  }, [message.content]);

  const handleCopyMarkdown = useCallback(() => {
    const raw = message.content
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");
    navigator.clipboard.writeText(raw).catch(() => {});
    setCopyMenuOpen(false);
  }, [message.content]);

  // ── Model info for assistant messages ────────────────
  const panel = usePanelStore((s) => panelIndex != null ? s.panels[panelIndex] : undefined);
  const models = useModelStore((s) => s.models);
  const defaultProvider = useModelStore((s) => s.defaultProvider);
  const defaultModel = useModelStore((s) => s.defaultModel);
  const currentModel = panel?.model || { provider: defaultProvider, modelId: defaultModel };
  const modelObj = currentModel ? models.find(m => m.providerId === currentModel.provider && m.modelId === currentModel.modelId) : undefined;
  const modelDisplay = modelObj?.displayName || currentModel?.modelId || `${currentModel?.provider}/${currentModel?.modelId}`;
  const [modelInfoOpen, setModelInfoOpen] = useState(false);

  const dotColor = isUser ? 'var(--color-accent)' : modelDotColor(modelDisplay);
  const roleLabel = isUser ? 'You' : (modelDisplay?.split('/').pop() || 'pi');

  const tokens = estimateTokens(message.content);

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
          className="text-[7px] text-[var(--color-t3)]/0 hover:text-[var(--color-t3)] transition-colors cursor-help"
          title={`~${tokens.toLocaleString()} tokens`}
        >
          ~{tokens.toLocaleString()} tok
        </span>

        {!streaming && (
          <div className="flex items-center gap-0.5 ml-auto opacity-0 group-hover/msg:opacity-100 transition-opacity">
            <div className="relative">
              <button
                className="copy-menu-trigger text-[var(--color-t3)] hover:text-[var(--color-t1)] px-0.5 py-0 transition-colors"
                onClick={(e) => { e.stopPropagation(); setCopyMenuOpen(!copyMenuOpen); }}
                title="Copy"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
              {copyMenuOpen && (
                <div className="copy-menu-dropdown absolute right-0 top-full mt-0.5 bg-[var(--color-bg2)] border border-[var(--color-bdl)] rounded shadow-lg z-30 py-0.5 min-w-[110px]">
                  <button onClick={(e) => { e.stopPropagation(); handleCopyText(); }} className="block w-full text-left px-2 py-1 text-[10px] text-[var(--color-t2)] hover:bg-[var(--color-bgh)] transition-colors">Copy text</button>
                  <button onClick={(e) => { e.stopPropagation(); handleCopyMarkdown(); }} className="block w-full text-left px-2 py-1 text-[10px] text-[var(--color-t2)] hover:bg-[var(--color-bgh)] transition-colors">Copy markdown</button>
                </div>
              )}
            </div>
            {!isUser && showRegen && onRegen && (
              <button
                onClick={(e) => { e.stopPropagation(); onRegen(); }}
                className="text-[var(--color-t3)] hover:text-[var(--color-accent)] px-0.5 py-0 transition-colors"
                title="Regenerate response"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Message body */}
      <div className={`text-xs leading-relaxed ${
        isUser ? "bg-[var(--color-bg3)] border border-[var(--color-bdl)] rounded px-3 py-2" : ""
      }`}>
        <div onClick={handleClick} className="text-[var(--color-t1)] whitespace-pre-wrap break-words [&_p]:my-0.5">
          <span dangerouslySetInnerHTML={{ __html: formatted }} />
          {streaming && <span className="streaming-cursor" aria-hidden="true">▊</span>}
        </div>
      </div>
    </div>
  );
}

function formatTime(ts: string): string {
  if (!ts) return "";
  try { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

function formatSimple(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
}
