import { useState, useCallback, memo } from "react";
import { renderMarkdown } from "../../../lib/markdown";
import { escapeHtml } from "../../../lib/sanitize";

interface Props {
  content: string;
  streaming?: boolean;
  defaultCollapsed?: boolean;
  thinkId?: string;
}

/** Thinking block — owns its own collapse state via useState.
 *  Toggle survives re-renders because React preserves component state
 *  when key/index stays the same across renders. */
export const ThinkingBlock = memo(function ThinkingBlock({ content, streaming, defaultCollapsed, thinkId }: Props) {
  // Restore toggle from global state if remounted (virtualizer recycle safety)
  const initialExpanded = thinkId && (window as any).__thinkIsExpanded
    ? (window as any).__thinkIsExpanded(thinkId)
    : null;
  const [collapsed, setCollapsed] = useState(
    initialExpanded !== null ? !initialExpanded : (defaultCollapsed ?? false)
  );
  const toggle = useCallback(() => {
    setCollapsed(c => {
      const next = !c;
      if (thinkId && (window as any).__thinkToggle) {
        (window as any).__thinkToggle(thinkId, !next);
      }
      return next;
    });
  }, [thinkId]);

  if (streaming) {
    return (
      <div className={`thinking-section${collapsed ? ' collapsed' : ''}`} data-live-thinking="true">
        <div className="thinking-header" onClick={toggle} style={{cursor:'pointer'}}>
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse flex-shrink-0" />
          <span>Thinking…</span>
          <span className="thinking-toggle" style={{transform:'none'}}>▾</span>
        </div>
        <div className="thinking-content">
          <div className="thinking-content-inner">{escapeHtml(content)}<span className="streaming-cursor">▊</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`thinking-section${collapsed ? ' collapsed' : ''}`}>
      <div className="thinking-header" onClick={toggle}>
        <span>View thinking process</span>
        <span className="thinking-toggle">▾</span>
      </div>
      <div className="thinking-content">
        <div className="thinking-content-inner" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
      </div>
    </div>
  );
});
