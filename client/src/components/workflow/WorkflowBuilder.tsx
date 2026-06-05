import { useMemo } from "react";
import {
  X, Plus, Trash2, Play, Workflow, ArrowDown, ArrowLeftRight, Bookmark,
  GitBranch, Repeat, Diamond, ArrowRight, ChevronRight, MoveUp, MoveDown,
} from "lucide-react";
import { useWorkflowStore, WORKFLOW_TEMPLATES, type WorkflowMode, type StepType, type LoopType } from "../../stores/workflowStore";
import { useModelStore } from "../../stores/modelStore";
import { usePanelStore } from "../../stores/panelStore";
import { useToastStore } from "../../stores/toastStore";
import * as api from "../../lib/api";
import type { WorkflowStep } from "../../stores/workflowStore";

export function WorkflowBuilder() {
  const { open, steps, mode, setOpen, addStep, removeStep, updateStep, setMode, loadTemplate, clearSteps, reorderSteps } = useWorkflowStore();
  const { models, providers } = useModelStore();
  const addToast = useToastStore((s) => s.addToast);
  const panels = usePanelStore((s) => s.panels);

  if (!open) return null;

  const workspacePath = panels[0]?.workspacePath;

  const handleExecute = async () => {
    if (!workspacePath) {
      addToast("No workspace open", "error");
      return;
    }

    const execPlan = buildExecutionPlan(steps);
    if (!execPlan.valid) {
      addToast(execPlan.error || "Invalid workflow", "warning");
      return;
    }

    setOpen(false);
    addToast(`Running workflow: ${execPlan.label}`, "success");
    runExecutionPlan(workspacePath, execPlan, addToast);
  };

  const stepMap = useMemo(() => {
    const map = new Map<string, WorkflowStep>();
    for (const s of steps) map.set(s.id, s);
    return map;
  }, [steps]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <div className="relative w-[620px] max-h-[85vh] bg-[var(--color-bg2)] border border-[var(--color-bdl)] rounded-xl shadow-2xl flex flex-col overflow-hidden z-10">
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
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {steps.map((step, i) => (
            <StepEditor
              key={step.id}
              step={step}
              index={i}
              total={steps.length}
              isFirst={i === 0}
              isLast={i === steps.length - 1}
              prevStepType={i > 0 ? steps[i - 1].stepType : undefined}
              stepMap={stepMap}
              models={models}
              providers={providers}
              onUpdate={(updates) => updateStep(step.id, updates)}
              onRemove={() => removeStep(step.id)}
              onMoveUp={() => i > 0 && reorderSteps(i, i - 1)}
              onMoveDown={() => i < steps.length - 1 && reorderSteps(i, i + 1)}
            />
          ))}

          {/* Add step buttons */}
          <div className="flex gap-2 justify-center mt-1">
            <button
              onClick={() => addStep("prompt")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-[var(--color-bd)] text-[10px] text-[var(--color-t3)] hover:text-[var(--color-t2)] hover:border-[var(--color-bdl)] transition-colors"
            >
              <Plus size={12} />
              Prompt
            </button>
            <button
              onClick={() => addStep("decision")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-[var(--color-success)]/50 text-[10px] text-[var(--color-success)] hover:text-[#4ade80] hover:border-[var(--color-success)]/80 transition-colors"
            >
              <GitBranch size={12} />
              Decision
            </button>
            <button
              onClick={() => addStep("loop")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-[#f59e0b]/50 text-[10px] text-[#f59e0b] hover:text-[#fbbf24] hover:border-[#f59e0b]/80 transition-colors"
            >
              <Repeat size={12} />
              Loop
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-bd)] flex-shrink-0">
          <button onClick={clearSteps} className="text-[10px] text-[var(--color-t3)] hover:text-[var(--color-t2)] transition-colors">
            Clear
          </button>
          <button
            onClick={handleExecute}
            disabled={!workspacePath}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-[11px] font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-25 transition-colors"
          >
            <Play size={12} />
            Run Workflow
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step Editor Component ──────────────────────────────────

interface StepEditorProps {
  step: WorkflowStep;
  index: number;
  total: number;
  isFirst: boolean;
  isLast: boolean;
  prevStepType?: StepType;
  stepMap: Map<string, WorkflowStep>;
  models: import("../../lib/api").Model[];
  providers: string[];
  onUpdate: (updates: Partial<WorkflowStep>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function StepEditor({ step, index, isFirst, isLast, prevStepType: _prevStepType, stepMap, models, providers, onUpdate, onRemove, onMoveUp, onMoveDown }: StepEditorProps) {
  const isDecision = step.stepType === "decision";
  const isLoop = step.stepType === "loop";
  const isPrompt = step.stepType === "prompt";

  const modelOptions = (
    <>
      <option value="">auto (default)</option>
      {providers.map((prov) => (
        <optgroup key={prov} label={prov}>
          {models.filter((m) => m.providerId === prov).map((m) => (
            <option key={m.modelId} value={`${m.providerId}/${m.modelId}`}>{m.displayName}</option>
          ))}
        </optgroup>
      ))}
    </>
  );

  const borderClass = isDecision
    ? "border-[var(--color-success)]/40 bg-[rgba(34,197,94,0.04)]"
    : isLoop
    ? "border-[#f59e0b]/40 bg-[rgba(245,158,11,0.04)]"
    : "border-[var(--color-bd)] bg-[var(--color-bg3)]";

  const accentColor = isDecision ? "text-[var(--color-success)]" : isLoop ? "text-[#f59e0b]" : "text-[var(--color-t3)]";

  return (
    <div className={`relative rounded-lg border ${borderClass} transition-colors`}>
      {/* Connector above */}
      {!isFirst && (
        <div className="flex items-center justify-center -mt-2 mb-1">
          <ArrowDown size={14} className="text-[var(--color-t3)]" />
        </div>
      )}

      <div className="flex gap-2 items-start p-3">
        {/* Step type icon + number */}
        <div className={`flex flex-col items-center gap-0.5 mt-1.5 w-5 flex-shrink-0`}>
          {isDecision ? (
            <Diamond size={14} className={accentColor} />
          ) : isLoop ? (
            <Repeat size={14} className={accentColor} />
          ) : (
            <span className={`text-[10px] font-bold ${accentColor}`}>{index + 1}</span>
          )}
          {/* Move buttons */}
          {!isFirst && (
            <button onClick={onMoveUp} className="text-[var(--color-t3)] hover:text-[var(--color-t1)]" title="Move up">
              <MoveUp size={10} />
            </button>
          )}
          {!isLast && (
            <button onClick={onMoveDown} className="text-[var(--color-t3)] hover:text-[var(--color-t1)]" title="Move down">
              <MoveDown size={10} />
            </button>
          )}
        </div>

        <div className="flex-1 flex flex-col gap-2">
          {/* Step type label + remove */}
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-semibold uppercase tracking-wide ${accentColor}`}>
              {isDecision ? "Decision" : isLoop ? `Loop · ${step.loopType || "for"}` : "Prompt"}
            </span>
            <button onClick={onRemove} className="ml-auto text-[var(--color-t3)] hover:text-[var(--color-danger)] transition-colors p-0.5" title="Remove step">
              <Trash2 size={11} />
            </button>
          </div>

          {/* ── PROMPT STEP ─────────────────── */}
          {isPrompt && (
            <>
              <div className="flex gap-1.5">
                <button
                  onClick={() => onUpdate({ isParallel: !step.isParallel })}
                  className={`px-1.5 py-1 rounded text-[9px] font-medium transition-colors border flex-shrink-0 ${
                    step.isParallel
                      ? "bg-[var(--color-accent)]/15 border-[var(--color-accent)] text-[var(--color-accent)]"
                      : "bg-[var(--color-bg)] border-[var(--color-bd)] text-[var(--color-t3)] hover:border-[var(--color-bdl)]"
                  }`}
                  title={step.isParallel ? "Runs in parallel with adjacent ∥ steps" : "Runs sequentially"}
                >
                  {step.isParallel ? "∥" : "→"}
                </button>
                <select
                  value={step.model ? `${step.model.provider}/${step.model.modelId}` : ""}
                  onChange={(e) => {
                    const [provider, modelId] = e.target.value.split("/");
                    onUpdate({ model: provider && modelId ? { provider, modelId } : undefined });
                  }}
                  className="flex-1 bg-[var(--color-bg)] border border-[var(--color-bd)] rounded px-2 py-1 text-[10px] text-[var(--color-t2)] outline-none focus:border-[var(--color-accent)]"
                  title="Model for this step"
                >
                  {modelOptions}
                </select>
                <select
                  value={step.thinking}
                  onChange={(e) => onUpdate({ thinking: e.target.value })}
                  className="w-[80px] bg-[var(--color-bg)] border border-[var(--color-bd)] rounded px-2 py-1 text-[10px] text-[var(--color-t2)] outline-none focus:border-[var(--color-accent)]"
                  title="Thinking level"
                >
                  <option value="off">think: off</option>
                  <option value="low">low</option>
                  <option value="medium">med</option>
                  <option value="high">high</option>
                </select>
              </div>
              <textarea
                value={step.prompt}
                onChange={(e) => onUpdate({ prompt: e.target.value })}
                placeholder={`Step ${index + 1} prompt…`}
                className="w-full bg-[var(--color-bg)] border border-[var(--color-bd)] rounded px-2 py-1.5 text-[11px] text-[var(--color-t1)] resize-y min-h-[50px] outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-t3)] font-sans"
                rows={2}
              />
            </>
          )}

          {/* ── DECISION STEP ───────────────── */}
          {isDecision && (
            <>
              {/* Condition prompt */}
              <div>
                <label className="text-[9px] text-[var(--color-t3)] uppercase tracking-wide">Condition</label>
                <textarea
                  value={step.condition || ""}
                  onChange={(e) => onUpdate({ condition: e.target.value })}
                  placeholder="Ask a yes/no question, e.g. 'Are there security bugs?'"
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-bd)] rounded px-2 py-1.5 text-[11px] text-[var(--color-t1)] resize-y min-h-[36px] outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-t3)] font-sans mt-0.5"
                  rows={1}
                />
              </div>

              {/* Decision model */}
              <div>
                <label className="text-[9px] text-[var(--color-t3)] uppercase tracking-wide">Decision model</label>
                <select
                  value={step.decisionModel ? `${step.decisionModel.provider}/${step.decisionModel.modelId}` : ""}
                  onChange={(e) => {
                    const [provider, modelId] = e.target.value.split("/");
                    onUpdate({ decisionModel: provider && modelId ? { provider, modelId } : undefined });
                  }}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-bd)] rounded px-2 py-1 text-[10px] text-[var(--color-t2)] outline-none focus:border-[var(--color-accent)] mt-0.5"
                >
                  <option value="">auto (current model)</option>
                  {providers.map((prov) => (
                    <optgroup key={prov} label={prov}>
                      {models.filter((m) => m.providerId === prov).map((m) => (
                        <option key={m.modelId} value={`${m.providerId}/${m.modelId}`}>{m.displayName}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Branch selectors */}
              <div className="flex gap-2">
                {/* YES branch */}
                <div className="flex-1 border border-[var(--color-success)]/30 rounded bg-[rgba(34,197,94,0.03)] p-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ArrowRight size={10} className="text-[var(--color-success)]" />
                    <span className="text-[9px] font-semibold text-[var(--color-success)]">YES</span>
                  </div>
                  <BranchStepPicker
                    availableSteps={Array.from(stepMap.values()).filter((s) => s.id !== step.id)}
                    selectedIds={step.trueBranch || []}
                    onChange={(ids) => onUpdate({ trueBranch: ids })}
                    accentColor="text-[var(--color-success)]"
                    placeholder="Steps when YES…"
                  />
                </div>
                {/* NO branch */}
                <div className="flex-1 border border-[var(--color-danger)]/30 rounded bg-[rgba(239,68,68,0.03)] p-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ArrowRight size={10} className="text-[var(--color-danger)]" />
                    <span className="text-[9px] font-semibold text-[var(--color-danger)]">NO</span>
                  </div>
                  <BranchStepPicker
                    availableSteps={Array.from(stepMap.values()).filter((s) => s.id !== step.id)}
                    selectedIds={step.falseBranch || []}
                    onChange={(ids) => onUpdate({ falseBranch: ids })}
                    accentColor="text-[var(--color-danger)]"
                    placeholder="Steps when NO…"
                  />
                </div>
              </div>
            </>
          )}

          {/* ── LOOP STEP ───────────────────── */}
          {isLoop && (
            <>
              {/* Loop type selector */}
              <div className="flex gap-1">
                {(["for", "while", "doWhile"] as LoopType[]).map((lt) => (
                  <button
                    key={lt}
                    onClick={() => onUpdate({ loopType: lt })}
                    className={`px-2 py-0.5 rounded text-[9px] font-medium transition-colors border ${
                      (step.loopType || "for") === lt
                        ? "bg-[#f59e0b]/15 border-[#f59e0b] text-[#f59e0b]"
                        : "bg-[var(--color-bg)] border-[var(--color-bd)] text-[var(--color-t3)] hover:border-[var(--color-bdl)]"
                    }`}
                  >
                    {lt === "for" ? "For" : lt === "while" ? "While" : "Do-While"}
                  </button>
                ))}
              </div>

              {/* For loop: max iterations */}
              {(step.loopType || "for") === "for" && (
                <div>
                  <label className="text-[9px] text-[var(--color-t3)] uppercase tracking-wide">Max iterations</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={step.maxIterations ?? 3}
                    onChange={(e) => onUpdate({ maxIterations: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-20 bg-[var(--color-bg)] border border-[var(--color-bd)] rounded px-2 py-1 text-[10px] text-[var(--color-t2)] outline-none focus:border-[var(--color-accent)] ml-2"
                  />
                </div>
              )}

              {/* While/Do-While: condition */}
              {(step.loopType || "for") !== "for" && (
                <div>
                  <label className="text-[9px] text-[var(--color-t3)] uppercase tracking-wide">Condition (yes/no question)</label>
                  <textarea
                    value={step.loopCondition || ""}
                    onChange={(e) => onUpdate({ loopCondition: e.target.value })}
                    placeholder="e.g. 'Are there remaining errors to fix?'"
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-bd)] rounded px-2 py-1.5 text-[11px] text-[var(--color-t1)] resize-y min-h-[30px] outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-t3)] font-sans mt-0.5"
                    rows={1}
                  />
                </div>
              )}

              {/* Loop body steps */}
              <div>
                <label className="text-[9px] text-[var(--color-t3)] uppercase tracking-wide flex items-center gap-1">
                  <Repeat size={9} />
                  Body steps (run each iteration)
                </label>
                <BranchStepPicker
                  availableSteps={Array.from(stepMap.values()).filter((s) => s.id !== step.id)}
                  selectedIds={step.bodySteps || []}
                  onChange={(ids) => onUpdate({ bodySteps: ids })}
                  accentColor="text-[#f59e0b]"
                  placeholder="Select steps to repeat…"
                />
              </div>

              {/* Iteration model info */}
              <div className="text-[8px] text-[var(--color-t3)] italic">
                Uses the step's configured model; falls back to default model for condition checking.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Branch Step Picker (multi-select for decision/loop body) ──

function BranchStepPicker({
  availableSteps,
  selectedIds,
  onChange,
  accentColor,
  placeholder,
}: {
  availableSteps: WorkflowStep[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  accentColor: string;
  placeholder: string;
}) {
  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="flex flex-col gap-0.5 mt-0.5 max-h-[120px] overflow-y-auto">
      {availableSteps.length === 0 && (
        <span className="text-[9px] text-[var(--color-t3)] italic py-1">{placeholder}</span>
      )}
      {availableSteps.map((s) => {
        const selected = selectedIds.includes(s.id);
        const icon = s.stepType === "decision" ? "🔀" : s.stepType === "loop" ? "🔁" : "";
        return (
          <button
            key={s.id}
            onClick={() => toggle(s.id)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] text-left transition-colors border ${
              selected
                ? `${accentColor} border-current/30 bg-current/5`
                : "text-[var(--color-t2)] border-transparent hover:bg-[var(--color-bgh)]"
            }`}
          >
            <span className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 ${
              selected ? accentColor + " border-current" : "border-[var(--color-t3)]"
            }`}>
              {selected && <span className="text-[7px]">✓</span>}
            </span>
            {icon && <span className="text-[9px]">{icon}</span>}
            <ChevronRight size={9} className="text-[var(--color-t3)] flex-shrink-0" />
            <span className="truncate">
              {s.stepType === "prompt" ? (s.prompt?.slice(0, 30) || "(empty prompt)") : s.stepType === "decision" ? `Decision: ${s.condition?.slice(0, 25) || "?"}` : `Loop: ${s.loopType}`}
            </span>
          </button>
        );
      })}
      {selectedIds.length > 0 && (
        <button
          onClick={() => onChange([])}
          className="text-[9px] text-[var(--color-t3)] hover:text-[var(--color-danger)] transition-colors text-left px-2 py-0.5"
        >
          Clear selection
        </button>
      )}
    </div>
  );
}

// ── Execution Plan Builder ──────────────────────────────────

interface ExecStep {
  type: "prompt";
  step: WorkflowStep;
  contextFrom?: string; // step id whose output feeds into this
}

interface ExecDecision {
  type: "decision";
  id: string;
  condition: string;
  decisionModel?: { provider: string; modelId: string };
  yesPath: ExecNode[];
  noPath: ExecNode[];
}

interface ExecLoop {
  type: "loop";
  id: string;
  loopType: LoopType;
  maxIterations?: number;
  condition?: string;
  body: ExecNode[];
}

type ExecNode = ExecStep | ExecDecision | ExecLoop;

interface ExecutionPlan {
  valid: boolean;
  error?: string;
  label: string;
  nodes: ExecNode[];
}

function buildExecutionPlan(steps: WorkflowStep[]): ExecutionPlan {
  const stepMap = new Map<string, WorkflowStep>();
  for (const s of steps) stepMap.set(s.id, s);

  // Find prompts + decisions/loops (flow-control steps wrap sub-steps)
  // Build a linear execution plan by interpreting branches inline

  const visited = new Set<string>();
  const planNodes: ExecNode[] = [];

  function resolveStep(id: string, contextFrom?: string): ExecNode | null {
    const step = stepMap.get(id);
    if (!step) return null;
    if (visited.has(id)) return null; // prevent cycles
    visited.add(id);

    if (step.stepType === "decision") {
      const yesPath: ExecNode[] = [];
      const noPath: ExecNode[] = [];
      for (const yid of step.trueBranch || []) {
        const n = resolveStep(yid, id);
        if (n) yesPath.push(n);
      }
      for (const nid of step.falseBranch || []) {
        const n = resolveStep(nid, id);
        if (n) noPath.push(n);
      }
      return {
        type: "decision",
        id: step.id,
        condition: step.condition || "",
        decisionModel: step.decisionModel,
        yesPath,
        noPath,
      };
    }

    if (step.stepType === "loop") {
      const body: ExecNode[] = [];
      for (const bid of step.bodySteps || []) {
        const n = resolveStep(bid, id);
        if (n) body.push(n);
      }
      // Also include any prompt steps inside the loop's scope (all prompt steps between loop start and next flow-control)
      // For simplicity, bodySteps explicitly lists body items
      return {
        type: "loop",
        id: step.id,
        loopType: step.loopType || "for",
        maxIterations: step.maxIterations,
        condition: step.loopCondition,
        body,
      };
    }

    // Prompt step
    return {
      type: "prompt",
      step,
      contextFrom,
    };
  }

  // Linear pass: iterate steps in order. Flow-control steps consume their children.
  let i = 0;
  while (i < steps.length) {
    const step = steps[i];
    if (visited.has(step.id)) { i++; continue; }

    const node = resolveStep(step.id, i > 0 ? steps[i - 1]?.id : undefined);
    if (node) planNodes.push(node);

    // Skip steps that were consumed as children of flow-control
    if (step.stepType === "decision") {
      // Skip all steps referenced in branches
      const skipIds = new Set<string>([
        ...(step.trueBranch || []),
        ...(step.falseBranch || []),
      ]);
      while (i + 1 < steps.length && skipIds.has(steps[i + 1].id)) {
        i++;
      }
    }
    if (step.stepType === "loop") {
      const skipIds = new Set<string>(step.bodySteps || []);
      while (i + 1 < steps.length && skipIds.has(steps[i + 1].id)) {
        i++;
      }
    }
    i++;
  }

  // Check validity: at least one prompt step (can be inside flow control)
  const hasPrompt = planNodes.some((n) => {
    if (n.type === "prompt") return true;
    if (n.type === "decision") return n.yesPath.some(isPrompt) || n.noPath.some(isPrompt);
    if (n.type === "loop") return n.body.some(isPrompt);
    return false;
  });

  if (!hasPrompt && planNodes.length === 0) {
    return { valid: false, error: "Add at least one prompt step", label: "", nodes: [] };
  }

  const label = planNodes.map((n) => {
    if (n.type === "prompt") return "1→";
    if (n.type === "decision") return "🔀";
    if (n.type === "loop") return `🔁×${n.maxIterations || "?"}`;
    return "?";
  }).join(" · ");

  return { valid: true, label, nodes: planNodes };
}

function isPrompt(n: ExecNode): boolean {
  if (n.type === "prompt") return true;
  if (n.type === "decision") return n.yesPath.some(isPrompt) || n.noPath.some(isPrompt);
  if (n.type === "loop") return n.body.some(isPrompt);
  return false;
}

// ── Execution Engine ────────────────────────────────────────

async function runExecutionPlan(
  workspacePath: string,
  plan: ExecutionPlan,
  addToast: (msg: string, type: "success" | "error" | "warning") => void
) {
  let stepNum = 0;

  for (const node of plan.nodes) {
    const result = await executeNode(workspacePath, node, null, stepNum, addToast);
    if (result === null) break; // error stopped execution
    stepNum++;
  }

  addToast("Workflow complete", "success");
}

async function executeNode(
  workspacePath: string,
  node: ExecNode,
  contextFrom: string | null,
  stepNum: number,
  addToast: (msg: string, type: "success" | "error" | "warning") => void
): Promise<string | null> {
  stepNum++;

  if (node.type === "prompt") {
    return executePromptStep(workspacePath, node.step, contextFrom, stepNum, addToast);
  }

  if (node.type === "decision") {
    return executeDecisionStep(workspacePath, node, contextFrom, stepNum, addToast);
  }

  if (node.type === "loop") {
    return executeLoopStep(workspacePath, node, contextFrom, stepNum, addToast);
  }

  return null;
}

async function executePromptStep(
  workspacePath: string,
  step: WorkflowStep,
  contextFrom: string | null,
  stepNum: number,
  addToast: (msg: string, type: "success" | "error" | "warning") => void
): Promise<string | null> {
  try {
    const fullPrompt = contextFrom
      ? `Previous step output:\n${contextFrom}\n\n---\n\n${step.prompt}`
      : step.prompt;

    const result = await api.createSession(workspacePath, `→${stepNum}: ${step.prompt.slice(0, 30)}`);
    if (step.model) await api.setModel(result.key, step.model.provider, step.model.modelId);

    const state = usePanelStore.getState();
    state.spawnFromPanel(0);
    await new Promise((r) => setTimeout(r, 100));

    const newIdx = usePanelStore.getState().panels.length - 1;
    usePanelStore.setState((s) => ({
      panels: s.panels.map((p, idx) =>
        idx === newIdx ? { ...p, workspacePath, sessionKey: result.key, sessionId: result.sessionId, title: `→${stepNum}`, model: step.model || null, thinking: step.thinking, messages: [{ role: "user", content: fullPrompt, timestamp: new Date().toISOString() }], streaming: true } : p
      ),
    }));
    await api.sendMessage(result.key, fullPrompt);
    await waitForCompletion(result.key);
    const transcript = await api.getTranscript(result.key);
    const last = [...transcript.transcript].reverse().find((m: any) => m.role === "assistant");
    if (last) {
      const div = document.createElement("div");
      div.innerHTML = last.content;
      return (div.textContent || "").trim();
    }
    return null;
  } catch (e: any) {
    addToast(`Step ${stepNum} failed: ${e.message}`, "error");
    return null;
  }
}

async function executeDecisionStep(
  workspacePath: string,
  node: ExecDecision,
  contextFrom: string | null,
  stepNum: number,
  addToast: (msg: string, type: "success" | "error" | "warning") => void
): Promise<string | null> {
  try {
    // Run the condition prompt through the decision model
    const condPrompt = `Answer ONLY "YES" or "NO" — no other text.\n\nQuestion: ${node.condition}\n\nContext:\n${contextFrom || "(no previous context)"}`;

    const result = await api.createSession(workspacePath, `🔀${stepNum}: Decision`);
    if (node.decisionModel) {
      await api.setModel(result.key, node.decisionModel.provider, node.decisionModel.modelId);
    }

    const state = usePanelStore.getState();
    state.spawnFromPanel(0);
    await new Promise((r) => setTimeout(r, 100));

    const newIdx = usePanelStore.getState().panels.length - 1;
    usePanelStore.setState((s) => ({
      panels: s.panels.map((p, idx) =>
        idx === newIdx ? { ...p, workspacePath, sessionKey: result.key, sessionId: result.sessionId, title: `🔀 Decision`, messages: [{ role: "user", content: condPrompt, timestamp: new Date().toISOString() }], streaming: true } : p
      ),
    }));
    await api.sendMessage(result.key, condPrompt);
    await waitForCompletion(result.key);
    const transcript = await api.getTranscript(result.key);
    const last = [...transcript.transcript].reverse().find((m: any) => m.role === "assistant");

    let answer = "NO";
    if (last) {
      const div = document.createElement("div");
      div.innerHTML = last.content;
      const response = (div.textContent || "").trim().toUpperCase();
      // Parse YES or NO from response
      if (response.includes("YES") && !response.includes("NO")) answer = "YES";
      else if (response.includes("NO")) answer = "NO";
      else if (response.startsWith("Y")) answer = "YES";
      else if (response.startsWith("N")) answer = "NO";
    }

    addToast(`Decision: ${answer}`, answer === "YES" ? "success" : "warning");

    // Execute the chosen branch
    const branch = answer === "YES" ? node.yesPath : node.noPath;
    let lastOutput = contextFrom;
    for (const child of branch) {
      const out = await executeNode(workspacePath, child, lastOutput, stepNum, addToast);
      if (out !== null) lastOutput = out;
    }

    return lastOutput;
  } catch (e: any) {
    addToast(`Decision step ${stepNum} failed: ${e.message}`, "error");
    return null;
  }
}

async function executeLoopStep(
  workspacePath: string,
  node: ExecLoop,
  contextFrom: string | null,
  stepNum: number,
  addToast: (msg: string, type: "success" | "error" | "warning") => void
): Promise<string | null> {
  const maxIter = node.loopType === "for" ? (node.maxIterations || 3) : 100;
  let lastOutput = contextFrom;
  let iterCount = 0;

  for (let iter = 0; iter < maxIter; iter++) {
    // While loop: check condition BEFORE each iteration
    if (node.loopType === "while" && node.condition) {
      const shouldContinue = await evaluateLoopCondition(workspacePath, node.condition, lastOutput, stepNum, addToast);
      if (!shouldContinue) {
        addToast(`Loop ended after ${iterCount} iterations (condition false)`, "success");
        break;
      }
    }

    // Do-While: always runs at least once, check AFTER
    iterCount++;

    // Run body steps
    for (const child of node.body) {
      const out = await executeNode(workspacePath, child, lastOutput, stepNum, addToast);
      if (out !== null) lastOutput = out;
    }

    // Do-while: check condition AFTER each iteration
    if (node.loopType === "doWhile" && node.condition) {
      const shouldContinue = await evaluateLoopCondition(workspacePath, node.condition, lastOutput, stepNum, addToast);
      if (!shouldContinue) {
        addToast(`Loop ended after ${iterCount} iterations (condition false)`, "success");
        break;
      }
    }
  }

  if (iterCount >= maxIter && node.loopType !== "for") {
    addToast(`Loop hit max iterations (${maxIter})`, "warning");
  }

  return lastOutput;
}

async function evaluateLoopCondition(
  workspacePath: string,
  condition: string,
  context: string | null,
  _stepNum: number,
  _addToast: (msg: string, type: "success" | "error" | "warning") => void
): Promise<boolean> {
  try {
    const condPrompt = `Answer ONLY "YES" or "NO" — no other text.\n\nQuestion: ${condition}\n\nContext:\n${context || "(no context)"}`;

    const result = await api.createSession(workspacePath, `🔁 Check`);
    const state = usePanelStore.getState();
    state.spawnFromPanel(0);
    await new Promise((r) => setTimeout(r, 100));

    const newIdx = usePanelStore.getState().panels.length - 1;
    usePanelStore.setState((s) => ({
      panels: s.panels.map((p, idx) =>
        idx === newIdx ? { ...p, workspacePath, sessionKey: result.key, sessionId: result.sessionId, title: `🔁 Loop check`, messages: [{ role: "user", content: condPrompt, timestamp: new Date().toISOString() }], streaming: true } : p
      ),
    }));
    await api.sendMessage(result.key, condPrompt);
    await waitForCompletion(result.key);
    const transcript = await api.getTranscript(result.key);
    const last = [...transcript.transcript].reverse().find((m: any) => m.role === "assistant");

    if (last) {
      const div = document.createElement("div");
      div.innerHTML = last.content;
      const response = (div.textContent || "").trim().toUpperCase();
      return response.includes("YES") && !response.includes("NO");
    }
    return false;
  } catch {
    return false;
  }
}

// ── Helpers ──────────────────────────────────────────────────

async function waitForCompletion(key: string): Promise<void> {
  for (let attempt = 0; attempt < 600; attempt++) {
    try {
      const res = await fetch(`/api/session/${encodeURIComponent(key)}/usage`);
      if (!res.ok) break;
    } catch {
      // Session may not be ready yet
    }
    const panel = usePanelStore.getState().panels.find((p) => p.sessionKey === key);
    if (panel && !panel.streaming && panel.messages.length > 0) {
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}
