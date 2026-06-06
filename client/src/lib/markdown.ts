import { marked } from "marked";
import katex from "katex";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import sql from "highlight.js/lib/languages/sql";
import rust from "highlight.js/lib/languages/rust";
import go from "highlight.js/lib/languages/go";
import yaml from "highlight.js/lib/languages/yaml";
import markdown from "highlight.js/lib/languages/markdown";
import diff from "highlight.js/lib/languages/diff";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("rs", rust);
hljs.registerLanguage("go", go);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);
hljs.registerLanguage("diff", diff);

// Languages that can be run (executed via server)
const RUNNABLE_LANGS = new Set(["python", "py", "javascript", "js", "typescript", "ts", "bash", "sh", "shell", "zsh"]);

function isRunnable(lang?: string): boolean {
  if (!lang) return false;
  return RUNNABLE_LANGS.has(lang.toLowerCase());
}

// Override marked's renderer for custom code blocks, tables, etc.
marked.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }): string {
      let highlighted = "";
      let detectedLang = lang || "";

      if (lang && hljs.getLanguage(lang)) {
        try {
          highlighted = hljs.highlight(text, { language: lang }).value;
        } catch {
          highlighted = escapeHtml(text);
        }
      } else {
        try {
          const result = hljs.highlightAuto(text);
          highlighted = result.value;
          detectedLang = result.language || "";
        } catch {
          highlighted = escapeHtml(text);
        }
      }

      const escapedCode = escapeHtml(text).replace(/"/g, "&quot;");

      const runBtn = isRunnable(detectedLang || lang)
        ? `<button class="run-code-btn" data-code="${escapedCode}" data-lang="${escapeHtml(detectedLang || lang || '')}" title="Run" aria-label="Run code">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>`
        : "";

      return `<div class="code-block group">
        <pre${detectedLang || lang ? ` data-lang="${escapeHtml(detectedLang || lang || '')}"` : ''}><code class="${detectedLang || lang ? 'language-' + escapeHtml(detectedLang || lang || '') : ''}">${highlighted}</code></pre>
        <div class="code-block-toolbar">
          ${runBtn}
          <button class="copy-code-btn" data-code="${escapedCode}" title="Copy" aria-label="Copy code">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
        </div>
      </div>`;
    },

    codespan({ text }: { text: string }): string {
      return `<code class="bg-[var(--color-bg3)] px-1 py-0.5 rounded text-[11px] font-mono text-[var(--color-warning)]">${escapeHtml(text)}</code>`;
    },

    heading({ text, depth }: { text: string; depth: number }): string {
      const sizes: Record<number, string> = {
        1: "text-sm",
        2: "text-[13px]",
        3: "text-xs",
        4: "text-[11px]",
        5: "text-[11px]",
        6: "text-[11px]",
      };
      return `<h${depth} class="${sizes[depth] || "text-xs"} font-semibold mt-2 mb-1 text-[var(--color-t1)]">${text}</h${depth}>`;
    },

    image({ href, title, text }: { href: string; title?: string | null; text: string }): string {
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      const alt = escapeHtml(text || "");
      const src = escapeHtml(href);
      return `<a href="${src}" target="_blank" rel="noopener noreferrer" class="inline-block my-1">
        <img src="${src}" alt="${alt}"${titleAttr} loading="lazy"
          class="max-w-full rounded border border-[var(--color-bd)] cursor-pointer hover:opacity-90 transition-opacity"
          style="max-height:400px"
          onerror="this.style.display='none';this.parentElement.querySelector('.img-err').style.display='block'" />
        <span class="img-err hidden text-[10px] text-[var(--color-t3)]">🖼 ${alt || src}</span>
      </a>`;
    },

    link({ href, title, text }: { href: string; title?: string | null; text: string }): string {
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      return `<a href="${escapeHtml(href)}"${titleAttr} target="_blank" rel="noopener noreferrer" class="text-[var(--color-accent)] hover:underline">${text}</a>`;
    },

    blockquote({ text }: { text: string }): string {
      return `<blockquote class="border-l-2 border-[var(--color-accent)] pl-2 py-0.5 my-1 text-[var(--color-t2)] bg-[rgba(124,92,240,0.04)] rounded-r">${text}</blockquote>`;
    },

    listitem({ text, task, checked }: { text: string; task?: boolean; checked?: boolean }): string {
      if (task) {
        const checkClass = checked ? "text-[var(--color-success)]" : "text-[var(--color-t3)]";
        const checkIcon = checked ? "☑" : "☐";
        return `<li class="ml-4 my-0.5 flex items-start gap-1.5">
          <span class="${checkClass} flex-shrink-0 mt-px">${checkIcon}</span>
          <span>${text}</span>
        </li>`;
      }
      return `<li class="ml-4 list-disc my-0.5">${text}</li>`;
    },

    table({ header, rows }: { header: string; rows: string }): string {
      return `<div class="overflow-x-auto my-1.5"><table class="min-w-full border-collapse text-[11px]">
        <thead>${header}</thead>
        <tbody>${rows}</tbody>
      </table></div>`;
    },

    tablerow({ text }: { text: string }): string {
      return `<tr class="border-b border-[var(--color-bd)]">${text}</tr>`;
    },

    tablecell({ text, align, header }: { text: string; align: "center" | "left" | "right" | null; header?: boolean }): string {
      const tag = header ? "th" : "td";
      const alignAttr = align ? ` style="text-align:${align}"` : "";
      const cls = header
        ? "px-2 py-1 font-semibold text-[var(--color-t2)] bg-[var(--color-bg2)]"
        : "px-2 py-1";
      return `<${tag}${alignAttr} class="${cls}">${text}</${tag}>`;
    },
  } as any,
});

marked.setOptions({ breaks: true, gfm: true });

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
      if (content) thinkingBlocks.push(content);
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
    thinkingBlocks.push(orphanMatch[1].trim());
    normalized = normalized.slice(orphanMatch[0].length);
  }

  // Strip remaining orphaned closing tags
  normalized = normalized.replace(/<\/(?:think(?:ing)?|thought)>/gi, '');

  // Auto-detect plain-text reasoning if no tag-based thinking found
  if (thinkingBlocks.length === 0) {
    const plain = detectPlainThink(normalized);
    if (plain) {
      thinkingBlocks.push(plain);
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
  return `<div class="thinking-section" id="${id}">
    <div class="thinking-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <span>View thinking process</span>
      <div style="display:flex;align-items:center;gap:6px">
        ${timeHtml}
        <span class="thinking-toggle">▾</span>
      </div>
    </div>
    <div class="thinking-content">
      <div class="thinking-content-inner">${renderMarkdown(thinkContent)}</div>
    </div>
  </div>`;
}

// ── Bare URL autolinking ────────────────────────────

const BARE_URL_RE = /(^|[\s(<])(https?:\/\/[^\s<>"'`\]]+[^\s<>"'`\].,;:!?])/g;
const SCHEMELESS_DOMAIN_RE = /(^|[\s(<])((?:www\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.(?:com|org|net|io|ai|co|dev|app|gov|edu|news|info|tech|xyz|me)(?=$|[\/\s<>"'`\]).,;:!?])(?:\/[^\s<>"'`\])]*)?)/gi;
/** Auto-link bare URLs and scheme-less domains in text */
export function autolinkBareUrls(text: string): string {
  let result = text;
  // Bare http/https URLs
  result = result.replace(BARE_URL_RE, (_, prefix, url) =>
    `${prefix}<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="bare-url">${url}</a>`
  );
  // Scheme-less domains (only if not inside an existing <a> tag)
  // This is a best-effort approach — proper HTML parsing would need a DOM
  result = result.replace(SCHEMELESS_DOMAIN_RE, (match, prefix, domain) => {
    // Skip if already inside an <a> or <img> tag context
    const before = result.slice(0, result.indexOf(match));
    if (before.lastIndexOf('<a ') > before.lastIndexOf('</a>')) return match;
    const trail = (domain.match(/[.,;:!?)]+$/) || [''])[0];
    const core = trail ? domain.slice(0, -trail.length) : domain;
    return `${prefix}<a href="https://${core}" target="_blank" rel="noopener noreferrer" class="bare-url">${core}</a>${trail}`;
  });
  // Entity anchors: [#session-abc123] → clickable anchor link
  result = result.replace(/\[#(session|document|note|image|email|event|task|skill|research)-([A-Za-z0-9_-]+)\]/g,
    (_, kind, id) => `<a href="#${kind}-${id}" class="chat-link">#${kind}-${id}</a>`
  );
  return result;
}

// ── LRU Cache for memoized markdown rendering ────────────

const CACHE_MAX = 200;
const cache = new Map<string, { result: string; ts: number }>();

let cacheHits = 0;
let cacheMisses = 0;

export function getCacheStats(): { hits: number; misses: number; size: number } {
  return { hits: cacheHits, misses: cacheMisses, size: cache.size };
}

// ── Tool syntax stripping (leaked tool calls in visible output) ────

const TOOL_CALL_RE = /\[TOOL_CALL\][\s\S]*?\[\/TOOL_CALL\]/gi;
const EXEC_FENCE_RE = /```(?:web_search|read_file|write_file|create_document|edit_document|update_document)\s*\n[\s\S]*?```/gi;
const XML_TOOL_CALL_RE = /<(?:[\w]+:)?(?:tool_call|function_call)>[\s\S]*?<\/(?:[\w]+:)?(?:tool_call|function_call)>/gi;
const XML_INVOKE_RE = /<invoke\s+name=['"][^'"]*['"]>[\s\S]*?<\/invoke>/gi;
const DSML_TOOL_RE = /<\s*[｜|]+\s*DSML\s*[｜|]+\s*tool_calls\s*>[\s\S]*?(?:<\s*\/\s*[｜|]+\s*DSML\s*[｜|]+\s*tool_calls\s*>|$)/gi;
const DSML_STRAY_RE = /<\s*\/?\s*[｜|]+\s*DSML\s*[｜|]+[^>]*>/gi;
const TOOL_NARRATION_RE = /(?:The (?:result|output) shows?:?\s*)?-?\s*(?:stdout|stderr|exit_code):\s*.+/gi;

/** Strip tool-call syntax that some models leak into visible text */
export function toolSyntaxStrip(text: string): string {
  let cleaned = text.replace(TOOL_CALL_RE, '');
  cleaned = cleaned.replace(EXEC_FENCE_RE, '');
  cleaned = cleaned.replace(DSML_TOOL_RE, '');
  cleaned = cleaned.replace(DSML_STRAY_RE, '');
  cleaned = cleaned.replace(XML_TOOL_CALL_RE, '');
  cleaned = cleaned.replace(XML_INVOKE_RE, '');
  cleaned = cleaned.replace(TOOL_NARRATION_RE, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
}

// ── Progressive streaming: squash markdown inside unclosed code fences ──

/**
 * During streaming, if there are unclosed code fences, the text after
 * the last open fence should NOT be rendered as markdown (avoids headings,
 * lists, etc. appearing mid-stream inside code blocks).
 * Split by ```, render even segments as markdown, odd as escaped pre text.
 */
export function squashOutsideCode(text: string): string {
  if (!text.includes('```')) return text;
  const parts = text.split('```');
  // If parts.length is even, all fences are closed — safe to render as markdown
  if (parts.length % 2 === 0) return text;

  // Odd count → last segment is inside an unclosed code fence.
  // Render all even-indexed segments (0,2,4…) as markdown,
  // all odd-indexed segments (1,3,5…) as escaped pre text.
  let result = '';
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      result += parts[i];
    } else {
      result += '\n```' + escapeHtml(parts[i]) + '```';
    }
  }
  return result;
}

// ── Thinking section HTML builder ───────────────────────

/** Build an Odysseus-style collapsible thinking section (rendered markdown content) */
export function createThinkingSection(thinkingContent: string, thinkingTime?: string | null): string {
  const rendered = renderMarkdown(thinkingContent);
  const timeHtml = thinkingTime
    ? `<span class="thinking-time">${escapeHtml(thinkingTime)}s</span>`
    : "";
  return `<div class="thinking-section">
  <div class="thinking-header" onclick="this.parentElement.classList.toggle('collapsed')">
    <span>View thinking process</span>
    ${timeHtml}
    <span class="thinking-toggle">▾</span>
  </div>
  <div class="thinking-content">
    <div class="thinking-content-inner">${rendered}</div>
  </div>
</div>`;
}

/** Build thinking section with pre-escaped raw text (no markdown) */
export function createThinkingSectionRaw(thinkingContent: string, thinkingTime?: string | null): string {
  const timeHtml = thinkingTime
    ? `<span class="thinking-time">${escapeHtml(thinkingTime)}s</span>`
    : "";
  return `<div class="thinking-section">
  <div class="thinking-header" onclick="this.parentElement.classList.toggle('collapsed')">
    <span>View thinking process</span>
    ${timeHtml}
    <span class="thinking-toggle">▾</span>
  </div>
  <div class="thinking-content">
    <div class="thinking-content-inner">${escapeHtml(thinkingContent)}</div>
  </div>
</div>`;
}

export function renderMarkdown(text: string, opts?: { skipCache?: boolean }): string {
  const skipCache = opts?.skipCache;

  // Check cache (skip during streaming — every string is unique, cache is pure overhead)
  if (!skipCache) {
    const cached = cache.get(text);
    if (cached) {
      cacheHits++;
      // Move to end (LRU: refresh timestamp)
      cached.ts = Date.now();
      return cached.result;
    }
    cacheMisses++;

    // Evict oldest if at capacity
    if (cache.size >= CACHE_MAX) {
      let oldestKey = "";
      let oldestTs = Infinity;
      for (const [k, v] of cache) {
        if (v.ts < oldestTs) {
          oldestTs = v.ts;
          oldestKey = k;
        }
      }
      if (oldestKey) cache.delete(oldestKey);
    }
  }

  // Pre-process: strip leaked tool syntax, squash unclosed code fences
  let processed = toolSyntaxStrip(text);
  processed = squashOutsideCode(processed);
  // Auto-link bare URLs and scheme-less domains
  processed = autolinkBareUrls(processed);

  // Pre-process math: $$...$$ (display) and $...$ (inline)
  try {
    // Display math: $$...$$
    processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (_: string, formula: string) => {
      try {
        return katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false });
      } catch {
        return `<pre class="math-block">${escapeHtml(formula.trim())}</pre>`;
      }
    });
    // Inline math: $...$ (but not $$)
    processed = processed.replace(/(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g, (_: string, formula: string) => {
      try {
        return katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false });
      } catch {
        return `<code class="math-inline">${escapeHtml(formula.trim())}</code>`;
      }
    });
  } catch { /* keep original text if math processing fails */ }

  let result: string;
  try {
    result = marked.parse(processed) as string;
  } catch {
    result = escapeHtml(processed).replace(/\n/g, "<br>");
  }

  if (!skipCache) {
    cache.set(text, { result, ts: Date.now() });
  }
  return result;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
