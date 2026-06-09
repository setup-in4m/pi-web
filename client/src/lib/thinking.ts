import { escapeHtml } from "./sanitize";
import { renderMarkdown } from "./markdown";

// ── Thinking block detection (Odysseus-style) ─────────

const THINKING_TAGS = [
  /<think(?:ing)?(?:\s+[^>]*)?>([\s\S]*?)<\/think(?:ing)?>/gi,
  /<thought(?:\s+[^>]*)?>([\s\S]*?)<\/thought>/gi,
  /<\|channel>thought\s*\n?([\s\S]*?)<channel\|>/gi,
];

const REASONING_PREFIXES = [
  /^thinking(?:\s+process)?\s*:/i,
  /^i need /i, /^i should /i, /^i will /i, /^i can /i, /^i want /i,
  /^let me /i, /^first[,\s]/i, /^the user /i, /^the question /i,
];

/** Check if text has an unclosed think tag */
export function hasUnclosedThinkTag(text: string): boolean {
  const openCount = (text.match(/<(?:think(?:ing)?|thought)(?:\s+[^>]*)?>/gi) || []).length +
    (text.match(/<\|channel>thought/gi) || []).length;
  const closeCount = (text.match(/<\/(?:think(?:ing)?|thought)>/gi) || []).length +
    (text.match(/<channel\|>/gi) || []).length;
  return openCount > closeCount;
}

/** Auto-detect reasoning in plain text (no tags) based on common prefixes */
function detectPlainThink(text: string): string | null {
  const trimmed = text.trim();
  for (const rx of REASONING_PREFIXES) {
    if (rx.test(trimmed)) {
      // Find a natural boundary — first paragraph break or transition to reply
      const doubleBreak = trimmed.indexOf('\n\n');
      if (doubleBreak > 30) {
        return trimmed.slice(0, doubleBreak).trim();
      }
      // Look for common reply starters
      const replyRx = /\n\n(Hey|Hi[ !]|Hello|Sure|Yes|No[ ,]|Here|Absolutely|Of course|Great|Alright|Thanks|Welcome|Good |I'm|I'd|What|Let|This |As )/i;
      const replyMatch = replyRx.exec(trimmed);
      if (replyMatch && replyMatch.index > 60) {
        return trimmed.slice(0, replyMatch.index).trim();
      }
      // Long single paragraph → first 500 chars are likely thinking
      if (trimmed.length > 500 && !trimmed.includes('\n\n')) {
        const lines = trimmed.split('\n');
        if (lines.length > 3) {
          return lines.slice(0, Math.ceil(lines.length / 2)).join('\n').trim();
        }
      }
      break;
    }
  }
  return null;
}

/** Collapse 3+ consecutive newlines into max 1 blank line (2 newlines), trim leading/trailing whitespace. */
function normalizeWhitespace(s: string): string {
  return s.replace(/^\s+/, '').replace(/\s+$/, '').replace(/\n{3,}/g, '\n\n');
}

/** Extract thinking blocks from text, returning { thinkingBlocks, content, thinkingTime } */
export function extractThinkingBlocks(text: string): {
  thinkingBlocks: string[];
  content: string;
  thinkingTime: number | null;
} {
  let normalized = text;
  const thinkingTime = null; // Server may provide in future
  const thinkingBlocks: string[] = [];

  // Try each think tag format
  for (const rx of THINKING_TAGS) {
    let match;
    while ((match = rx.exec(normalized)) !== null) {
      const content = match[1].trim();
      if (content) thinkingBlocks.push(normalizeWhitespace(content));
    }
    normalized = normalized.replace(rx, '');
  }

  // Handle unclosed think tag — strip from opener to end
  if (hasUnclosedThinkTag(normalized)) {
    const strayOpener = normalized.match(/^\s*<(?:think(?:ing)?|thought)(?:\s+[^>]*)?>([\s\S]*)$/i);
    if (strayOpener) {
      normalized = strayOpener[1];
    } else {
      normalized = normalized.replace(/<(?:think(?:ing)?|thought)(?:\s+[^>]*)?>[\s\S]*$/gi, '');
    }
  }

  // Handle orphaned closing tag — text before it is thinking
  const orphanMatch = normalized.match(/^([\s\S]+?)<\/(?:think(?:ing)?|thought)>/i);
  if (orphanMatch && orphanMatch[1].trim()) {
    thinkingBlocks.push(normalizeWhitespace(orphanMatch[1]));
    normalized = normalized.slice(orphanMatch[0].length);
  }

  // Strip remaining orphaned closing tags
  normalized = normalized.replace(/<\/(?:think(?:ing)?|thought)>/gi, '');

  // Auto-detect plain-text reasoning if no tag-based thinking found
  if (thinkingBlocks.length === 0) {
    const plain = detectPlainThink(normalized);
    if (plain) {
      thinkingBlocks.push(normalizeWhitespace(plain));
      normalized = normalized.slice(plain.length).trim();
      // Remove leading double break if present
      normalized = normalized.replace(/^\n+/, '');
    }
  }

  return {
    thinkingBlocks: thinkingBlocks.length > 1 ? [thinkingBlocks.join('\n\n')] : thinkingBlocks,
    content: normalized.trim(),
    thinkingTime,
  };
}

/** Build Odysseus-style collapsible thinking section HTML */
export function renderThinkingSection(thinkContent: string, index: number = 0, thinkTime?: number): string {
  const id = `think-${Date.now()}-${index}`;
  const timeHtml = thinkTime != null
    ? `<span class="thinking-time">${thinkTime}s</span>`
    : '';
  const cleaned = thinkContent.replace(/^\s+/, '').replace(/\s+$/, '').replace(/\n{3,}/g, '\n\n');
  return `<div class="thinking-section" id="${id}"><div class="thinking-header" onclick="this.parentElement.classList.toggle('collapsed')"><span>View thinking process</span><div style="display:flex;align-items:center;gap:6px">${timeHtml}<span class="thinking-toggle">▾</span></div></div><div class="thinking-content"><div class="thinking-content-inner">${renderMarkdown(cleaned).trimEnd()}</div></div></div>`;
}

// ── Thinking section HTML builder ───────────────────────

/** Build an Odysseus-style collapsible thinking section (rendered markdown content) */
export function createThinkingSection(thinkingContent: string, thinkingTime?: string | null, defaultCollapsed?: boolean): string {
  const cleaned = thinkingContent.replace(/^\s+/, '').replace(/\s+$/, '').replace(/\n{3,}/g, '\n\n');
  const rendered = renderMarkdown(cleaned).trimEnd();
  const timeHtml = thinkingTime
    ? `<span class="thinking-time">${escapeHtml(thinkingTime)}s</span>`
    : "";
  const collapsedClass = defaultCollapsed ? " collapsed" : "";
  return `<div class="thinking-section${collapsedClass}"><div class="thinking-header" onclick="this.parentElement.classList.toggle('collapsed')"><span>View thinking process</span>${timeHtml}<span class="thinking-toggle">▾</span></div><div class="thinking-content"><div class="thinking-content-inner">${rendered}</div></div></div>`;
}

/** Build thinking section with pre-escaped raw text (no markdown) */
export function createThinkingSectionRaw(thinkingContent: string, thinkingTime?: string | null, defaultCollapsed?: boolean): string {
  const cleaned = thinkingContent.replace(/^\s+/, '').replace(/\s+$/, '').replace(/\n{3,}/g, '\n\n');
  const timeHtml = thinkingTime
    ? `<span class="thinking-time">${escapeHtml(thinkingTime)}s</span>`
    : "";
  const collapsedClass = defaultCollapsed ? " collapsed" : "";
  return `<div class="thinking-section${collapsedClass}"><div class="thinking-header" onclick="this.parentElement.classList.toggle('collapsed')"><span>View thinking process</span>${timeHtml}<span class="thinking-toggle">▾</span></div><div class="thinking-content"><div class="thinking-content-inner">${escapeHtml(cleaned)}</div></div></div>`;
}
