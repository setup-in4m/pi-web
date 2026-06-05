# Progress

## Status
In Progress — Implementing workflow control flow, sidebar enhancements, rendering quality, visual UX

## Completed Tasks

### Workflow Control Flow (Subagent 5)
- [x] Decision step type with YES/NO branching
- [x] Loop step type (for, while, do-while)
- [x] Visual decision/loop nodes in WorkflowBuilder
- [x] Branch step picker for decision/loop body
- [x] Execution engine with decision routing and loop iteration
- [x] Template: "Audit + Fix Loops" with decision + while loop
- [x] Step reordering (move up/down)
- [x] TypeScript compiles clean

## Files Changed
- `client/src/stores/workflowStore.ts` — Added stepType, decision/loop fields, addStep(type), reorderSteps
- `client/src/components/workflow/WorkflowBuilder.tsx` — Full rewrite with StepEditor, BranchStepPicker, ExecutionPlan builder, decision/loop execution engine

## Notes
- Decision steps use a model to evaluate YES/NO conditions
- Loop steps support for/while/do-while with configurable max iterations
- Branch steps reference other step IDs and are executed inline during plan execution
- Context flows through branches via `contextFrom` parameter
