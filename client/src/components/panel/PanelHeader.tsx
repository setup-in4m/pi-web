import type { PanelData } from "../../stores/panelStore";
import { usePanelStore } from "../../stores/panelStore";
import { useModelStore } from "../../stores/modelStore";
import { TokenBar } from "./TokenBar";
import { ProfileSelector } from "./ProfileSelector";
import { ModelSelector } from "./ModelSelector";
import { Download, Copy, FileText, Code, ChevronDown, Share2 } from "lucide-react";
import { useToastStore } from "../../stores/toastStore";
import { useState, useRef, useCallback } from "react";

interface Props {
  panel: PanelData;
  panelIndex: number;
}

export function PanelHeader({ panel, panelIndex }: Props) {
  const setModel = usePanelStore((s) => s.setModel);
  const setThinking = usePanelStore((s) => s.setThinking);
  const { models, providers, recentModels, addRecentModel } = useModelStore();
  const addToast = useToastStore((s) => s.addToast);
  const setTitle = usePanelStore((s) => s.setTitle);
  const [exportOpen, setExportOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  const name = panel.title || (panel.workspacePath ? panel.workspacePath.split(/[/\\]/).pop() : "New panel");

  const startRename = useCallback(() => {
    setTitleDraft(name || "");
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.select(), 10);
  }, [name]);

  const commitRename = useCallback(() => {
    setEditingTitle(false);
    if (titleDraft.trim() && titleDraft.trim() !== name) {
      setTitle(panelIndex, titleDraft.trim());
    }
  }, [titleDraft, name, panelIndex, setTitle]);
  const currentModel = panel.model ? models.find(m => m.providerId === panel.model!.provider && m.modelId === panel.model!.modelId) : null;

  return (
    <div className="flex items-center gap-2 px-2.5 py-0.5 bg-[var(--color-bg2)] border-b border-[var(--color-bd)] text-[10px] text-[var(--color-t3)] flex-shrink-0 min-h-[22px] overflow-hidden">
      <span className="w-[6px] h-[6px] rounded-full bg-[var(--color-accent)] flex-shrink-0" />
      {editingTitle ? (
        <input
          ref={titleInputRef}
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") { setEditingTitle(false); }
          }}
          className="bg-[var(--color-bg3)] border border-[var(--color-accent)] rounded px-1 py-0 text-[10px] text-[var(--color-t1)] font-medium outline-none w-[120px]"
        />
      ) : (
        <span
          className="text-[var(--color-t2)] font-medium truncate cursor-pointer hover:text-[var(--color-t1)] select-none"
          onDoubleClick={startRename}
          title="Double-click to rename"
        >
          {name}
        </span>
      )}

      {/* Token bar — always rendered for layout stability */}
      <TokenBar
        inputTokens={panel.usage?.inputTokens}
        outputTokens={panel.usage?.outputTokens}
        contextWindow={currentModel?.contextWindow ?? undefined}
        cost={panel.usage?.cost}
        streamingTokens={panel.streamingOutputTokens}
        thinkingTokens={panel.thinkingTokens}
        sessionKey={panel.sessionKey}
      />

      <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
        {panel.workspacePath && (
          <>
            {/* Export dropdown */}
            {panel.sessionKey && panel.messages.length > 0 && (
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setExportOpen(!exportOpen)}
                  className="flex items-center gap-0.5 text-[var(--color-t3)] hover:text-[var(--color-t1)] transition-colors p-0.5"
                  title="Export"
                  aria-label="Export session"
                >
                  <Download size={11} />
                  <ChevronDown size={7} />
                </button>
                {exportOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-[200px] bg-[var(--color-bg2)] border border-[var(--color-bdl)] rounded-lg shadow-2xl z-50 py-1 overflow-hidden">
                      <a
                        href={`/api/session/${encodeURIComponent(panel.sessionKey)}/export`}
                        className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--color-t2)] hover:bg-[var(--color-bgh)] hover:text-[var(--color-t1)] transition-colors w-full text-left"
                        onClick={() => setExportOpen(false)}
                      >
                        <FileText size={12} />
                        Export as Markdown
                      </a>
                      <a
                        href={`/api/session/${encodeURIComponent(panel.sessionKey)}/export?format=html`}
                        className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--color-t2)] hover:bg-[var(--color-bgh)] hover:text-[var(--color-t1)] transition-colors w-full text-left"
                        onClick={() => setExportOpen(false)}
                      >
                        <Code size={12} />
                        Export as HTML
                      </a>
                      <button
                        onClick={async () => {
                          setExportOpen(false);
                          try {
                            const res = await fetch(`/api/session/${encodeURIComponent(panel.sessionKey!)}/copy`);
                            const text = await res.text();
                            await navigator.clipboard.writeText(text);
                            addToast("Transcript copied to clipboard", "success");
                          } catch {
                            addToast("Failed to copy", "error");
                          }
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--color-t2)] hover:bg-[var(--color-bgh)] hover:text-[var(--color-t1)] transition-colors w-full text-left"
                      >
                        <Copy size={12} />
                        Copy Transcript
                      </button>
                      <div className="border-t border-[var(--color-bd)] my-0.5" />
                      <button
                        onClick={async () => {
                          setExportOpen(false);
                          setSharing(true);
                          try {
                            const res = await fetch(`/api/session/${encodeURIComponent(panel.sessionKey!)}/share`);
                            const data = await res.json();
                            if (data.url) {
                              await navigator.clipboard.writeText(data.url);
                              addToast(`Gist created — URL copied!`, "success");
                            } else if (data.error) {
                              addToast(data.error, "error");
                            }
                          } catch (e: any) {
                            addToast(e.message || "Failed to share", "error");
                          } finally {
                            setSharing(false);
                          }
                        }}
                        disabled={sharing}
                        className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--color-t2)] hover:bg-[var(--color-bgh)] hover:text-[var(--color-t1)] transition-colors w-full text-left disabled:opacity-50"
                      >
                        <Share2 size={12} />
                        {sharing ? "Creating Gist…" : "Share via Gist"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {/* Agent profile selector */}
            <ProfileSelector panelIndex={panelIndex} />
            {/* Model selector */}
            <ModelSelector
              models={models}
              providers={providers}
              recentModels={recentModels}
              currentModel={panel.model}
              onSelect={(provider, modelId) => setModel(panelIndex, provider, modelId)}
              onAddRecent={(provider, modelId) => addRecentModel(provider, modelId)}
            />

            {/* Thinking selector with level indicator */}
            <div className="flex items-center gap-0.5">
              {panel.thinking !== "off" && (
                <span
                  className={`px-1 rounded text-[7px] font-bold uppercase leading-none ${
                    panel.thinking === "high"
                      ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                      : panel.thinking === "medium"
                      ? "bg-[var(--color-warning)]/15 text-[var(--color-warning)]"
                      : "bg-[#3b82f6]/15 text-[#3b82f6]"
                  }`}
                  title={`Thinking: ${panel.thinking}`}
                >
                  {panel.thinking}
                </span>
              )}
              <select
                value={panel.thinking}
                onChange={(e) => setThinking(panelIndex, e.target.value)}
                className="bg-[var(--color-bg3)] text-[var(--color-t2)] border border-[var(--color-bd)] rounded px-1 py-0 text-[9px] font-sans cursor-pointer outline-none focus:border-[var(--color-accent)]"
                title="Thinking level"
              >
                <option value="off">think: off</option>
                <option value="low">low</option>
                <option value="medium">med</option>
                <option value="high">high</option>
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
