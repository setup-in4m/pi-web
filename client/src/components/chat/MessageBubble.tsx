import { useMemo, useCallback } from "react";
import type { MessageRecord } from "../../lib/api";
import { renderMarkdown } from "../../lib/markdown";

interface Props {
  message: MessageRecord;
  streaming?: boolean;
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

export function MessageBubble({ message, streaming }: Props) {
  const isUser = message.role === "user";
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
  }, []);

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
        </div>

        <div
          onClick={handleClick}
          className={`text-[var(--color-t1)] whitespace-pre-wrap break-words [&_p]:my-0.5 ${streaming ? "after:content-['▊'] after:text-[var(--color-accent)] after:animate-pulse" : ""}`}
          dangerouslySetInnerHTML={{ __html: formatted }}
        />
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
