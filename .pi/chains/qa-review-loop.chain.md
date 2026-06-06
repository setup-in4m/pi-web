---
name: qa-review-loop
description: Full QA pipeline — generates feature test spec from codebase, runs browser + visual QA on every feature, applies fixes, iterates 3 rounds
---

## qa-spec-gen
output: qa-spec.md

Read PLAN.md, progress.md, and the full pi-web codebase (client/src, server/src, tauri/). Generate a comprehensive QA specification organized by feature with test steps, expected behavior, visual acceptance criteria, and pass/fail criteria. Cover ALL features: tool rendering (read/write/edit/bash/grep/find/ls cards, inline images, thinking tokens, pin messages), model UX (searchable selector, model cards, token counter, cost summary, compaction), Tauri native (system tray, global shortcuts, window management, build pipeline), settings/export/extensions, and polish (performance, accessibility, error handling, testing). Save complete spec to qa-spec.md.

## qa-tester
reads: qa-spec.md

Start pi-web with `npm run dev`. Using agentx-browser tools, systematically test every feature from the QA spec. For each feature: navigate → snapshot → interact → screenshot → run ui_examine on screenshot with feature context → check console/errors/network → record pass/fail. Start browser_qa_record before testing, stop with mp4 after. Produce a structured findings report with severity ratings, evidence paths, repro steps, and fix recommendations for every failure.

## worker

Read the QA findings from {previous}. Fix all 🔴Critical and 🟠Major issues in the pi-web codebase. Implement the smallest correct change for each. Follow existing code patterns. Run any available tests (npm run lint, npm run build, etc). Report: what was fixed, what was deferred and why, changed files, validation results.

## qa-tester
reads: qa-spec.md

Re-test pi-web after fixes. Start the app, verify all previously failing features now pass. Focus regression testing on areas that were modified. Screenshot every feature and run ui_examine for visual quality. Check console/errors/network. Produce updated findings report — mark resolved issues and any new regressions.

## worker

Read QA findings from {previous}. Fix remaining Critical and Major issues. Report fixes, deferrals, changed files, and validation.

## qa-tester
reads: qa-spec.md

Final verification pass. Test ALL features end-to-end. Confirm zero regressions. Run ui_examine on every screen. Check console/errors/network for any remaining issues. Produce final report with: pass/fail summary per stream, overall release readiness score (✅ Ready / ⚠️ Almost Ready / 🔧 Needs Work), list of deferred issues with reasons, and artifact paths (video, screenshots, spec).
