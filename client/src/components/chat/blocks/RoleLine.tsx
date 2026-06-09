import { useState } from "react";
import type { MessageRecord } from "../../../lib/api";
import { formatTime } from "../../../lib/time";
import { useModelStore } from "../../../stores/modelStore";
import { usePanelStore } from "../../../stores/panelStore";

interface Props {
  message: MessageRecord;
  panelIndex?: number;
}

/** Generate a consistent HSL color from a model name */
function modelDotColor(name?: string): string {
  if (!name) return 'var(--color-accent)';
  let hash = 0;
  const key = name.toLowerCase();
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  return `hsl(${((hash % 360) + 360) % 360}, 55%, 60%)`;
}

function estimateTokens(content: string): number {
  const div = document.createElement("div");
  div.innerHTML = content;
  const plain = (div.textContent || div.innerText || content).trim();
  return Math.max(1, Math.round(plain.length / 4));
}

export function RoleLine({ message, panelIndex }: Props) {
  const isUser = message.role === "user";
  const [modelInfoOpen, setModelInfoOpen] = useState(false);

  const panel = usePanelStore((s) => panelIndex != null ? s.panels[panelIndex] : undefined);
  const models = useModelStore((s) => s.models);
  const defaultProvider = useModelStore((s) => s.defaultProvider);
  const defaultModel = useModelStore((s) => s.defaultModel);
  const currentModel = panel?.model || { provider: defaultProvider, modelId: defaultModel };
  const modelObj = currentModel ? models.find(m => m.providerId === currentModel.provider && m.modelId === currentModel.modelId) : undefined;
  const modelDisplay = modelObj?.displayName || currentModel?.modelId || `${currentModel?.provider}/${currentModel?.modelId}`;

  const dotColor = isUser ? 'var(--color-accent)' : modelDotColor(modelDisplay);
  const roleLabel = isUser ? 'You' : (modelDisplay?.split('/').pop() || 'pi');
  const tokens = estimateTokens(message.content || '');

  return (
    <div className="flex items-center gap-1.5 mb-0.5 relative">
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: dotColor }}
      />
      <span
        className="text-[9px] font-semibold uppercase tracking-wide cursor-pointer hover:underline"
        style={{ color: dotColor }}
        onClick={() => !isUser && setModelInfoOpen(!modelInfoOpen)}
        title={!isUser ? 'Click for model info' : undefined}
      >
        {roleLabel}
      </span>

      {/* Model info popup */}
      {!isUser && modelInfoOpen && modelObj && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setModelInfoOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-[var(--color-bg2)] border border-[var(--color-bdl)] rounded-lg shadow-2xl p-3 min-w-[200px] text-[10px]">
            <div className="font-semibold text-[var(--color-t1)] text-[11px] mb-1">{modelObj.displayName}</div>
            <div className="text-[var(--color-t3)]">Provider: {modelObj.providerId}</div>
            {modelObj.contextWindow && (
              <div className="text-[var(--color-t3)]">
                Context: {modelObj.contextWindow >= 1000 ? `${modelObj.contextWindow / 1000}K` : modelObj.contextWindow} tokens
              </div>
            )}
            {modelObj.cost && (
              <div className="text-[var(--color-t3)]">
                Pricing: ${modelObj.cost.input.toFixed(0)}/{((modelObj.cost as any).output ?? modelObj.cost.input).toFixed(0)} per 1M
              </div>
            )}
            {modelObj.supportsThinking && <div className="text-[var(--color-accent)] mt-1">✓ Extended thinking</div>}
          </div>
        </>
      )}

      <span className="text-[7px] text-[var(--color-t3)]">
        {formatTime(message.timestamp)}
      </span>
      <span
        className="text-[7px] text-[var(--color-t3)] cursor-help"
        title={`~${tokens.toLocaleString()} tokens`}
      >
        ~{tokens.toLocaleString()} tok
      </span>
    </div>
  );
}
