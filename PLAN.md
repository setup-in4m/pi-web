# Implementation Plan — Message Architecture Refactor

## Goal
Replace fragile HTML-string message system with block-based architecture. Tools, thinking, text all blend into ONE streaming assistant message per turn. No more separate infra messages. No more duplicate escapeHtml. Split panelStore.ts. Delete old cruft.

---

## Architecture Change

### Before
```
user msg → assistant msg (empty placeholder)
       → tool_start → separate assistant msg (HTML string)
       → thinking_delta → separate live thinking msg
       → text_delta → updates assistant msg
       → tool_end → separate assistant msg (HTML string)
       → agent_end → freezes blocks, removes empty placeholder
```
Result: 5-10 assistant entries per turn. Virtualizer renders each as separate item with "pi" role label.

### After
```
user msg → assistant msg (with blocks: [])
       → tool_start → adds block{type:"tool_start"} to streamingBlocks
       → thinking_delta → adds block{type:"thinking"} to streamingBlocks  
       → text_delta → adds block{type:"text"} to streamingBlocks
       → tool_end → updates matching tool_start block with result
       → agent_end → freezes blocks, renders all as one message
```
Result: 1 assistant message per turn. Blocks render inline as React components.

---

## Dependency Graph

```
Phase 0: Cleanup (no deps) ──────────────────────────────────
  Delete _old/, stale plan/progress files

Phase 1: Foundation (no deps between tasks) ─────────────────
  A. Create client/src/lib/sanitize.ts           (standalone)
  B. Extend ContentBlock types in api.ts          (standalone)
  C. Server escapeHtml → shared import            (standalone)

Phase 2: Extraction (depends on Phase 1) ────────────────────
  A. Create messageUtils.ts from panelStore.ts    (needs types)
  B. Create thinking.ts from markdown.ts          (needs sanitize.ts)
  C. Create block renderer components             (needs types)

Phase 3: Core Rewrite (depends on Phase 2) ──────────────────
  A. Create panelEvents.ts — new WebSocket handler (accumulates blocks)
  B. Rewrite MessageBubble.tsx — dispatch to block components
  C. Slim panelStore.ts — remove inline event handler, sub-agent builders

Phase 4: Cleanup (depends on Phase 3) ───────────────────────
  A. Delete HTML string builders from tools.ts (keep classifyTool)
  B. Delete sub-agent HTML renderers from panelStore.ts
  C. Update tests for new block architecture
  D. Build + test verification

Phase 5: Fix & Polish (as needed) ───────────────────────────
  A. Fix any regressions found in build/test
  B. Handle edge cases (empty messages, stall detection, etc.)
```

---

## Phase 0: Cleanup (Parallel)

### Task 0A — Delete old cruft
- **Files to delete:**
  - `C:/Users/micha/pi-web/_old/` (entire directory — old server.js backup)
  - `C:/Users/micha/pi-web/PLAN.md` (stale "5 streams" plan, superseded by this plan)
  - `C:/Users/micha/pi-web/progress.md` (minimal, not useful)
- **Files to archive/rename:**
  - None needed; just delete
- **Acceptance:** `_old/` gone, stale plan files gone

### Task 0B — Update .gitignore
- **File:** `C:/Users/micha/pi-web/.gitignore`
- **Changes:** Add `plan.md` (keep it local, not committed) — actually keep it since it's the active plan
- **Acceptance:** No stale files tracked

---

## Phase 1: Foundation (Parallel)

### Task 1A — Create `client/src/lib/sanitize.ts`
- **File:** `NEW -> client/src/lib/sanitize.ts`
- **Contents:** Single source of truth for:
  - `escapeHtml(text: string): string`
  - `toolSyntaxStrip(text: string): string` (moved from markdown.ts)
- **Why:** escapeHtml currently duplicated in tools.ts, markdown.ts, panelStore.ts, server/workspace.ts
- **Imports needed:** None (standalone)
- **Acceptance:** Can import `escapeHtml` from `../../lib/sanitize` everywhere

### Task 1B — Extend `ContentBlock` type in `client/src/lib/api.ts`
- **File:** `C:/Users/micha/pi-web/client/src/lib/api.ts`
- **Changes:** Replace simple `ContentBlock` with discriminated union:
```typescript
export type ContentBlock = 
  | { type: "text"; content: string }
  | { type: "thinking"; content: string }
  | { type: "tool_start"; toolName: string; toolInput?: unknown; toolCallId: string }
  | { type: "tool_end"; toolName: string; toolOutput: string; durationMs?: number; toolCallId: string; status: "success" | "error" }
  | { type: "subagent_start"; subAgentId: string; task: string }
  | { type: "subagent_delta"; subAgentId: string; content: string }
  | { type: "subagent_end"; subAgentId: string; result: string; usage?: UsageInfo };
```
- **Also add:** `ToolCallId` generator helper (UUID short) for matching start/end pairs
- **Why:** tool_callId lets us match tool_start→tool_end. No more fragile name-based matching.
- **Acceptance:** Type unions work, no compile errors on existing code that uses ContentBlock

### Task 1C — Server-side: Use shared escapeHtml
- **File:** `C:/Users/micha/pi-web/server/src/routes/workspace.ts`
- **Changes:** Remove local `escapeHtml` function (lines ~350-358). Import from shared location or keep as local util.
- **Simpler approach:** Keep server's escapeHtml since it's a simple function and server doesn't share code with client. Just note it.
- **Acceptance:** No change needed — server is standalone. Just acknowledge the duplication.

---

## Phase 2: Extraction (Parallel — Tasks A + B + C can run simultaneously)

### Task 2A — Create `client/src/stores/messageUtils.ts`
- **File:** `NEW -> client/src/stores/messageUtils.ts`
- **Extract from panelStore.ts:**
  - `isInfrastructureMsg(content: string): boolean`
  - `findTextMsgIdx(msgs: MessageRecord[]): number`
  - `blocksToHtml(blocks: ContentBlock[], ...): string`
  - `_manualExpandSet` + `_thinkIdCounter` + `nextThinkId()`
  - `__thinkToggle` / `__thinkIsExpanded` global helpers
- **Imports needed:**
  - `import { ContentBlock, MessageRecord, UsageInfo } from "../lib/api"`
  - `import { escapeHtml, renderMarkdown } from "../lib/markdown"` (for blocksToHtml)
- **Acceptance:** messageUtils.ts exports all helpers. panelStore.ts imports from it.

### Task 2B — Extract thinking utilities from `client/src/lib/markdown.ts`
- **File:** `NEW -> client/src/lib/thinking.ts`
- **Extract from markdown.ts:**
  - `hasUnclosedThinkTag(text: string): boolean`
  - `extractThinkingBlocks(text: string): { thinkingBlocks, content, thinkingTime }`
  - `createThinkingSection(thinkingContent, thinkingTime?, defaultCollapsed?): string`
  - `createThinkingSectionRaw(thinkingContent, thinkingTime?, defaultCollapsed?): string`
  - `detectPlainThink(text: string): string | null`
  - `normalizeWhitespace(s: string): string`
  - `THINKING_TAGS`, `REASONING_PREFIXES` constants
- **Import from:** `sanitize.ts` for `escapeHtml`
- **markdown.ts changes:** Remove extracted functions. Keep `renderMarkdown`, `autolinkBareUrls`, `toolSyntaxStrip`, `squashOutsideCode`, `renderThinkingSection`, cache, hljs setup. Update imports.
- **Why:** markdown.ts is doing too much (markdown rendering + thinking + autolink + syntax strip). Split by responsibility.
- **Acceptance:** markdown.ts ≈150 lines (was 480). thinking.ts ≈150 lines. Both compile.

### Task 2C — Create block renderer components
- **Directory:** `NEW -> client/src/components/chat/blocks/`
- **Files:**

#### 2C-1: `TextBlock.tsx`
```tsx
// Simple text content block. Renders markdown.
export function TextBlock({ content }: { content: string }) {
  return <span dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />;
}
```

#### 2C-2: `ThinkingBlock.tsx`
```tsx
// Collapsible thinking section with toggle state
export function ThinkingBlock({ content, streaming, thinkId, ... }: Props) {
  // Same toggle logic as current MessageBubble's ThinkingBlock
  // Render as React component, not HTML string
}
```

#### 2C-3: `ToolBlock.tsx`
```tsx
// Dispatches to typed renderers or generic fallback
export function ToolBlock({ block }: { block: ToolStartBlock | ToolEndBlock }) {
  const type = classifyTool(block.toolName);
  switch (type) {
    case "read": return <ToolRead block={block} />;
    case "write": case "edit": return <ToolDiff block={block} />;
    case "bash": return <ToolBash block={block} />;
    case "grep": case "find": return <ToolSearch block={block} />;
    case "ls": return <ToolLs block={block} />;
    default: return <ToolGeneric block={block} />;  // ← spanner/gear fallback
  }
}
```

#### 2C-4: `ToolRead.tsx`, `ToolWrite.tsx`, `ToolBash.tsx`, `ToolSearch.tsx`, `ToolLs.tsx`, `ToolGeneric.tsx`
One file per tool category. Each is a React component rendering the tool output. Extracted from current HTML builders in `tools.ts`.

#### 2C-5: `SubAgentBlock.tsx`
```tsx
// Sub-agent status card (start → running → done)
export function SubAgentBlock({ block }: { block: SubAgentBlock }) { ... }
```

- **Imports needed:**
  - `classifyTool` from `../../lib/tools`
  - `escapeHtml` from `../../lib/sanitize`
  - `renderMarkdown` from `../../lib/markdown`
  - `ContentBlock` types from `../../lib/api`
- **Why React components instead of HTML strings:** Virtualizer reconciliation works. No more dangerouslySetInnerHTML for infra content. Proper event handling (copy, run code).
- **Acceptance:** Each component handles its tool type plus a clean generic fallback.

---

## Phase 3: Core Rewrite (Sequential — 3A → 3B → 3C)

### Task 3A — Create `client/src/stores/panelEvents.ts`
- **File:** `NEW -> client/src/stores/panelEvents.ts`
- **Purpose:** New WebSocket event handler that accumulates blocks into ONE streaming message
- **Key logic change:**

```typescript
// Instead of appendMessage for each event:
wsSubscribe((event) => {
  set((s) => ({
    panels: s.panels.map((p) => {
      if (p.sessionKey !== event.sessionKey) return p;
      const blocks = [...p.streamingBlocks];
      
      switch (event.eventType) {
        case "message_start":
          return { ...p, streaming: true, streamingBlocks: [], streamingOutputTokens: 0 };
        
        case "text_delta":
          upsertBlock(blocks, { type: "text", content: event.text! });
          break;
        
        case "thinking_delta":
          upsertBlock(blocks, { type: "thinking", content: event.text! });
          break;
        
        case "tool_start":
          blocks.push({ type: "tool_start", toolName: event.toolName!, toolInput: event.toolInput, toolCallId: genId() });
          break;
        
        case "tool_end":
          // Find matching tool_start by name (or toolCallId) and append end block
          blocks.push({ type: "tool_end", toolName: event.toolName!, toolOutput: event.toolOutput!, durationMs, toolCallId });
          break;
        
        case "agent_end":
          // Freeze blocks into message, set streaming=false
          break;
      }
      
      // Update last assistant message with current blocks
      return { ...p, streamingBlocks: blocks, messages: updateLastMsg(p.messages, blocks) };
    }),
  }));
});
```

- **Helper function:** `upsertBlock(blocks, newBlock)` — if last text/thinking block is same type, append content. Otherwise push new.
- **No more:** `appendMessage()`, `updateLastAssistant()`, `replaceLastAssistant()`, `flushThinking()`, `upsertLiveThinking()`, `closeLiveThinking()`
- **Imports needed:**
  - `ContentBlock` from `../lib/api`
  - `subscribe` from `../lib/ws`
  - `usePanelStore` (contains setState)
  - `messageUtils` for `updateLastMsg` helper
- **Acceptance:** New handler processes all events. Old handler in panelStore.ts can be disabled.

### Task 3B — Rewrite `client/src/components/chat/MessageBubble.tsx`
- **File:** `C:/Users/micha/pi-web/client/src/components/chat/MessageBubble.tsx`
- **Current:** ~400 lines, mixed concerns (role line, thinking toggle, code execution, model info popup, HTML rendering)
- **After:** ~100 lines, dispatch to block components

```tsx
export const MessageBubble = memo(function MessageBubble({ message, streaming, panelIndex }) {
  // If message has blocks → render each block via BlockRenderer
  // If blocks but no streaming → render blocksToHtml (backward compat for stored messages)
  // If legacy content (no blocks) → render markdown
  
  return (
    <div className="flex flex-col mb-2">
      {/* Role line — dot + label + time + tokens */}
      <RoleLine message={message} panelIndex={panelIndex} />
      
      {/* Message body */}
      <div className="text-xs">
        {message.blocks ? (
          message.blocks.map((block, i) => (
            <BlockRenderer key={i} block={block} streaming={streaming} thinkId={`${panelIndex}-${i}`} />
          ))
        ) : (
          <span dangerouslySetInnerHTML={{ __html: formatted }} />
        )}
      </div>
    </div>
  );
});

// BlockRenderer dispatches to typed components
function BlockRenderer({ block, streaming, thinkId }) {
  switch (block.type) {
    case "text": return <TextBlock content={block.content} streaming={streaming} />;
    case "thinking": return <ThinkingBlock content={block.content} streaming={streaming} thinkId={thinkId} />;
    case "tool_start": case "tool_end": return <ToolBlock block={block} />;
    case "subagent_start": case "subagent_delta": case "subagent_end": return <SubAgentBlock block={block} />;
    default: return null;
  }
}
```

- **Extract:** `RoleLine` component (role dot, label, model info popup, time, token count)
- **Extract:** `executeInlineCode` → stays in MessageBubble or moves to utils
- **Remove:** `ThinkingBlock` inline component (moved to `blocks/ThinkingBlock.tsx`)
- **Imports change:**
  - Remove: `renderToolStart`, `renderToolEnd` (no longer needed)
  - Remove: `createThinkingSectionRaw`, `escapeHtml` (handled by block components)
  - Add: `BlockRenderer` from local or blocks/index.ts
- **Acceptance:** MessageBubble is thin dispatcher. No HTML string building.

### Task 3C — Slim `client/src/stores/panelStore.ts`
- **File:** `C:/Users/micha/pi-web/client/src/stores/panelStore.ts`
- **Remove:**
  - WebSocket event handler code → moved to panelEvents.ts
  - `appendMessage`, `updateLastAssistant`, `replaceLastAssistant` → no longer needed (blocks-based)
  - `setThinkingContent`, `flushThinking`, `upsertLiveThinking`, `closeLiveThinking` → replaced by block accumulation in panelEvents.ts
  - `_toolStartTimes` → replaced by toolCallId in ContentBlock
  - `findTextMsgIdx`, `isInfrastructureMsg` → moved to messageUtils.ts
  - `blocksToHtml` → moved to messageUtils.ts
  - `_manualExpandSet`, `_thinkIdCounter`, `nextThinkId`, `__thinkToggle`, `__thinkIsExpanded` → moved to messageUtils.ts
  - `renderSubAgentStart`, `renderSubAgentRunning`, `renderSubAgentDone`, `renderLiveThinking` → replaced by block components
  - `escapeHtml` import → not needed (uses sanitize.ts)
  - `createThinkingSectionRaw`, `renderMarkdown` imports → not needed (uses messageUtils)
- **Keep:**
  - `PanelData` interface (may slim: remove `thinkingContent`, `thinkingStartTime`, `stallTimer`)
  - Panel CRUD: `addPanel`, `removePanel`, `setActive`, `movePanel`
  - `setWorkspace`, `setModel`, `setThinking`, `setTitle`, `toggleHideThinking`
  - `createAndSend`, `sendMessage`, `openExistingSession`
  - `branchFromMessage`, `spawnSubAgent`, `regenLastMessage`, `stopStreaming`
  - `onReconnect` handler
  - `pinMessage`, `unpinMessage`
  - `persist` / `loadPersisted`
- **Expected:** panelStore.ts goes from ~1430 lines → ~400 lines
- **Acceptance:** All existing functionality still works. Imports updated.

---

## Phase 4: Cleanup (Parallel — 4A + 4B independent, then 4C + 4D)

### Task 4A — Clean `client/src/lib/tools.ts`
- **File:** `C:/Users/micha/pi-web/client/src/lib/tools.ts`
- **Remove:**
  - `renderToolStart()`, `renderToolEnd()`, `renderToolBody()`, `renderReadBody()`, `renderDiffBody()`, `renderBashBody()`, `renderResultsTable()`, `renderFileTree()`, `renderGenericBody()`
  - `renderReadBody`, `renderDiffBody`, `renderBashBody`, `renderResultsTable`, `renderFileTree`, `renderGenericBody`
  - `toolIcon()`, `toolIconDone()`, `toolLabel()`, `toolLabelDone()`
  - `SVG_READ`, `SVG_WRITE`, `SVG_EDIT`, `SVG_BASH`, `SVG_SEARCH`, `SVG_FOLDER`, `SVG_GEAR`
  - `extractPath()`, `extractCommand()`
  - `escapeHtml()` (now in sanitize.ts)
- **Keep:**
  - `classifyTool()` — still needed by ToolBlock.tsx
  - `ToolType` type — still needed
  - `ToolStart`, `ToolEnd` interfaces (or move to api.ts)
- **size reduction:** ~298 lines → ~30 lines
- **Acceptance:** tools.ts only exports classifyTool, ToolType, ToolStart, ToolEnd.

### Task 4B — Remove sub-agent HTML renderers from panelStore.ts
- **Already handled in Task 3C** — renderSubAgentStart, renderSubAgentRunning, renderSubAgentDone are deleted.

### Task 4C — Update tests
- **File:** `C:/Users/micha/pi-web/client/src/__tests__/lib/tokens.test.ts`
- **Changes:**
  - Test `classifyTool` only (remove tests for `renderToolStart`, `renderToolEnd`, `escapeHtml`)
  - Add tests for new block components (ToolBlock, ToolRead, ToolGeneric, etc.)
  - `escapeHtml` tests → move to `sanitize.test.ts`
- **New file:** `client/src/__tests__/lib/sanitize.test.ts`
  - Test `escapeHtml`, `toolSyntaxStrip`
- **New file:** `client/src/__tests__/components/block-renderers.test.tsx`
  - Test ToolBlock renders known types + generic fallback
  - Test ThinkingBlock collapse/expand
- **Acceptance:** All existing tests pass. New tests cover new block renderers.

### Task 4D — Build + test verification
- Run `npm run build -w client` — must compile clean
- Run `npm run lint -w client` — no new warnings
- Run `npx vitest run` — all tests pass
- Run `npm run dev` — app loads, WebSocket connects, messages render

---

## Phase 5: Fix & Polish

### Task 5A — Regression fixes
- **Stall detection:** Must still work with new message model
- **Stop/continue:** `stopStreaming()` still needs to work — may need to handle partial blocks
- **Sub-agent cards:** Must still spawn and render properly
- **Pin messages:** Must still work after message model change
- **Export:** `GET /api/session/:key/export` still works (server-side, untouched)
- **Persistence:** Messages with old HTML format still render for backward compatibility

### Task 5B — Edge cases
- Empty streaming response: no blocks → don't create empty message
- Tool-only response (no text blocks): renders tools inline
- Very long tool output: truncation still works in ToolGeneric (pre block with max-height)
- Concurrent blocks: text + thinking interleaved (e.g., text, think, text, tool, text) handled by upsertBlock

### Task 5C — Commit strategy
Each wave commits to main with messages:
```
Wave 0: "chore: delete stale files (_old/, PLAN.md, progress.md)"
Wave 1: "refactor: create sanitize.ts, extend ContentBlock types"
Wave 2: "refactor: extract messageUtils, thinking.ts, block renderers"  
Wave 3: "refactor: panelEvents block-based handler, slim panelStore, slim MessageBubble"
Wave 4: "cleanup: remove HTML string builders, update tests"
Wave 5: "fix: address regressions found in verification"
```

---

## Files Summary

### New Files (9)
| File | Purpose |
|------|---------|
| `client/src/lib/sanitize.ts` | Shared escapeHtml, toolSyntaxStrip |
| `client/src/lib/thinking.ts` | Thinking block extraction, creation |
| `client/src/stores/messageUtils.ts` | Block helpers from panelStore |
| `client/src/stores/panelEvents.ts` | New WebSocket event handler |
| `client/src/components/chat/blocks/TextBlock.tsx` | Text content block renderer |
| `client/src/components/chat/blocks/ThinkingBlock.tsx` | Thinking block renderer |
| `client/src/components/chat/blocks/ToolBlock.tsx` | Tool dispatcher (typed + generic) |
| `client/src/components/chat/blocks/ToolRead.tsx` | Read tool renderer |
| `client/src/components/chat/blocks/ToolWrite.tsx` | Write/edit diff renderer |
| `client/src/components/chat/blocks/ToolBash.tsx` | Bash tool renderer |
| `client/src/components/chat/blocks/ToolSearch.tsx` | Grep/find results renderer |
| `client/src/components/chat/blocks/ToolLs.tsx` | Directory listing renderer |
| `client/src/components/chat/blocks/ToolGeneric.tsx` | Fallback spanner/gear renderer |
| `client/src/components/chat/blocks/SubAgentBlock.tsx` | Sub-agent card renderer |

### Modified Files (9)
| File | Changes |
|------|---------|
| `client/src/lib/api.ts` | Extend ContentBlock with discriminated unions |
| `client/src/lib/markdown.ts` | Remove thinking utilities → import from thinking.ts |
| `client/src/lib/tools.ts` | Delete HTML builders, keep only classifyTool + types |
| `client/src/stores/panelStore.ts` | Remove WebSocket handler, remove HTML builders, remove flusheThinking, slim by ~1000 lines |
| `client/src/components/chat/MessageBubble.tsx` | Dispatch to block components, extract RoleLine |
| `client/src/__tests__/lib/tokens.test.ts` | Update for new tools.ts exports |
| `client/src/__tests__/lib/markdown.test.ts` | Update imports (escapeHtml from sanitize) |
| `client/src/__tests__/lib/sanitize.test.ts` | NEW test file for escapeHtml, toolSyntaxStrip |
| `server/src/routes/workspace.ts` | Keep local escapeHtml (no change needed) |

### Deleted Files
| File | Why |
|------|-----|
| `_old/` (directory) | Old server.js backup |
| `PLAN.md` | Stale, superseded by this plan |
| `progress.md` | Minimal, not useful |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Backward compat: old stored messages have HTML content, no blocks | Rendering old transcripts breaks | MessageBubble keeps `blocksToHtml` fallback. If `blocks` array exists, use block renderers. If not, render `content` as HTML (backward compat). |
| tool_call_id matching fails for tool_start→tool_end | Tools orphaned | Use sequential counter + toolName fallback. If no matching start, render tool_end alone. |
| Sub-agent events still use old HTML format | Sub-agent cards don't render | SubAgentBlock can render both new block format AND old HTML string content (check for includes('sub-agent-card')) |
| Virtualizer measureElement breaks with dynamic block heights | Chat jumpiness | Block components have stable container structure. Use `estimateSize: () => 150` for initial, virtualizer adjusts. |
| panelStore.ts slimming breaks other imports | Compile errors | Each extraction verified by build. All imports updated in same PR. |
| React key collisions in block renderers | Wrong toggle state, collapsed thinking | Use `${panelIndex}-${msgIdx}-${blockIdx}` as key for ThinkingBlock. |

---

## Verification Checklist

- [ ] `npm run build -w client` passes (no errors, no warnings)
- [ ] `npx vitest run` passes (all existing + new tests)
- [ ] `npm run lint -w client` passes
- [ ] Dev server starts, WebSocket connects
- [ ] Send message → tool_start/tool_end render inline, NOT as separate messages
- [ ] Thinking blocks render inside the same message, not as separate entries
- [ ] Generic unknown tool shows gear/spanner icon fallback
- [ ] Old saved sessions still display (HTML backward compat path)
- [ ] Pin/unpin, branch, regen, stop/continue all work
- [ ] Sub-agent cards render properly
- [ ] Copy code button works on code blocks
