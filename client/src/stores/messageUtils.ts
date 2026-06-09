import type { ContentBlock } from "../lib/api";
import { escapeHtml } from "../lib/sanitize";
import { renderMarkdown } from "../lib/markdown";

// ── Thinking section collapse state (shared across panelStore + block components) ──

/** Track manual expand/collapse state for thinking sections across re-renders.
 *  Key: thinkId (panelId-messageIndex-blockIndex). Value: true=expanded (user manually opened). */
export const _manualExpandSet = new Set<string>();
let _thinkIdCounter = 0;

export function nextThinkId(panelId: number, msgIdx: number): string {
  return `${panelId}-${msgIdx}-${_thinkIdCounter++}`;
}

/** Register toggle tracking on window so blocksToHtml can check user's manual expand state
 *  (used during streaming by ThinkingBlock to persist state across virtualizer recycles
 *   and post-streaming by blocksToHtml for the final render). */
try {
  (window as any).__thinkToggle = (thinkId: string, nowExpanded: boolean) => {
    if (nowExpanded) {
      _manualExpandSet.add(thinkId);
    } else {
      _manualExpandSet.delete(thinkId);
    }
  };
  (window as any).__thinkIsExpanded = (thinkId: string): boolean => {
    return _manualExpandSet.has(thinkId);
  };
} catch {
  // Window may not exist in test/SSR environments
}

// ── Infrastructure message detection ──────────────────

export function isInfrastructureMsg(content: string): boolean {
  return content.includes('thinking-section') ||
         content.includes('tool-card') ||
         content.includes('sub-agent-card') ||
         content.includes('data-live-thinking');
}

/** Find the last plain-text assistant message index, or -1 if none */
export function findTextMsgIdx(msgs: { role: string; content: string }[]): number {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'assistant' && !isInfrastructureMsg(msgs[i].content)) {
      return i;
    }
  }
  return -1;
}

// ── Blocks → HTML converter ─────────────────────────────

/** Build HTML from content blocks (text + thinking). Respects hideThinking flag.
 *  When hideThinking=false but defaultCollapsed=true, sections render collapsed
 *  but the user can still expand them by clicking.
 *  @param extraThinkId - optional panelId-msgIdx for toggle state tracking */
export function blocksToHtml(blocks: ContentBlock[], hideThinking: boolean, thinkingStartTime?: number | null, defaultCollapsed?: boolean, extraThinkId?: string): string {
  if (!blocks || !blocks.length) return '';
  let html = '';
  const thinkTime = thinkingStartTime ? Math.round((Date.now() - thinkingStartTime) / 1000) : undefined;
  const timeStr = thinkTime != null ? String(thinkTime) : null;

  for (const block of blocks) {
    if (block.type === "thinking") {
      const thinkId = extraThinkId || nextThinkId(0, 0);
      // Check if user has manually expanded this section
      const manualExpanded = _manualExpandSet.has(thinkId);
      // Default: collapsed when hideThinking true OR (visible but setting says collapse)
      const startCollapsed = hideThinking || (!manualExpanded && !hideThinking && defaultCollapsed);
      const collapsedClass = startCollapsed ? ' collapsed' : '';

      // Trim and normalize whitespace in thinking content
      const cleanContent = block.content.replace(/^\s+/, '').replace(/\s+$/, '').replace(/\n{3,}/g, '\n\n');

      if (hideThinking) {
        html += `<div class="thinking-section${collapsedClass}" data-think-id="${escapeHtml(thinkId)}"><div class="thinking-header" data-pi-toggle="thinking" data-think-id="${escapeHtml(thinkId)}"><span>Thinking…</span>${timeStr ? `<span class="thinking-time">${escapeHtml(timeStr)}s</span>` : ''}<span class="thinking-toggle">▸</span></div><div class="thinking-content"><div class="thinking-content-inner">${escapeHtml(cleanContent)}</div></div></div>`;
      } else {
        html += `<div class="thinking-section${collapsedClass}" data-think-id="${escapeHtml(thinkId)}"><div class="thinking-header" data-pi-toggle="thinking" data-think-id="${escapeHtml(thinkId)}"><span>View thinking process</span>${timeStr ? `<span class="thinking-time">${escapeHtml(timeStr)}s</span>` : ''}<span class="thinking-toggle">▾</span></div><div class="thinking-content"><div class="thinking-content-inner">${renderMarkdown(cleanContent).trimEnd()}</div></div></div>`;
      }
    } else if (block.type === "text") {
      html += renderMarkdown(block.content);
    }
  }
  return html;
}
