import { useMemo, useCallback, useState, useEffect, useRef } from "react";
import type { MessageRecord } from "../../lib/api";
import { renderMarkdown } from "../../lib/markdown";
import { useModelStore } from "../../stores/modelStore";

interface Props {
  message: MessageRecord;
  streaming?: boolean;
  onRegen?: () => void;
  showRegen?: boolean;
  modelDotName?: string; // model name for color dot generation
}

// ── Model color dot ─────────────────────────────────────

function modelDotHsl(name?: string): string {
  if (!name) return "hsl(280, 55%, 60%)";
  let hash = 0;
  const key = name.toLowerCase();
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return `hsl(${((hash % 360) + 360) % 360}, 55%, 60%)`;
}

// ── Token estimation ─────────────────────────────────────

function estimateTokens(content: string): number {
  const div = document.createElement("div");
  div.innerHTML = content;
  const plain = (div.textContent || div.innerText || content).trim();
  return Math.max(1, Math.round(plain.length / 4));
}

// ── Image URL detection ──────────────────────────────────

function extractImageUrls(content: string): string[] {
  const urls: string[] = [];
  // Markdown images: ![alt](url)
  const mdImg = /!\[.*?\]\(([^)]+)\)/g;
  let m;
  while ((m = mdImg.exec(content)) !== null) {
    urls.push(m[1]);
  }
  // Bare URLs ending in image extensions
  const bareImg = /https?:\/\/\S+\.(?:png|jpe?g|gif|webp)\b/gi;
  while ((m = bareImg.exec(content)) !== null) {
    if (!urls.includes(m[0])) urls.push(m[0]);
  }
  // data: URIs for images
  const dataUri = /data:image\/\S+/gi;
  while ((m = dataUri.exec(content)) !== null) {
    if (!urls.includes(m[0])) urls.push(m[0]);
  }
  return urls.slice(0, 6); // max 6 previews
}

// ── Component ────────────────────────────────────────────

export function MessageBubble({ message, streaming, onRegen, showRegen, modelDotName }: Props) {
  const isUser = message.role === "user";
  const [modelInfoOpen, setModelInfoOpen] = useState(false);
  const modelInfoRef = useRef<HTMLDivElement>(null);
  const modelInfoTriggerRef = useRef<HTMLSpanElement>(null);
  const models = useModelStore((s) => s.models);

  // Inject streaming cursor CSS once
  useEffect(() => {
    if (!streaming) return;
    const id = "streaming-cursor-css";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
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

  // Close model info popup on outside click
  useEffect(() => {
    if (!modelInfoOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        modelInfoRef.current &&
        !modelInfoRef.current.contains(e.target as Node) &&
        modelInfoTriggerRef.current &&
        !modelInfoTriggerRef.current.contains(e.target as Node)
      ) {
        setModelInfoOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [modelInfoOpen]);

  // Find model info for the current panel
  const modelInfo = useMemo(() => {
    if (!modelDotName) return null;
    const found = models.find(
      (m) =>
        m.modelId.toLowerCase() === modelDotName.toLowerCase() ||
        m.displayName.toLowerCase() === modelDotName.toLowerCase()
    );
    return found || null;
  }, [modelDotName, models]);

  const dotColor = modelDotHsl(modelDotName);
  const imageUrls = useMemo(() => extractImageUrls(message.content), [message.content]);

  // ── Markdown rendering ──────────────────────────────────

  const formatted = useMemo(() => {
    if (isUser) return formatSimple(message.content);
    return renderMarkdown(message.content);
  }, [message.content, isUser]);

  // ── Click handlers ──────────────────────────────────────

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains("copy-btn")) {
      const code = target.getAttribute("data-code");
      if (code) {
        const decoded = code
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&#039;/g, "'");
        navigator.clipboard.writeText(decoded).then(() => {
          target.textContent = "Copied!";
          setTimeout(() => {
            target.textContent = "Copy";
          }, 1500);
        }).catch(() => {});
      }
    }
  }, []);

  const handleCopyIcon = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const div = document.createElement("div");
      div.innerHTML = message.content;
      const text = div.textContent || div.innerText || message.content;
      navigator.clipboard.writeText(text).catch(() => {});
      // Brief flash feedback
      const btn = e.currentTarget as HTMLElement;
      btn.style.color = "var(--color-success)";
      setTimeout(() => {
        btn.style.color = "";
      }, 600);
    },
    [message.content]
  );

  const handleCopyMarkdown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const rawDiv = document.createElement("div");
      rawDiv.innerHTML = message.content;
      let raw = rawDiv.querySelector("[data-raw]")?.getAttribute("data-raw");
      if (!raw) {
        raw = message.content
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'");
      }
      navigator.clipboard.writeText(raw).catch(() => {});
    },
    [message.content]
  );

  return (
    <div
      className={`flex gap-2 mb-3 animate-[fadeIn_0.15s_ease] ${isUser ? "flex-row-reverse" : ""}`}
    >
      {/* ── Message body — no avatar ─────────────────────── */}
      <div
        className={`flex-1 min-w-0 px-2.5 py-2 rounded-lg border text-xs leading-relaxed relative ${
          isUser
            ? "bg-[color-mix(in_srgb,var(--color-accent)_6%,var(--color-bg)_94%)] border-[color-mix(in_srgb,var(--color-accent)_12%,var(--color-bd)_88%)]"
            : `bg-[var(--color-bg3)] border-[var(--color-bdl)] ${streaming ? "border-[var(--color-accent)]" : ""}`
        }`}
      >
        {/* ── Header: dot + role + time + token count ─────── */}
        <div className="flex items-center gap-2 mb-1">
          <span
            className="inline-block w-[8px] h-[8px] rounded-full flex-shrink-0"
            style={{ backgroundColor: isUser ? "var(--color-accent)" : dotColor }}
          />
          <span
            ref={modelInfoTriggerRef}
            className={`text-[10px] font-medium cursor-pointer select-none hover:underline ${
              isUser ? "text-[var(--color-accent)]" : ""
            }`}
            style={isUser ? {} : { color: dotColor }}
            onClick={() => !isUser && setModelInfoOpen(!modelInfoOpen)}
            title={isUser ? undefined : "Click for model info"}
          >
            {isUser ? "You" : "pi"}
          </span>
          <span className="text-[8px] text-[var(--color-t3)]">
            {formatTime(message.timestamp)}
          </span>
          <span
            className="text-[8px] text-[var(--color-t3)]/0 hover:text-[var(--color-t3)] transition-colors cursor-help flex-shrink-0 ml-auto"
            title={`~${estimateTokens(message.content).toLocaleString()} tokens`}
          >
            ~{estimateTokens(message.content).toLocaleString()} tok
          </span>

          {/* ── Model info popup ─────────────────────────── */}
          {modelInfoOpen && modelInfo && (
            <div
              ref={modelInfoRef}
              className="absolute left-0 top-full mt-1 bg-[var(--color-bg2)] border border-[var(--color-bdl)] rounded-lg shadow-2xl z-30 p-3 min-w-[180px] text-[10px]"
              style={{ left: "20px" }}
            >
              <div className="font-semibold text-[var(--color-t1)] mb-1">
                {modelInfo.displayName}
              </div>
              <div className="text-[var(--color-t3)] mb-1">
                <span className="opacity-60">Provider:</span>{" "}
                {modelInfo.providerId}
              </div>
              {modelInfo.contextWindow && (
                <div className="text-[var(--color-t3)] mb-1">
                  <span className="opacity-60">Context:</span>{" "}
                  {modelInfo.contextWindow >= 1000
                    ? `${Math.round(modelInfo.contextWindow / 1000)}K`
                    : modelInfo.contextWindow}{" "}
                  tokens
                </div>
              )}
              {modelInfo.cost && (
                <div className="text-[var(--color-t3)]">
                  <span className="opacity-60">Pricing:</span> $
                  {modelInfo.cost.input.toFixed(0)}/$ 
                  {modelInfo.cost.output.toFixed(0)} per 1M
                </div>
              )}
              {modelInfo.supportsThinking && (
                <div className="text-[var(--color-success)] mt-1 text-[9px]">
                  🧠 Thinking supported
                </div>
              )}
            </div>
          )}

          {/* ── Icon-only copy button ────────────────────── */}
          {!streaming && (
            <button
              onClick={handleCopyIcon}
              onContextMenu={(e) => {
                e.preventDefault();
                handleCopyMarkdown(e);
              }}
              className="text-[var(--color-t3)] hover:text-[var(--color-t2)] transition-colors p-0.5 rounded opacity-0 group-hover/message:opacity-100"
              title="Copy text · Right-click for markdown"
              aria-label="Copy message text"
            >
              {/* SVG copy icon */}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          )}

          {/* ── Regen button ─────────────────────────────── */}
          {!streaming && !isUser && showRegen && onRegen && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRegen();
              }}
              className="text-[9px] text-[var(--color-t3)] hover:text-[var(--color-accent)] px-1 py-0 rounded transition-colors opacity-0 group-hover/message:opacity-100"
              title="Regenerate response"
            >
              ↻
            </button>
          )}
        </div>

        {/* ── Content body ────────────────────────────────── */}
        <div
          onClick={handleClick}
          data-raw={escapeHtml(message.content)}
          className="text-[var(--color-t1)] whitespace-pre-wrap break-words [&_p]:my-0.5"
        >
          <span dangerouslySetInnerHTML={{ __html: formatted }} />
          {streaming && (
            <span className="streaming-cursor" aria-hidden="true">
              ▊
            </span>
          )}
        </div>

        {/* ── Attachment image previews ───────────────────── */}
        {imageUrls.length > 0 && !streaming && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {imageUrls.map((url, idx) => (
              <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                <img
                  src={url}
                  alt={`Attachment ${idx + 1}`}
                  loading="lazy"
                  className="max-w-[150px] max-h-[120px] rounded border border-[var(--color-bd)] hover:opacity-90 transition-opacity object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────

function formatTime(ts: string): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
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
