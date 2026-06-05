# CSS + Theme + Typography Overhaul — Complete

## Changes Made

### 1. Odysseus Theme Mode
- Added `"odysseus"` to `ThemeMode` type
- Added full CSS block `[data-theme="odysseus"]` with all color vars:
  - Background: `#282c34` (soft dark, matches Odysseus)
  - Text: `#abb2bf`
  - Accent: `#e06c75` (red-pink, matches Odysseus)
  - Success: `#98c379`, Warning: `#d19a66`
- Added Odysseus entry to Settings theme picker

### 2. Fira Code UI Font (Monospace Body)
- Added `"fira-code-ui"` to `UIFontFamily` type
- Added `"fira-code-ui"` to `GOOGLE_FONTS` map with weights 300-700
- Added `"fira-code-ui"` to `UI_FONT_MAP`: Fira Code + monospace fallbacks
- Changed DEFAULT `uiFontFamily` to `"fira-code-ui"` (was "system")
- Changed DEFAULT `fontFamily` to `"fira-code"` (was "system")
- Pi-web now looks like a developer tool (monospace UI) out of the box

### 3. Code Block Styles (Odysseus-style)
Added CSS classes:
- `.code-block` — minimal wrapper with border, no header bar
- `.code-block pre` — clean pre with padding, right padding for toolbar
- `.code-block pre[data-lang]::before` — language label via CSS pseudo-element
- `.code-block-toolbar` — absolutely positioned, hidden until hover
- `.run-code-btn`, `.edit-code-btn`, `.copy-code-btn` — icon buttons with hover states
- Removed old `.code-block-wrapper` heavy header bar pattern
- Updated markdown.ts code renderer to output `.code-block` structure
- Added `isRunnable()` function — Python/JS/TS/Bash get Run button
- Added `autolinkBareUrls()` — bare URLs and scheme-less domains auto-linked

### 4. Thinking Section Styles
Added CSS classes:
- `.thinking-section` — left accent border, collapsible
- `.thinking-header` — clickable header with toggle
- `.thinking-content` — max-height transition for collapse animation
- `.thinking-content-inner` — italic, muted color
- `.thinking-time` — tabular-nums time display

### 5. Smart Link + Streaming Styles
- `.chat-link` — dashed underline accent style for internal anchors
- `.bare-url` — word-break for long URLs
- `.streaming-cursor` — CSS blink animation
- `.stall-banner` — warning banner for stalled streams
- `.stopped-indicator` — interrupted message marker
- `.continue-btn` — accent-colored continue button

## Files Modified
- `client/src/stores/themeStore.ts` — Odysseus theme mode, Fira Code UI font, defaults changed
- `client/src/index.css` — Odysseus theme block, code block styles, thinking sections, links, streaming styles
- `client/src/components/settings/SettingsDialog.tsx` — Odysseus entry in theme picker
- `client/src/lib/markdown.ts` — `isRunnable()`, code block template using `.code-block`, `autolinkBareUrls()`
- `client/src/components/chat/ChatView.tsx` — NodeJS.Timeout → ReturnType<typeof setTimeout>
- `client/src/components/chat/MessageBubble.tsx` — fixed unused variable
- `client/src/components/composer/Composer.tsx` — fixed imports
- `client/src/stores/panelStore.ts` — removed unused import
- `client/src/__tests__/lib/markdown.test.ts` — updated for new code block class names

## Build
- Client: TypeScript ✅, Vite build ✅ (134KB index chunk)
- Server: TypeScript ✅
- Tests: 38/38 pass ✅
