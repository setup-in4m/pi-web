import { create } from "zustand";

export interface WorkflowStep {
  id: string;
  model?: { provider: string; modelId: string };
  thinking: string;
  prompt: string;
}

export type WorkflowMode = "chain" | "parallel";

export interface WorkflowTemplate {
  name: string;
  description: string;
  mode: WorkflowMode;
  steps: Omit<WorkflowStep, "id">[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    name: "Code Review",
    description: "Review code for bugs, style, and improvements",
    mode: "chain",
    steps: [
      { thinking: "low", prompt: "Review this code for potential bugs and security issues." },
      { thinking: "low", prompt: "Suggest improvements for code style, readability, and performance." },
      { thinking: "medium", prompt: "Generate a summary report with the top 3 most critical issues and their fixes." },
    ],
  },
  {
    name: "Refactor",
    description: "Multi-pass refactoring pipeline",
    mode: "chain",
    steps: [
      { thinking: "medium", prompt: "Analyze the code and identify refactoring opportunities." },
      { thinking: "medium", prompt: "Apply the refactoring changes. Show before/after for each change." },
      { thinking: "low", prompt: "Write tests for the refactored code to ensure behavior is preserved." },
    ],
  },
  {
    name: "Test Generator",
    description: "Generate unit tests from source code",
    mode: "chain",
    steps: [
      { thinking: "low", prompt: "Identify all public functions and methods that need tests." },
      { thinking: "low", prompt: "Generate comprehensive unit tests with edge cases for each function." },
    ],
  },
  {
    name: "Compare Models",
    description: "Run same prompt on 2 models side-by-side",
    mode: "parallel",
    steps: [
      { thinking: "off", prompt: "Solve this problem and explain your reasoning." },
      { thinking: "off", prompt: "Solve this problem and explain your reasoning." },
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
    { id: "1", thinking: "off", prompt: "" },
    { id: "2", thinking: "off", prompt: "" },
  ],
  mode: "chain",

  setOpen: (open) => set({ open }),

  addStep: () =>
    set((s) => ({
      steps: [...s.steps, { id: String(++nextId), thinking: "off", prompt: "" }],
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
      steps: template.steps.map((s) => ({ ...s, id: String(++nextId) })),
      mode: template.mode,
    });
  },

  clearSteps: () =>
    set({
      steps: [{ id: String(++nextId), thinking: "off", prompt: "" }],
    }),
}));
