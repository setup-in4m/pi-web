import { X, Plus, Trash2, Play, Workflow, ArrowDown, ArrowLeftRight, Bookmark } from "lucide-react";
import { useWorkflowStore, WORKFLOW_TEMPLATES, type WorkflowMode } from "../../stores/workflowStore";
import { useModelStore } from "../../stores/modelStore";
import { usePanelStore } from "../../stores/panelStore";
import { useToastStore } from "../../stores/toastStore";
import * as api from "../../lib/api";

export function WorkflowBuilder() {
  const { open, steps, mode, setOpen, addStep, removeStep, updateStep, setMode, loadTemplate, clearSteps } = useWorkflowStore();
  const { models, providers } = useModelStore();
  const addToast = useToastStore((s) => s.addToast);
  const panels = usePanelStore((s) => s.panels);
  const spawnFromPanel = usePanelStore((s) => s.spawnFromPanel);

  if (!open) return null;

  const validSteps = steps.filter((s) => s.prompt.trim());
  const workspacePath = panels[0]?.workspacePath;

  const handleExecute = async () => {
    if (!workspacePath) {
      addToast("No workspace open", "error");
      return;
    }
    if (validSteps.length === 0) {
      addToast("Add at least one prompt", "warning");
      return;
    }

    setOpen(false);
    const sourceIdx = 0;

    if (mode === "parallel") {
      // Run all steps simultaneously in separate panels
      for (const step of validSteps) {
        spawnFromPanel(sourceIdx);

        // Find the new panel (last one added)
        const newIdx = usePanelStore.getState().panels.length - 1;

        // Set model if specified
        if (step.model) {
          usePanelStore.getState().setModel(newIdx, step.model.provider, step.model.modelId);
        }

        try {
          const result = await api.createSession(workspacePath, step.prompt.slice(0, 40));
          usePanelStore.setState((s) => ({
            panels: s.panels.map((p, i) =>
              i === newIdx ? { ...p, sessionKey: result.key, sessionId: result.sessionId, title: result.title } : p
            ),
          }));
          await api.setModel(result.key, step.model?.provider || "", step.model?.modelId || "");
          await api.sendMessage(result.key, step.prompt);
        } catch (e: any) {
          addToast(e.message, "error");
        }
      }
    } else {
      // Chain mode: run sequentially, each output feeds next
      addToast(`Running ${validSteps.length} steps in chain…`, "success");

      // Run steps sequentially using a background flow
      runChain(workspacePath, validSteps, addToast);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <div className="relative w-[560px] max-h-[85vh] bg-[var(--color-bg2)] border border-[var(--color-bdl)] rounded-xl shadow-2xl flex flex-col overflow-hidden z-10">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-bd)] flex-shrink-0">
          <Workflow size={16} className="text-[var(--color-accent)]" />
          <span className="text-sm font-semibold">Workflow Builder</span>
          <button onClick={() => setOpen(false)} className="ml-auto text-[var(--color-t3)] hover:text-[var(--color-t1)] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Mode selector */}
        <div className="flex gap-1 px-4 py-2 border-b border-[var(--color-bd)] flex-shrink-0">
          {([
            { value: "chain" as WorkflowMode, icon: ArrowDown, label: "Chain" },
            { value: "parallel" as WorkflowMode, icon: ArrowLeftRight, label: "Parallel" },
          ]).map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] transition-colors ${mode === opt.value ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]" : "text-[var(--color-t2)] hover:bg-[var(--color-bgh)]"}`}
              >
                <Icon size={11} />
                {opt.label}
              </button>
            );
          })}

          {/* Templates */}
          <div className="ml-auto flex items-center gap-1">
            {WORKFLOW_TEMPLATES.map((t) => (
              <button
                key={t.name}
                onClick={() => loadTemplate(t)}
                className="flex items-center gap-1 px-2 py-1 rounded text-[9px] text-[var(--color-t3)] hover:text-[var(--color-t2)] hover:bg-[var(--color-bgh)] transition-colors"
                title={t.description}
              >
                <Bookmark size={9} />
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {steps.map((step, i) => (
            <div key={step.id} className="relative">
              {/* Step connector */}
              {mode === "chain" && i > 0 && (
                <div className="flex items-center justify-center -mt-1.5 mb-0.5">
                  <ArrowDown size={14} className="text-[var(--color-t3)]" />
                </div>
              )}

              <div className="flex gap-2 items-start p-3 rounded-lg border border-[var(--color-bd)] bg-[var(--color-bg3)]">
                <span className="text-[10px] font-bold text-[var(--color-t3)] mt-1.5 w-5 text-center flex-shrink-0">
                  {i + 1}
                </span>

                <div className="flex-1 flex flex-col gap-2">
                  {/* Model selector */}
                  <div className="flex gap-1.5">
                    <select
                      value={step.model ? `${step.model.provider}/${step.model.modelId}` : ""}
                      onChange={(e) => {
                        const [provider, modelId] = e.target.value.split("/");
                        updateStep(step.id, {
                          model: provider && modelId ? { provider, modelId } : undefined,
                        });
                      }}
                      className="flex-1 bg-[var(--color-bg)] border border-[var(--color-bd)] rounded px-2 py-1 text-[10px] text-[var(--color-t2)] outline-none focus:border-[var(--color-accent)]"
                      title="Model for this step"
                    >
                      <option value="">auto (default)</option>
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

                    <select
                      value={step.thinking}
                      onChange={(e) => updateStep(step.id, { thinking: e.target.value })}
                      className="w-[80px] bg-[var(--color-bg)] border border-[var(--color-bd)] rounded px-2 py-1 text-[10px] text-[var(--color-t2)] outline-none focus:border-[var(--color-accent)]"
                      title="Thinking level"
                    >
                      <option value="off">think: off</option>
                      <option value="low">low</option>
                      <option value="medium">med</option>
                      <option value="high">high</option>
                    </select>

                    {steps.length > 1 && (
                      <button
                        onClick={() => removeStep(step.id)}
                        className="text-[var(--color-t3)] hover:text-[var(--color-danger)] transition-colors p-1"
                        title="Remove step"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  {/* Prompt textarea */}
                  <textarea
                    value={step.prompt}
                    onChange={(e) => updateStep(step.id, { prompt: e.target.value })}
                    placeholder={mode === "chain" ? `Step ${i + 1} prompt…` : `Panel ${i + 1} prompt…`}
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-bd)] rounded px-2 py-1.5 text-[11px] text-[var(--color-t1)] resize-y min-h-[50px] outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-t3)] font-sans"
                    rows={2}
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Add step */}
          <button
            onClick={addStep}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-[var(--color-bd)] text-[10px] text-[var(--color-t3)] hover:text-[var(--color-t2)] hover:border-[var(--color-bdl)] transition-colors justify-center"
          >
            <Plus size={12} />
            Add step
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-bd)] flex-shrink-0">
          <button
            onClick={clearSteps}
            className="text-[10px] text-[var(--color-t3)] hover:text-[var(--color-t2)] transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleExecute}
            disabled={!workspacePath || validSteps.length === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-[11px] font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-25 transition-colors"
          >
            <Play size={12} />
            Run {mode === "chain" ? "Chain" : "Parallel"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Chain execution helper ─────────────────────────────

async function runChain(
  workspacePath: string,
  steps: import("../../stores/workflowStore").WorkflowStep[],
  addToast: (msg: string, type: "success" | "error" | "warning") => void
) {
  let contextPrompt = "";

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    // Build prompt with context from previous step
    const fullPrompt = i === 0
      ? step.prompt
      : `Previous step output:\n\n${contextPrompt}\n\n---\n\nYour task:\n${step.prompt}`;

    try {
      // Create session
      const result = await api.createSession(workspacePath, `Step ${i + 1}: ${step.prompt.slice(0, 30)}`);
      if (step.model) {
        await api.setModel(result.key, step.model.provider, step.model.modelId);
      }

      // Open the session in a new panel
      const state = usePanelStore.getState();
      state.spawnFromPanel(0);
      await new Promise((r) => setTimeout(r, 100));

      const newIdx = usePanelStore.getState().panels.length - 1;
      usePanelStore.setState((s) => ({
        panels: s.panels.map((p, idx) =>
          idx === newIdx ? {
            ...p,
            workspacePath,
            sessionKey: result.key,
            sessionId: result.sessionId,
            title: `Step ${i + 1}`,
            model: step.model || null,
            thinking: step.thinking,
            messages: [{ role: "user", content: fullPrompt, timestamp: new Date().toISOString() }],
            streaming: true,
          } : p
        ),
      }));

      await api.sendMessage(result.key, fullPrompt);

      // Wait for step to complete by polling
      await waitForCompletion(result.key);

      // Get the output for next step
      const transcript = await api.getTranscript(result.key);
      const lastAssistant = [...transcript.transcript].reverse().find((m: any) => m.role === "assistant");
      if (lastAssistant) {
        const div = document.createElement("div");
        div.innerHTML = lastAssistant.content;
        contextPrompt = (div.textContent || div.innerText || lastAssistant.content).trim();
      }
    } catch (e: any) {
      addToast(`Step ${i + 1} failed: ${e.message}`, "error");
      break;
    }
  }

  addToast("Workflow complete", "success");
}

async function waitForCompletion(key: string): Promise<void> {
  // Poll for session completion
  for (let attempt = 0; attempt < 600; attempt++) {
    try {
      const res = await fetch(`/api/session/${encodeURIComponent(key)}/usage`);
      if (!res.ok) break;
    } catch {
      // Session may not be ready yet
    }

    // Check if streaming is done via store
    const panel = usePanelStore.getState().panels.find((p) => p.sessionKey === key);
    if (panel && !panel.streaming && panel.messages.length > 0) {
      return;
    }

    await new Promise((r) => setTimeout(r, 1000));
  }
}
