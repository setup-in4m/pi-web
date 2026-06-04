# Implementation Plan — pi-web Remaining Items

## Current State
Client builds (133KB JS gzipped). Server compiles. Tauri scaffold exists. Core chat, multi-panel, sub-agents, agent profiles, theming, virtual scroll, layout presets all functional.

## 5 Parallel Work Streams

---

## Stream 1: Rich Tool Rendering & Content

### 1.1 — Tool Card Enhancements
**File:** `client/src/lib/tools.ts`
- Replace current `renderToolBody()` with type-specific renderers
- **Read tool:** Show file path, rendered content with line numbers (`<table>` with line-number column)
- **Write tool:** Show file path, unified diff view (add `diff` library or simple +/- prefix rendering)
- **Edit tool:** Show unified diff view (same renderer as write)
- **Bash tool:** Show command, exit code badge (green/red), stdout, stderr in separate blocks
- **Grep/Find tool:** Results table with file:line:match columns
- **Ls tool:** File tree with directories first, indent levels, file/dir icons
- **Add:** Tool execution time display (pass `durationMs` from server events, show in tool card summary)

### 1.2 — Inline Images
**File:** `client/src/lib/markdown.ts`
- Add `image()` renderer to marked custom renderer
- Render `<img>` tags with max-width, border-radius, click-to-enlarge

### 1.3 — Thinking Token Count
**File:** `client/src/components/panel/TokenBar.tsx`
- Accept `thinkingTokens` prop
- Show split: "think:42K · out:128K" when both present
**File:** `server/src/ws/handler.ts` (already broadcasts thinking_delta)
- Track thinking char count per session, include in usage estimate
**File:** `client/src/stores/panelStore.ts`
- Add `thinkingTokens` field to PanelData
- Count thinking characters, estimate tokens (chars/4)

### 1.4 — Pin Message
**File:** `client/src/stores/panelStore.ts`
- Add `pinnedIndices: Set<number>` to PanelData
- Add `pinMessage(panelIdx, msgIdx)` / `unpinMessage(panelIdx, msgIdx)` actions
**File:** `client/src/components/chat/ChatView.tsx`
- Render pinned messages at top of chat in sticky container
- Add pin/unpin button to message action bar (existing group-hover row)
- Pin icon in action bar for all message roles

### Acceptance
- Tool cards render type-specific output (line numbers, diffs, tables, file tree)
- Images appear inline in assistant messages
- Thinking blocks show token count
- Pinned messages stick to top of chat, can be unpinned

---

## Stream 2: Advanced Model & Token UX

### 2.1 — Searchable Model Selector
**File:** `client/src/components/panel/ModelSelector.tsx` (NEW)
- Replace `<select>` in PanelHeader with custom dropdown
- Search input at top, fuzzy-match model names
- Group by provider with provider headers
- Show context window, cost/token, thinking support on each row
- "Recently used" section at top (persist last 5 in localStorage)

**File:** `client/src/stores/modelStore.ts`
- Add `recentModels: string[]` (providerId/modelId pairs)
- Add `addRecentModel(providerId, modelId)` action
- Persist to localStorage

**File:** `client/src/components/panel/PanelHeader.tsx`
- Replace `<select>` with `<ModelSelector />`

### 2.2 — Model Cards with Details
**File:** `client/src/components/panel/ModelSelector.tsx`
- Each model row shows:
  - Display name (bold)
  - Provider badge (small, muted)
  - Context window (e.g., "128K")
  - Cost per 1M tokens (input/output)
  - "recommended" star badge on models like claude-sonnet-4-20250514, gpt-4o
- Add `isRecommended(modelId, providerId)` helper (hardcoded list)

### 2.3 — Real-time Token Counter
**File:** `client/src/stores/panelStore.ts`
- Add `inputTokens: number`, `outputTokens: number` to PanelData
- Update from WebSocket `agent_end` event's `usage` field (already received)
- Track streaming estimate in `streamingOutputTokens` (already exists)

### 2.4 — Session Cost & Token Summary
**File:** `client/src/components/sidebar/Sidebar.tsx`
- For each session in workspace tree, show cost estimate if available
- Show token count next to session title (small, muted)
- Derive from stored usage data

**File:** `client/src/stores/workspaceStore.ts`
- Add `refreshAllUsage()` action that calls `GET /api/session/:key/usage` for loaded sessions

**File:** `server/src/routes/workspace.ts`
- `GET /api/workspace/:enc` already returns data; enhance to include per-session usage if sessions are loaded

### 2.5 — Context Compaction
**File:** `client/src/components/panel/TokenBar.tsx`
- When danger threshold hit (90%), show "Compact" button next to warning
- Click calls `POST /api/session/:key/compact`

**File:** `server/src/routes/workspace.ts`
- Add `POST /api/session/:key/compact` route
- Calls `session.compactContext()` if available on pi SDK session
- Returns compaction summary (tokens removed, tokens remaining)

**File:** `client/src/stores/panelStore.ts`
- Handle `compaction_done` WebSocket event (or direct API response)
- Append compaction summary message to transcript

### Acceptance
- Model dropdown searchable, shows details, has recent section
- Token bar shows live input/output counts during streaming
- Session sidebar shows cost estimates
- Compaction button appears at 90%, triggers compaction, shows summary

---

## Stream 3: Tauri Native Features

### 3.1 — System Tray
**File:** `tauri/src/lib.rs`
- Add system tray with `tauri::tray::TrayIconBuilder`
- Menu items: Show/Hide, New Session, Quit
- Close-to-tray behavior (configurable via settings, default off)

**File:** `tauri/tauri.conf.json`
- Add `trayIcon` config

**File:** `tauri/icons/` — ensure tray icon exists (32x32 PNG)

### 3.2 — Global Shortcuts
**File:** `tauri/src/lib.rs`
- Register `Ctrl+Shift+Space` → toggle window visibility
- Register `Ctrl+Shift+N` → emit event to frontend to create new panel

**File:** `client/src/lib/tauri.ts`
- Listen for `new-session` Tauri event
- Trigger `usePanelStore.getState().addPanel()`

### 3.3 — Window Management
**File:** `tauri/src/lib.rs`
- Save/restore window position and size (use `tauri-plugin-window-state` or manual localStorage)
- Single instance lock using `tauri-plugin-single-instance`
- Custom titlebar toggle (send window controls to frontend)

**File:** `client/src/components/layout/AppShell.tsx`
- Add optional custom titlebar (drag region, min/max/close buttons)
- Controlled by `useLayoutStore` setting

### 3.4 — Build Pipeline
**File:** `tauri/tauri.conf.json`
- Configure bundle targets: msi (Windows), dmg (macOS), deb/AppImage (Linux)
- Set app identifier, publisher, copyright

**File:** `tauri/Cargo.toml`
- Ensure all plugins are properly included

**File:** `package.json`
- Add `build:tauri` script: `npm run build && cargo tauri build`

### Acceptance
- Tray icon appears, right-click shows menu, close minimizes to tray
- Ctrl+Shift+Space toggles window globally
- Window position/size persists across restarts
- `npm run build:tauri` produces installable package

---

## Stream 4: Settings, Export & Extensions

### 4.1 — Settings → Models Tab
**File:** `client/src/components/settings/SettingsDialog.tsx`
- Replace stub text with actual UI
- List providers and models from `useModelStore`
- Show model details (context window, cost, thinking support)
- Set default model per workspace (dropdown)
- Set API key hint: "Configure in pi CLI"

### 4.2 — Settings → Keybindings Tab
**File:** `client/src/components/settings/SettingsDialog.tsx`
- Replace static list with editable keybinding table
- Each row: action name, current shortcut, edit button
- Edit mode: capture next keypress, validate no conflicts
- Save to localStorage, load on startup

**File:** `client/src/stores/settingsStore.ts` (NEW)
- `keybindings: Record<string, string>` (action → shortcut)
- `setKeybinding(action, shortcut)`, `resetKeybindings()`
- Persist to localStorage

**File:** `client/src/hooks/useKeyboard.ts`
- Read keybindings from `settingsStore` instead of hardcoded

### 4.3 — Settings → Data Tab
**File:** `client/src/components/settings/SettingsDialog.tsx`
- Export all sessions (calls `GET /api/export/all`)
- Clear all data (calls `DELETE /api/data`)
- Backup/restore (download JSON, upload JSON)
- Show storage estimates

**File:** `server/src/routes/data.ts` (NEW)
- `GET /api/export/all` — bundle all sessions as JSON
- `DELETE /api/data` — clear store

### 4.4 — Export Formats
**File:** `server/src/routes/workspace.ts`
- Enhance `GET /api/session/:key/export` to support format param:
  - `?format=md` (existing)
  - `?format=html` — render as standalone HTML page with CSS
  - `?format=pdf` — generate PDF (use `html-pdf` or similar)
- `GET /api/session/:key/copy` — return plain text transcript

**File:** `client/src/components/panel/PanelHeader.tsx`
- Add export dropdown button (MD, HTML, PDF, Copy, Gist)

### 4.5 — Share via Gist
**File:** `server/src/routes/gist.ts` (NEW)
- `POST /api/session/:key/gist` — create GitHub Gist from transcript
- Requires GitHub token from settings

### 4.6 — Extension Manager
**File:** `client/src/components/settings/ExtensionManager.tsx` (NEW)
- List installed extensions from pi SDK
- Enable/disable per workspace
- Install from path or URL
- Extension config panel

**File:** `server/src/routes/extensions.ts` (NEW)
- `GET /api/extensions` — list installed
- `POST /api/extensions/install` — install from path
- `POST /api/extensions/:id/toggle` — enable/disable

### Acceptance
- Settings models tab shows actual model data
- Keybindings editable, persist, take effect
- Data tab can export/clear all
- Session can export to MD, HTML, clipboard
- Gist sharing works with GitHub token
- Extension list visible, toggle works

---

## Stream 5: Polish & Testing

### 5.1 — Performance
**File:** `client/src/lib/markdown.ts`
- Memoize `renderMarkdown` per content string (use LRU cache, max 200 entries)

**File:** `client/src/components/sidebar/Sidebar.tsx`
- Lazy-load workspace sessions on expand (fetch only when expanded)
- Show placeholder count, fetch on first expand

**File:** `client/src/components/panel/ModelSelector.tsx`
- Debounce search input (200ms)

**File:** `client/src/App.tsx`
- Code-split: `React.lazy(() => import("./components/settings/SettingsDialog"))`
- Code-split: `React.lazy(() => import("./components/CommandPalette"))`

**File:** `client/vite.config.ts`
- Enable manual chunks: vendor (react, zustand, lucide), marked+highlight, allotment+virtual
- Set `build.rollupOptions.output.manualChunks`

### 5.2 — Accessibility
**File:** `client/src/components/chat/ChatView.tsx`
- Add `aria-live="polite"` region for streaming messages
- Announce new messages via invisible live region

**File:** `client/src/components/settings/SettingsDialog.tsx`
- Focus trap: on open, focus first input; Tab/Esc trap inside modal
- `aria-modal="true"`, `role="dialog"`

**File:** `client/src/components/layout/AppShell.tsx`
- Add skip-to-content link (first focusable element)

**File:** `client/src/index.css`
- Add `@media (prefers-reduced-motion: reduce)` rules
- Disable animations, transitions, pulse effects

**File:** Multiple components
- Audit all interactive elements for ARIA labels (buttons, inputs, selects)
- Ensure all images/icons have `aria-hidden="true"` or alt text
- Tab order is logical

### 5.3 — Error Handling
**File:** `client/src/lib/ws.ts`
- Add exponential backoff to reconnect (2s, 4s, 8s, 16s, max 30s)

**File:** `client/src/stores/panelStore.ts`
- On WebSocket reconnect, reload active session transcripts
- Auto-reopen last active session on reconnect

**File:** `client/src/components/ErrorBoundary.tsx`
- Show "session crashed" recovery UI with "reopen" button
- Log errors to console with session context

**File:** `server/src/routes/workspace.ts`
- Add proper error messages for disk full, permission denied
- Return structured errors: `{ error: string, code: "DISK_FULL" | "PERMISSION" | "NOT_FOUND" }`

### 5.4 — Testing
**File:** `client/src/__tests__/` (NEW directory)
- `stores/panelStore.test.ts` — test addPanel, removePanel, sendMessage, branch
- `stores/themeStore.test.ts` — test mode switching, accent, persistence
- `lib/tokens.test.ts` — test token formatting, cost calc
- `lib/markdown.test.ts` — test code highlighting, link rendering
- `components/MessageBubble.test.tsx` — test user/assistant rendering
- `components/Composer.test.tsx` — test Enter/Shift+Enter, empty submit
- `components/ToolCard.test.tsx` — test each tool type rendering

**File:** `client/package.json`
- Add `vitest`, `@testing-library/react`, `jsdom` dev deps
- Add `"test": "vitest run"` script

**File:** `server/src/__tests__/` (NEW directory)
- `store.test.ts` — test CRUD operations on JSON store
- `sessionStore.test.ts` — test session lifecycle (may need mock pi SDK)

### Acceptance
- Client bundle under 500KB gzipped
- All interactive elements keyboard-navigable
- Screen reader announces new messages
- Exponential backoff works on disconnect
- Error boundary shows recovery UI
- 10+ unit/component tests pass
