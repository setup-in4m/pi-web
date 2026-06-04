import { marked } from "marked";
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

      const langLabel = detectedLang
        ? `<span class="text-[9px] text-[var(--color-t3)] uppercase">${escapeHtml(detectedLang)}</span>`
        : "";

      const escapedCode = escapeHtml(text).replace(/"/g, "&quot;");

      return `<div class="code-block-wrapper relative group my-1.5">
        <div class="flex items-center justify-between px-2 py-0.5 bg-[#161b22] border border-b-0 border-[var(--color-bdl)] rounded-t text-[10px]">
          ${langLabel}
          <button class="copy-btn text-[9px] text-[var(--color-t3)] hover:text-[var(--color-t1)] transition-colors" data-code="${escapedCode}">
            Copy
          </button>
        </div>
        <pre class="bg-[#0d1117] p-2 rounded-b border border-[var(--color-bdl)] overflow-x-auto text-[11px] leading-relaxed m-0"><code>${highlighted}</code></pre>
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

// ── LRU Cache for memoized markdown rendering ────────────

const CACHE_MAX = 200;
const cache = new Map<string, { result: string; ts: number }>();

let cacheHits = 0;
let cacheMisses = 0;

export function getCacheStats(): { hits: number; misses: number; size: number } {
  return { hits: cacheHits, misses: cacheMisses, size: cache.size };
}

export function renderMarkdown(text: string): string {
  // Check cache
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

  let result: string;
  try {
    result = marked.parse(text) as string;
  } catch {
    result = escapeHtml(text).replace(/\n/g, "<br>");
  }

  cache.set(text, { result, ts: Date.now() });
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
