# Progress — pi-web v2.0

## Status: Odysseus Clone — Complete 🎯

## Completed

### Odysseus Visual Clone
- [x] Odysseus dark theme (`#282c34` bg, `#e06c75` accent, `#9cdef2` text)
- [x] Fira Code as default body font (monospace UI)
- [x] Fira Code UI font option in settings
- [x] Minimal message bubbles (role dot + label, no colored borders)
- [x] Custom thinking sections (.thinking-section with "View thinking process")
- [x] Thinking block auto-detection (handles <think>, <thinking>, <thought>, <|channel>thought)
- [x] Thinking time display
- [x] Plain-text reasoning detection (prefix-based)
- [x] Code blocks (Odysseus-style .code-block with Run/Edit/Copy toolbar)
- [x] Bare URL autolinking
- [x] Scheme-less domain autolinking
- [x] Entity anchor links (#session-id, #document-id)
- [x] Streaming cursor (blink animation)
- [x] Streaming elapsed timer (positioned top-center)
- [x] Stall detection banner (45s+ shows warning + progress bar)
- [x] Drag-drop image overlay
- [x] Load earlier messages button

### Chat & Composer
- [x] Slash commands: /compact, /clear, /models, /theme, /font, /export, /help
- [x] @-mention popup with file type icons (📄 files, 📁 folders)
- [x] Char counter (>500 chars)
- [x] Mic button placeholder
- [x] Ctrl+K to focus composer
- [x] Send button with accent color
- [x] Shift+Enter for newline hint

### Sidebar
- [x] Remove folder (Trash2 + confirmation)
- [x] Right-click context menu
- [x] Session delete
- [x] Session sort (newest/oldest/A-Z)
- [x] Session search/filter
- [x] Session pin/favorite
- [x] Workspace refresh
- [x] Load more pagination

### Workflows
- [x] Decision steps (if/else with model evaluation)
- [x] Loop steps (for/while/do-while)
- [x] Visual node editor
- [x] Template library

### Settings
- [x] Odysseus theme in theme picker
- [x] Fira Code UI font option
- [x] Export session (MD/HTML/Copy/Gist)

### Quality
- [x] TypeScript: 0 errors
- [x] Client build: 12 chunks, ~155KB gzipped
- [x] Server build: clean
- [x] Tests: 38/38 pass
- [x] Exponential backoff WebSocket reconnect
- [x] Focus trap in settings
- [x] ARIA labels on interactive elements
- [x] Reduced motion support
- [x] Screen reader live region
