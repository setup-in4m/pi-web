# Progress

## Status
Complete ✅

## Tasks
- [x] Branch session (fork from message) — ChatView + panelStore
- [x] Agent profiles — profileStore + ProfileSelector + PanelHeader + SettingsDialog

## Files Changed
- `client/src/stores/profileStore.ts` — NEW: AgentProfile interface, profile store with 4 built-in profiles
- `client/src/stores/panelStore.ts` — MODIFIED: Added branchFromMessage method
- `client/src/components/chat/ChatView.tsx` — MODIFIED: Added GitFork branch button on messages
- `client/src/components/panel/ProfileSelector.tsx` — NEW: Dropdown selector for agent profiles
- `client/src/components/panel/PanelHeader.tsx` — MODIFIED: Added ProfileSelector component
- `client/src/components/settings/SettingsDialog.tsx` — MODIFIED: Added "Profiles" tab with add/remove

## Notes
- 4 built-in profiles: Code Reviewer, Architect, Debugger, Speed
- Branch creates new panel + session, replays context messages
- Profiles switch model + thinking in one click
- Custom profiles can be added/removed in Settings
- Build: 133KB JS + 6.9KB CSS gzipped
