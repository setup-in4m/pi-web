import { create } from "zustand";

export type StepType = "prompt" | "decision" | "loop";
export type LoopType = "for" | "while" | "doWhile";

export interface WorkflowStep {
  id: string;
  stepType: StepType;
  // ── Prompt fields ──────────────────────────
  model?: { provider: string; modelId: string };
  thinking: string;
  prompt: string;
  isParallel: boolean; // if true, runs concurrently with adjacent parallel steps
  // ── Decision fields ────────────────────────
  condition?: string;                                    // prompt asking model for YES/NO
  decisionModel?: { provider: string; modelId: string }; // model to make decision
  trueBranch?: string[];   // step IDs to run on YES
  falseBranch?: string[];  // step IDs to run on NO
  // ── Loop fields ────────────────────────────
  loopType?: LoopType;
  maxIterations?: number;  // for "for" loops
  loopCondition?: string;  // for "while" / "doWhile" — evaluated by model
  bodySteps?: string[];    // step IDs inside the loop body
}

export type WorkflowMode = "chain" | "parallel";

export interface WorkflowTemplate {
  name: string;
  description: string;
  mode: WorkflowMode;
  steps: (Partial<WorkflowStep> & { prompt?: string })[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    name: "Code Review",
    description: "Review code for bugs, style, and improvements",
    mode: "chain",
    steps: [
      { thinking: "low", prompt: "Review this code for potential bugs and security issues.", isParallel: false },
      { thinking: "low", prompt: "Suggest improvements for code style, readability, and performance.", isParallel: false },
      { thinking: "medium", prompt: "Generate a summary report with the top 3 most critical issues and their fixes.", isParallel: false },
    ],
  },
  {
    name: "Refactor",
    description: "Multi-pass refactoring pipeline",
    mode: "chain",
    steps: [
      { thinking: "medium", prompt: "Analyze the code and identify refactoring opportunities.", isParallel: false },
      { thinking: "medium", prompt: "Apply the refactoring changes. Show before/after for each change.", isParallel: false },
      { thinking: "low", prompt: "Write tests for the refactored code to ensure behavior is preserved.", isParallel: false },
    ],
  },
  {
    name: "Plan + Review",
    description: "Plan then parallel review, then implement",
    mode: "chain",
    steps: [
      { thinking: "high", prompt: "Create a detailed implementation plan.", isParallel: false },
      { thinking: "medium", prompt: "Review the plan for risks and missing details.", isParallel: true },
      { thinking: "medium", prompt: "Review the plan from a security perspective.", isParallel: true },
      { thinking: "medium", prompt: "Implement the plan step by step.", isParallel: false },
      { thinking: "low", prompt: "Review the implementation for bugs.", isParallel: true },
      { thinking: "low", prompt: "Review the implementation for style and performance.", isParallel: true },
    ],
  },
  {
    name: "Test Generator",
    description: "Generate unit tests from source code",
    mode: "chain",
    steps: [
      { thinking: "low", prompt: "Identify all public functions and methods that need tests.", isParallel: false },
      { thinking: "low", prompt: "Generate comprehensive unit tests with edge cases for each function.", isParallel: false },
    ],
  },
  {
    name: "Compare Models",
    description: "Run same prompt on 2 models side-by-side",
    mode: "parallel",
    steps: [
      { thinking: "off", prompt: "Solve this problem and explain your reasoning.", isParallel: true },
      { thinking: "off", prompt: "Solve this problem and explain your reasoning.", isParallel: true },
    ],
  },
  {
    name: "Audit + Fix Loops",
    description: "Audit code, fix issues in a loop until clean",
    mode: "chain",
    steps: [
      { thinking: "medium", prompt: "Audit this code for bugs, security issues, and style problems. List each issue found.", isParallel: false },
      { stepType: "decision" as const, condition: "Are there any remaining issues to fix? Answer YES or NO.", isParallel: false },
      { stepType: "loop" as const, loopType: "while" as const, loopCondition: "Are there remaining issues? Answer YES or NO.", maxIterations: 5, isParallel: false },
      { thinking: "medium", prompt: "Fix the highest-priority issue identified. Show before/after diff.", isParallel: false },
      { thinking: "low", prompt: "Re-audit the code after the fix. List any remaining issues.", isParallel: false },
    ],
  },
];

interface WorkflowState {
  open: boolean;
  steps: WorkflowStep[];
  mode: WorkflowMode;

  setOpen: (open: boolean) => void;
  addStep: (type?: StepType) => void;
  removeStep: (id: string) => void;
  updateStep: (id: string, updates: Partial<Omit<WorkflowStep, "id">>) => void;
  setMode: (mode: WorkflowMode) => void;
  loadTemplate: (template: WorkflowTemplate) => void;
  clearSteps: () => void;
  reorderSteps: (fromIndex: number, toIndex: number) => void;
}

let nextId = 1;

function createDefaultStep(type: StepType = "prompt"): Omit<WorkflowStep, "id"> {
  const base = { thinking: "off", prompt: "", isParallel: false };
  if (type === "decision") {
    return { ...base, stepType: "decision", condition: "", trueBranch: [], falseBranch: [] };
  }
  if (type === "loop") {
    return { ...base, stepType: "loop", loopType: "for", maxIterations: 3, bodySteps: [], loopCondition: "" };
  }
  return { ...base, stepType: "prompt" };
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  open: false,
  steps: [
    { id: "1", stepType: "prompt", thinking: "off", prompt: "", isParallel: false },
    { id: "2", stepType: "prompt", thinking: "off", prompt: "", isParallel: false },
  ],
  mode: "chain",

  setOpen: (open) => set({ open }),

  addStep: (type: StepType = "prompt") =>
    set((s) => ({
      steps: [...s.steps, { id: String(++nextId), ...createDefaultStep(type) }],
    })),

  removeStep: (id) =>
    set((s) => {
      // Also clean up references from decision/loop branches pointing to this step
      const cleaned = s.steps.map((st) => {
        if (st.stepType === "decision") {
          return {
            ...st,
            trueBranch: (st.trueBranch || []).filter((bid) => bid !== id),
            falseBranch: (st.falseBranch || []).filter((bid) => bid !== id),
          };
        }
        if (st.stepType === "loop") {
          return {
            ...st,
            bodySteps: (st.bodySteps || []).filter((bid) => bid !== id),
          };
        }
        return st;
      });
      return { steps: cleaned.filter((st) => st.id !== id) };
    }),

  updateStep: (id, updates) =>
    set((s) => ({
      steps: s.steps.map((st) => (st.id === id ? { ...st, ...updates } : st)),
    })),

  setMode: (mode) => set({ mode }),

  loadTemplate: (template) => {
    set({
      steps: template.steps.map((s) => ({
        stepType: (s.stepType as StepType) || "prompt",
        id: String(++nextId),
        isParallel: s.isParallel ?? (template.mode === "parallel"),
        thinking: s.thinking || "off",
        prompt: s.prompt || "",
        condition: s.condition,
        decisionModel: s.decisionModel,
        trueBranch: s.trueBranch,
        falseBranch: s.falseBranch,
        loopType: s.loopType as LoopType | undefined,
        loopCondition: s.loopCondition,
        maxIterations: s.maxIterations,
        bodySteps: s.bodySteps,
        model: s.model,
      })),
      mode: template.mode,
    });
  },

  clearSteps: () =>
    set({
      steps: [{ id: String(++nextId), stepType: "prompt", thinking: "off", prompt: "", isParallel: false }],
    }),

  reorderSteps: (fromIndex, toIndex) =>
    set((s) => {
      const steps = [...s.steps];
      const [moved] = steps.splice(fromIndex, 1);
      steps.splice(toIndex, 0, moved);
      return { steps };
    }),
}));
