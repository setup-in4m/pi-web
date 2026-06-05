import { useMemo, useCallback, useState, useEffect } from "react";
import type { MessageRecord } from "../../lib/api";
import { renderMarkdown, extractThinkingBlocks, renderThinkingSection } from "../../lib/markdown";

interface Props {
  message: MessageRecord;
  streaming?: boolean;
  onRegen?: () => void;
  showRegen?: boolean;
}

/** Estimate tokens from plain text content (chars / 4) */
function estimateTokens(content: string): number {
  const div = document.createElement("div");
  div.innerHTML = content;
  const plain = (div.textContent || div.innerText || content).trim();
  return Math.max(1, Math.round(plain.length / 4));
}

/** Generate a consistent HSL color from a string hash */
function stringColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 55%, 65%)`;
}

export function MessageBubble({ message, streaming, onRegen, showRegen }: Props) {
  const isUser = message.role === "user";
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);

  // Inject streaming cursor CSS once
  useEffect(() => {
    if (!streaming) return;
    const id = 'streaming-cursor-css';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes blink-cursor {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }
      .streaming-cursor {
        animation: blink-cursor 1s step-end infinite;
        color: var(--color-accent);
        font-weight: 700;
      }
    `;
    document.head.appendChild(style);
  }, [streaming]);

  const { formatted } = useMemo(() => {
    if (isUser) return { formatted: formatSimple(message.content) };

    // Extract thinking blocks for assistant messages
    const { thinkingBlocks, content, thinkingTime } = extractThinkingBlocks(message.content);

    let html = '';
    // Render thinking sections
    thinkingBlocks.forEach((block, i) => {
      html += renderThinkingSection(block, i, thinkingTime ?? undefined);
    });
    // Render actual content
    if (content) {
      html += renderMarkdown(content);
    }

    // If no thinking extracted but we have content, just render markdown
    if (thinkingBlocks.length === 0 && content) {
      html = renderMarkdown(message.content);
    }

    return { formatted: html || renderMarkdown(message.content) };
  }, [message.content, isUser]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Copy code button
    if (target.classList.contains("copy-code-btn") || target.closest(".copy-code-btn")) {
      const btn = target.classList.contains("copy-code-btn") ? target : target.closest(".copy-code-btn")!;
      const code = btn.getAttribute("data-code");
      if (code) {
        const decoded = code.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#039;/g, "'");
        navigator.clipboard.writeText(decoded).then(() => {
          btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
          setTimeout(() => {
            btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
          }, 1500);
        }).catch(() => {});
      }
    }
    // Run code button
    if (target.classList.contains("run-code-btn") || target.closest(".run-code-btn")) {
      const btn = target.classList.contains("run-code-btn") ? target : target.closest(".run-code-btn")!;
      const code = btn.getAttribute("data-code");
      const lang = btn.getAttribute("data-lang");
      if (code) {
        if (lang === 'js' || lang === 'javascript') {
          try {
            const result = new Function(`"use strict"; return (${code})`)();
            alert(`Result: ${JSON.stringify(result)}`);
          } catch (e: any) {
            alert(`Error: ${e.message}`);
          }
        } else {
          // For Python/Bash, copy to clipboard and hint
          navigator.clipboard.writeText(code).then(() => {
            alert(`Code copied to clipboard. Run it in your terminal.`);
          }).catch(() => {});
        }
      }
    }
    // Close copy menu when clicking anywhere else
    if (!target.closest('.copy-menu-trigger') && !target.closest('.copy-menu-dropdown')) {
      setCopyMenuOpen(false);
    }
  }, []);

  const handleCopyText = useCallback(() => {
    const div = document.createElement("div");
    div.innerHTML = message.content;
    const text = div.textContent || div.innerText || message.content;
    navigator.clipboard.writeText(text).catch(() => {});
    setCopyMenuOpen(false);
  }, [message.content]);

  const handleCopyMarkdown = useCallback(() => {
    let raw = message.content.replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");
    navigator.clipboard.writeText(raw).catch(() => {});
    setCopyMenuOpen(false);
  }, [message.content]);

  const roleColor = stringColor(isUser ? "user" : "pi");
  const tokEst = estimateTokens(message.content);

  return (
    <div className={`msg ${isUser ? "msg-user" : "msg-assistant"}`}>
      {/* Role label row */}
      <div className="flex items-center gap-2 mb-0.5">
        <span
          className="role-dot"
          style={{ backgroundColor: roleColor }}
        />
        <span
          className="text-[10px] font-semibold uppercase tracking-wide opacity-85"
          style={{ color: roleColor }}
        >
          {isUser ? "You" : "pi"}
        </span>
        <span className="text-[8px] opacity-35">
          {formatTime(message.timestamp)}
        </span>
        <span
          className="text-[8px] opacity-0 hover:opacity-40 transition-opacity cursor-help ml-auto"
          title={`~${tokEst.toLocaleString()} tokens`}
        >
          {tokEst < 1000 ? `${tokEst} tok` : `${(tokEst / 1000).toFixed(1)}K tok`}
        </span>

        {/* Action buttons (visible on hover) */}
        {!streaming && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity">
            {/* Copy dropdown */}
            <div className="relative">
              <button
                className="copy-menu-trigger text-[9px] opacity-50 hover:opacity-100 px-1 rounded transition-opacity"
                onClick={(e) => { e.stopPropagation(); setCopyMenuOpen(!copyMenuOpen); }}
                title="Copy"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
              {copyMenuOpen && (
                <div className="copy-menu-dropdown absolute right-0 top-full mt-0.5 bg-[var(--color-bg2)] border border-[var(--color-bdl)] rounded shadow-lg z-30 py-0.5 min-w-[110px]">
                  <button onClick={(e) => { e.stopPropagation(); handleCopyText(); }} className="block w-full text-left px-2 py-1 text-[10px] text-[var(--color-t2)] hover:bg-[var(--color-bgh)] transition-colors">Copy text</button>
                  <button onClick={(e) => { e.stopPropagation(); handleCopyMarkdown(); }} className="block w-full text-left px-2 py-1 text-[10px] text-[var(--color-t2)] hover:bg-[var(--color-bgh)] transition-colors">Copy markdown</button>
                </div>
              )}
            </div>
            {/* Regen */}
            {!isUser && showRegen && onRegen && (
              <button onClick={(e) => { e.stopPropagation(); onRegen(); }} className="text-[9px] opacity-50 hover:opacity-100 px-1 rounded transition-opacity" title="Regenerate">↻</button>
            )}
          </div>
        )}
      </div>

      {/* Message body */}
      <div
        onClick={handleClick}
        className="text-[var(--color-t1)] text-[0.88em] leading-relaxed whitespace-pre-wrap break-words [&_p]:my-0.5"
      >
        <span dangerouslySetInnerHTML={{ __html: formatted }} />
        {streaming && <span className="streaming-cursor" aria-hidden="true">▊</span>}
      </div>
    </div>
  );
}

function formatTime(ts: string): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatSimple(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br>");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
