# Progress

## Status
Nearly Complete — 6 items remain

## Completed Tasks

### Phase 2 — Layout Engine
- [x] Tab context menu: close, close others, close all
- [x] Layout presets: single, 2H, 2V, 2x2, 3col

### Phase 3 — Rich Content
- [x] Tool cards with emoji icons, running indicator, collapsible results
- [x] Tool execution time display
- [x] Copy message to clipboard
- [x] Edit & resend user messages
- [x] Branch from message (fork session)
- [x] Scroll-to-bottom button

### Phase 4 — Model & Token UX
- [x] Searchable model selector (ModelSelector.tsx) with provider grouping
- [x] Recently used models at top
- [x] Recommended badges on popular models
- [x] Model cost indicators
- [x] Context window display
- [x] Token bar with context % and streaming estimates
- [x] Context warning (70%) and danger (90%) indicators

### Phase 6 — Orchestration
- [x] Sub-agent spawning from message content
- [x] Sub-agent cards: running, done states with usage
- [x] Agent profiles: built-in + custom via Settings
- [x] Branch from message (creates new panel + replays context)

### Phase 7 — Settings & Themes
- [x] Settings dialog: Appearance, Models, Shortcuts, Profiles, Data, Extensions tabs
- [x] Models tab: list models grouped by provider, show context window & cost
- [x] Shortcuts tab: editable keybindings with conflict detection, reset to defaults
- [x] Custom keybinding store (settingsStore.ts) — persists to localStorage
- [x] Dynamic keyboard shortcut resolution in useKeyboard.ts
- [x] Data tab: Export all sessions as JSON, Clear all data with confirmation
- [x] Extensions tab: list installed, install from path, toggle enable/disable
- [x] PanelHeader export dropdown: Markdown, HTML, Copy transcript
- [x] Server: HTML export format for sessions (standalone page with dark theme)
- [x] Server: Plain text transcript copy endpoint
- [x] Server: Export all data endpoint
- [x] Server: Extension management endpoints

### Phase 8 — Polish
- [x] Virtualized message list (react-virtual)

## Remaining Tasks

### Phase 3 — Rich Content
- [x] Images rendered inline
- [ ] Math rendering (KaTeX)
- [x] Tool result rendering: line numbers for read, diff views for write/edit
- [x] Thinking token count vs visible output
- [x] Think level indicator
- [x] Pin message to top

### Phase 4 — Model & Token UX
- [ ] Per-message token breakdown on hover
- [x] Session cost summary in sidebar
- [x] Global token usage stats
- [x] Manual compaction trigger

### Phase 5 — Tauri Native
- [x] System tray with menu (Show/Hide, New Session, Quit)
- [x] Global shortcuts (Ctrl+Shift+Space, Ctrl+Shift+N)
- [x] Window position/size persistence
- [x] Single instance lock
- [x] Custom titlebar toggle (min/max/close buttons in AppShell)
- [x] Folder drag-drop onto window
- [x] Build/distribution configuration (bundle targets, scripts)
- [x] Tauri event bridge (listenForTauriEvent, window control functions)

### Phase 6 — Orchestration
- [ ] Visual parent→child relationship tree in sidebar
- [ ] Workflow builder (React Flow)

### Phase 7 — Settings & Themes
- [ ] Font family selector
- [ ] Code theme toggle (independent of UI theme)
- [x] Share via GitHub Gist

### Phase 8 — Polish & Testing
- [x] Lazy-load sidebar (sessions fetched on expand)
- [x] Code-split settings/workflow (React.lazy + Suspense + manualChunks)
- [x] Memoized markdown rendering (LRU cache, max 200 entries)
- [x] Bundle size audit (~156KB gzipped across 12 chunks)
- [x] Skip-to-content link in AppShell
- [x] Focus trap in SettingsDialog (Tab wraps, aria-modal, role=dialog)
- [x] Screen reader live region for streaming messages
- [x] ARIA labels on all icon-only buttons (aria-label + aria-hidden)
- [x] Reduced motion media query (all animations/transitions disable)
- [x] Exponential backoff WebSocket reconnect (1s→30s, ±20% jitter)
- [x] Panel transcript re-fetch on WS reconnect
- [x] ErrorBoundary recovery UI (Dismiss, Reopen session, Reload panel)
- [x] Structured server errors ({error, code: DISK_FULL|PERMISSION|NOT_FOUND})
- [x] 38 unit tests passing (panelStore, markdown, tools)
- [x] Vitest config + jsdom setup (localStorage, matchMedia mocks)

## Files Changed
- `client/src/stores/settingsStore.ts` — NEW: editable keybindings with defaults, persistence
- `client/src/components/settings/SettingsDialog.tsx` — Models tab, editable keybindings, Data tab, Extensions tab, focus trap
- `client/src/components/settings/ExtensionManager.tsx` — NEW: list/install/toggle extensions
- `client/src/hooks/useKeyboard.ts` — Dynamic shortcut resolution via settingsStore
- `client/src/components/panel/PanelHeader.tsx` — Export dropdown (Markdown, HTML, Copy)
- `client/src/components/panel/ModelSelector.tsx` — NEW: searchable model selector with recents
- `client/src/stores/modelStore.ts` — Added recentModels tracking
- `client/src/stores/panelStore.ts` — Branch, sub-agent, tool timing, WS reconnect recovery
- `client/src/components/chat/ChatView.tsx` — Copy/edit/resend/branch/sub-agent, aria-live, aria-labels
- `client/src/components/panel/TokenBar.tsx` — Session-level compaction trigger
- `client/src/lib/tools.ts` — Tool duration, richer tool cards
- `client/src/lib/api.ts` — New endpoints for data, extensions
- `client/src/lib/markdown.ts` — LRU memoization cache (200 entries)
- `client/src/lib/ws.ts` — Exponential backoff reconnect with jitter
- `client/src/App.tsx` — React.lazy code-splitting for SettingsDialog, CommandPalette
- `client/src/components/layout/AppShell.tsx` — Skip-to-content, Suspense, custom titlebar merge
- `client/src/components/ErrorBoundary.tsx` — Recovery UI (Dismiss, Reopen, Reload)
- `client/src/index.css` — sr-only utility, enhanced reduced-motion, scrollbar tweaks
- `client/vite.config.ts` — manualChunks (vendor, editor, layout, icons)
- `client/vitest.config.ts` — NEW: vitest config with jsdom + setup
- `client/vitest.setup.ts` — NEW: localStorage + matchMedia mocks
- `client/src/__tests__/stores/panelStore.test.ts` — NEW: 10 tests
- `client/src/__tests__/lib/markdown.test.ts` — NEW: 15 tests
- `client/src/__tests__/lib/tokens.test.ts` — NEW: 13 tests
- `client/package.json` — Added vitest + testing deps, test scripts
- `server/src/routes/data.ts` — NEW: export all, clear data, copy transcript
- `server/src/routes/extensions.ts` — NEW: list/install/toggle extensions
- `server/src/routes/workspace.ts` — HTML export, structured error codes
- `server/src/index.ts` — Registered data + extension routes
- `server/src/services/sessionStore.ts` — Sub-agent spawning with event forwarding
- `tauri/src/lib.rs` — System tray, window bounds persistence, single instance, titlebar toggle commands
- `tauri/Cargo.toml` — Added tray-icon feature
- `tauri/tauri.conf.json` — Bundle targets, tray config, publisher/copyright
- `client/src/lib/tauri.ts` — Expanded: event listener, window controls, decorations toggle
- `client/src/components/layout/AppShell.tsx` — Custom titlebar with drag region, min/max/close

## Build
- Client: 12 chunks, ~156KB gzipped total (vendor 57K, editor 34K, index 23K, layout 17K)
- Server: TypeScript compiles clean
- Tests: 38 passed, 0 failed
