import type { PanelData } from "../../stores/panelStore";
import { usePanelStore } from "../../stores/panelStore";
import { useModelStore } from "../../stores/modelStore";
import { TokenBar } from "./TokenBar";
import { ProfileSelector } from "./ProfileSelector";
import { Download } from "lucide-react";

interface Props {
  panel: PanelData;
  panelIndex: number;
}

export function PanelHeader({ panel, panelIndex }: Props) {
  const setModel = usePanelStore((s) => s.setModel);
  const setThinking = usePanelStore((s) => s.setThinking);
  const { models, providers } = useModelStore();

  const name = panel.title || (panel.workspacePath ? panel.workspacePath.split(/[/\\]/).pop() : "New panel");
  const currentModel = panel.model ? models.find(m => m.providerId === panel.model!.provider && m.modelId === panel.model!.modelId) : null;

  return (
    <div className="flex items-center gap-2 px-2.5 py-0.5 bg-[var(--color-bg2)] border-b border-[var(--color-bd)] text-[10px] text-[var(--color-t3)] flex-shrink-0 min-h-[22px] overflow-hidden">
      <span className="text-[var(--color-accent)]">◆</span>
      <span className="text-[var(--color-t2)] font-medium truncate">{name}</span>

      {/* Token bar — contextual */}
      <TokenBar
        inputTokens={panel.usage?.inputTokens}
        outputTokens={panel.usage?.outputTokens}
        contextWindow={currentModel?.contextWindow ?? undefined}
        cost={panel.usage?.cost}
        streamingTokens={panel.streamingOutputTokens}
      />

      <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
        {panel.workspacePath && (
          <>
            {/* Export */}
            {panel.sessionKey && panel.messages.length > 0 && (
              <a
                href={`/api/session/${encodeURIComponent(panel.sessionKey)}/export`}
                className="text-[var(--color-t3)] hover:text-[var(--color-t1)] transition-colors p-0.5"
                title="Export as Markdown"
                aria-label="Export session as Markdown"
              >
                <Download size={11} />
              </a>
            )}
            {/* Agent profile selector */}
            <ProfileSelector panelIndex={panelIndex} />
            {/* Model selector */}
            <select
              value={panel.model ? `${panel.model.provider}/${panel.model.modelId}` : ""}
              onChange={(e) => {
                const [provider, modelId] = e.target.value.split("/");
                if (provider && modelId) setModel(panelIndex, provider, modelId);
              }}
              className="bg-[var(--color-bg3)] text-[var(--color-t2)] border border-[var(--color-bd)] rounded px-1 py-0 text-[9px] font-sans cursor-pointer max-w-[110px] outline-none focus:border-[var(--color-accent)]"
              title={currentModel ? `${currentModel.displayName} · ${currentModel.contextWindow?.toLocaleString() || "?"} ctx` : "Select model"}
            >
              <option value="">auto</option>
              {providers.map((prov) => (
                <optgroup key={prov} label={prov}>
                  {models
                    .filter((m) => m.providerId === prov)
                    .map((m) => (
                      <option key={m.modelId} value={`${m.providerId}/${m.modelId}`}>
                        {m.displayName}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>

            {/* Thinking selector */}
            <select
              value={panel.thinking}
              onChange={(e) => setThinking(panelIndex, e.target.value)}
              className="bg-[var(--color-bg3)] text-[var(--color-t2)] border border-[var(--color-bd)] rounded px-1 py-0 text-[9px] font-sans cursor-pointer outline-none focus:border-[var(--color-accent)]"
              title="Thinking level"
            >
              <option value="off">🧠 off</option>
              <option value="low">low</option>
              <option value="medium">med</option>
              <option value="high">high</option>
            </select>
          </>
        )}
      </div>
    </div>
  );
}
