import { useState } from "react";
import { AlertTriangle, Zap, Loader2 } from "lucide-react";
import { compactSession } from "../../lib/api";
import { useToastStore } from "../../stores/toastStore";

interface Props {
  inputTokens?: number;
  outputTokens?: number;
  contextWindow?: number;
  cost?: number;
  streamingTokens?: number;
  thinkingTokens?: number;
  sessionKey?: string | null;
  onCompacted?: () => void;
}

export function TokenBar({ inputTokens, outputTokens, contextWindow, cost, streamingTokens, thinkingTokens, sessionKey, onCompacted }: Props) {
  const [compacting, setCompacting] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  const streamEst = streamingTokens || 0;
  const total = (inputTokens || 0) + (outputTokens || 0) + streamEst;
  const pct = contextWindow && contextWindow > 0 ? (total / contextWindow) * 100 : 0;

  let barColor = "var(--color-accent)";
  let showWarning = false;
  let showDanger = false;

  if (pct >= 90) {
    barColor = "var(--color-danger)";
    showDanger = true;
  } else if (pct >= 70) {
    barColor = "var(--color-warning)";
    showWarning = true;
  }

  const handleCompact = async () => {
    if (!sessionKey || compacting) return;
    setCompacting(true);
    try {
      const result = await compactSession(sessionKey);
      if (result.error) {
        addToast(result.error, "warning");
      } else {
        addToast(result.message, "success");
      }
      onCompacted?.();
    } catch (e: any) {
      addToast(e.message || "Compaction failed", "error");
    } finally {
      setCompacting(false);
    }
  };

  if (!total && !cost && !streamingTokens) return null;

  return (
    <div className="flex items-center gap-1.5 text-[8px] text-[var(--color-t3)] flex-shrink-0">
      {/* Token bar */}
      {contextWindow && contextWindow > 0 && (
        <div className="flex items-center gap-1" title={`${total.toLocaleString()} / ${contextWindow.toLocaleString()} tokens`}>
          <div className="w-12 h-2 rounded-full bg-[var(--color-bg3)] overflow-hidden relative">
            {/* Base fill */}
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }}
            />
            {/* Streaming pulse overlay */}
            {streamEst > 0 && (
              <div
                className="absolute inset-0 rounded-full opacity-30 animate-pulse"
                style={{
                  width: `${Math.min(pct, 100)}%`,
                  background: `linear-gradient(90deg, transparent, ${barColor}, transparent)`,
                }}
              />
            )}
          </div>
          <span className={`${showDanger ? "text-[var(--color-danger)] font-medium" : showWarning ? "text-[var(--color-warning)]" : ""}`}>
            {Math.round(pct)}%
          </span>
        </div>
      )}

      {/* Token counts */}
      {inputTokens != null && <span>in:{inputTokens.toLocaleString()}</span>}
      {outputTokens != null && <span>out:{outputTokens.toLocaleString()}</span>}

      {/* Streaming estimate */}
      {streamEst > 0 && (
        <span className="text-[var(--color-accent)] animate-pulse">
          <Zap size={8} className="inline mr-0.5" />
          ~{streamEst.toLocaleString()}
        </span>
      )}

      {/* Cost */}
      {cost != null && cost > 0 && <span className="text-[var(--color-warning)]">${cost.toFixed(4)}</span>}

      {/* Thinking tokens */}
      {thinkingTokens != null && thinkingTokens > 0 && (
        <span className="text-[var(--color-t3)] italic" title={`${thinkingTokens.toLocaleString()} thinking tokens`}>
          🧠{thinkingTokens.toLocaleString()}
        </span>
      )}

      {/* Warning indicators */}
      {showWarning && !showDanger && (
        <span className="text-[var(--color-warning)]" title={`${Math.round(pct)}% of ${contextWindow?.toLocaleString()} context used`}>
          <AlertTriangle size={9} className="inline" />
        </span>
      )}
      {showDanger && (
        <span className="text-[var(--color-danger)] font-medium flex items-center gap-0.5" title={`Context nearly full! ${Math.round(pct)}% used. Consider compacting.`}>
          <AlertTriangle size={9} />
          {sessionKey ? (
            <button
              onClick={handleCompact}
              disabled={compacting}
              className="underline hover:text-[var(--color-danger-hover)] disabled:opacity-50"
            >
              {compacting ? (
                <Loader2 size={9} className="inline animate-spin" />
              ) : (
                "compact"
              )}
            </button>
          ) : (
            <span>compact?</span>
          )}
        </span>
      )}
    </div>
  );
}
