import { create } from "zustand";

export interface WorkflowStep {
  id: string;
  model?: { provider: string; modelId: string };
  thinking: string;
  prompt: string;
  isParallel: boolean; // if true, runs concurrently with adjacent parallel steps
}

export type WorkflowMode = "chain" | "parallel";

export interface WorkflowTemplate {
  name: string;
  description: string;
  mode: WorkflowMode;
  steps: (Partial<WorkflowStep> & { prompt: string })[];
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
];

interface WorkflowState {
  open: boolean;
  steps: WorkflowStep[];
  mode: WorkflowMode;

  setOpen: (open: boolean) => void;
  addStep: () => void;
  removeStep: (id: string) => void;
  updateStep: (id: string, updates: Partial<Omit<WorkflowStep, "id">>) => void;
  setMode: (mode: WorkflowMode) => void;
  loadTemplate: (template: WorkflowTemplate) => void;
  clearSteps: () => void;
}

let nextId = 1;

export const useWorkflowStore = create<WorkflowState>((set) => ({
  open: false,
  steps: [
    { id: "1", thinking: "off", prompt: "", isParallel: false },
    { id: "2", thinking: "off", prompt: "", isParallel: false },
  ],
  mode: "chain",

  setOpen: (open) => set({ open }),

  addStep: () =>
    set((s) => ({
      steps: [...s.steps, { id: String(++nextId), thinking: "off", prompt: "", isParallel: false }],
    })),

  removeStep: (id) =>
    set((s) => ({
      steps: s.steps.filter((st) => st.id !== id),
    })),

  updateStep: (id, updates) =>
    set((s) => ({
      steps: s.steps.map((st) => (st.id === id ? { ...st, ...updates } : st)),
    })),

  setMode: (mode) => set({ mode }),

  loadTemplate: (template) => {
    set({
      steps: template.steps.map((s) => ({
        ...s,
        id: String(++nextId),
        isParallel: s.isParallel ?? (template.mode === "parallel"),
        thinking: s.thinking || "off",
      })),
      mode: template.mode,
    });
  },

  clearSteps: () =>
    set({
      steps: [{ id: String(++nextId), thinking: "off", prompt: "", isParallel: false }],
    }),
}));
