import { useMemo, useCallback, useState, useEffect } from "react";
import type { MessageRecord } from "../../lib/api";
import { renderMarkdown } from "../../lib/markdown";

interface Props {
  message: MessageRecord;
  streaming?: boolean;
  onRegen?: () => void;
  showRegen?: boolean;
}

const USER_AVATAR = "U";
const ASSISTANT_AVATAR = "π";

/** Estimate tokens from plain text content (chars / 4) */
function estimateTokens(content: string): number {
  const div = document.createElement("div");
  div.innerHTML = content;
  const plain = (div.textContent || div.innerText || content).trim();
  return Math.max(1, Math.round(plain.length / 4));
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
  const formatted = useMemo(() => {
    if (isUser) return formatSimple(message.content);
    return renderMarkdown(message.content);
  }, [message.content, isUser]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains("copy-btn")) {
      const code = target.getAttribute("data-code");
      if (code) {
        const decoded = code.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#039;/g, "'");
        navigator.clipboard.writeText(decoded).then(() => {
          target.textContent = "Copied!";
          setTimeout(() => { target.textContent = "Copy"; }, 1500);
        }).catch(() => {});
      }
    }
    // Close copy menu when clicking anything else
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
    // If message has data-raw equivalent, use raw; otherwise strip HTML tags
    const rawDiv = document.createElement("div");
    rawDiv.innerHTML = message.content;
    let raw = rawDiv.querySelector('[data-raw]')?.getAttribute('data-raw');
    if (!raw) {
      raw = message.content.replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'");
    }
    navigator.clipboard.writeText(raw).catch(() => {});
    setCopyMenuOpen(false);
  }, [message.content]);

  return (
    <div className={`flex gap-2 mb-3 animate-[fadeIn_0.2s_ease] ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${
          isUser ? "bg-[var(--color-accent)] text-white" : "bg-[var(--color-success)] text-white"
        }`}
      >
        {isUser ? USER_AVATAR : ASSISTANT_AVATAR}
      </div>

      <div
        className={`flex-1 min-w-0 px-2.5 py-2 rounded-lg border text-xs leading-relaxed ${
          isUser
            ? "bg-[rgba(124,92,240,0.05)] border-[rgba(124,92,240,0.12)]"
            : `bg-[var(--color-bg3)] border-[var(--color-bdl)] ${streaming ? "border-[var(--color-accent)]" : ""}`
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[9px] font-semibold uppercase tracking-wide ${isUser ? "text-[var(--color-accent)]" : "text-[var(--color-success)]"}`}>
            {isUser ? "You" : "pi"}
          </span>
          <span className="text-[7px] text-[var(--color-t3)]">
            {formatTime(message.timestamp)}
          </span>
          <span
            className="text-[7px] text-[var(--color-t3)]/0 hover:text-[var(--color-t3)] transition-colors cursor-help flex-shrink-0"
            title={`~${estimateTokens(message.content).toLocaleString()} tokens`}
          >
            ~{estimateTokens(message.content).toLocaleString()} tok
          </span>

          {/* Self-contained copy menu (visible on hover) */}
          {!streaming && (
            <div className="relative ml-auto opacity-0 group-hover/message:opacity-100 transition-opacity">
              <button
                className="copy-menu-trigger text-[8px] text-[var(--color-t3)] hover:text-[var(--color-t1)] px-1 py-0 rounded border border-[var(--color-bd)]"
                onClick={(e) => { e.stopPropagation(); setCopyMenuOpen(!copyMenuOpen); }}
                title="Copy"
              >
                Copy ▾
              </button>
              {copyMenuOpen && (
                <div className="copy-menu-dropdown absolute right-0 top-full mt-0.5 bg-[var(--color-bg2)] border border-[var(--color-bdl)] rounded shadow-lg z-30 py-0.5 min-w-[110px]">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCopyText(); }}
                    className="block w-full text-left px-2 py-1 text-[10px] text-[var(--color-t2)] hover:bg-[var(--color-bgh)] transition-colors"
                  >
                    Copy text
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCopyMarkdown(); }}
                    className="block w-full text-left px-2 py-1 text-[10px] text-[var(--color-t2)] hover:bg-[var(--color-bgh)] transition-colors"
                  >
                    Copy markdown
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Regen button (only for last assistant message when not streaming) */}
          {!streaming && !isUser && showRegen && onRegen && (
            <button
              onClick={(e) => { e.stopPropagation(); onRegen(); }}
              className="text-[9px] text-[var(--color-t3)] hover:text-[var(--color-accent)] px-1 py-0 rounded transition-colors"
              title="Regenerate response"
            >
              ↻
            </button>
          )}
        </div>

        <div
          onClick={handleClick}
          data-raw={escapeHtml(message.content)}
          className={`text-[var(--color-t1)] whitespace-pre-wrap break-words [&_p]:my-0.5`}
        >
          <span dangerouslySetInnerHTML={{ __html: formatted }} />
          {streaming && <span className="streaming-cursor" aria-hidden="true">▊</span>}
        </div>
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
