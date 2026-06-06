# Progress

## Status
In Progress — UI Audit Fixes

## Completed
- [x] ChatView: virtualizer `estimateSize` raised 120→200, key includes content length for remeasure — fixes visual "doubling up"
- [x] MessageBubble: streaming fast path — `escapeHtml` + `<br>` only, no `renderMarkdown` during streaming — fixes frame drops / non-progressive streaming
- [x] LayoutGrid: removed `key={preset}` — prevents full Allotment remount on layout switch

## Files Changed
- client/src/components/chat/ChatView.tsx — estimateSize + key fix
- client/src/components/chat/MessageBubble.tsx — streaming fast path
- client/src/components/layout/LayoutGrid.tsx — removed `key={preset}`
- client/src/components/composer/Composer.tsx — removed duplicate Ctrl+K listener; fixed send button disabled check
- client/src/stores/panelStore.ts — added `resetStreamingTokens` action (zeros both streamingOutputTokens + thinkingTokens); fixed `message_start`/`agent_end`/`error` cases to call `resetStreamingTokens` instead of add-0 no-op; fixed `branchFromMessage` to batch user context into single `sendMessage`
- client/src/components/panel/ModelSelector.tsx — added empty state when no models loaded
- client/src/index.css — removed duplicate CSS blocks (~60 lines)

## Validation
- TypeScript: 0 errors
- Tests: 38/38 pass
