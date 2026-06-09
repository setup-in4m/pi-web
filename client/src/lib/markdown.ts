import { escapeHtml, toolSyntaxStrip } from "./sanitize";
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

// ── Tool syntax stripping imported from shared sanitize ──
// Imports escapeHtml, toolSyntaxStrip from ./sanitize

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


