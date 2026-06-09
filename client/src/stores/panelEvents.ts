/**
 * WebSocket event handler — blocks-based accumulation.
 *
 * Instead of creating separate assistant messages for each tool/thinking event,
 * all delta events accumulate into streamingBlocks[] on the current streaming message.
 * Result: ONE assistant message per turn with inline blocks instead of N separate messages.
 *
 * Flow per turn:
 *   message_start   → create assistant msg with streamingBlocks: []
 *   text_delta      → upsert text block in streamingBlocks[]
 *   thinking_delta  → upsert thinking block in streamingBlocks[]
 *   tool_start      → push tool_start block
 *   tool_end        → push tool_end block (matched by toolCallId)
 *   subagent_*      → push/update subagent blocks
 *   agent_end       → freeze blocks into message, set streaming=false
 */
import type { ContentBlock } from "../lib/api";
import { genToolCallId } from "../lib/api";
import { subscribe as wsSubscribe, onReconnect } from "../lib/ws";
import * as api from "../lib/api";
import { usePanelStore } from "./panelStore";
import { useSettingsStore } from "./settingsStore";
import { useToastStore } from "./toastStore";
import { blocksToHtml } from "./messageUtils";
import { escapeHtml } from "../lib/sanitize";

// Track tool call timing for duration calculation
const _toolStartTimes = new Map<string, { time: number; toolCallId: string }>();

function upsertBlock(blocks: ContentBlock[], newBlock: ContentBlock): void {
  const last = blocks[blocks.length - 1];
  // Merge consecutive same-type text/thinking blocks (streaming continuation)
  if (last && last.type === newBlock.type) {
    if (newBlock.type === "text" && last.type === "text") {
      blocks[blocks.length - 1] = { ...last, content: last.content + (newBlock as Extract<ContentBlock, { type: "text" }>).content };
      return;
    }
    if (newBlock.type === "thinking" && last.type === "thinking") {
      blocks[blocks.length - 1] = { ...last, content: last.content + (newBlock as Extract<ContentBlock, { type: "thinking" }>).content };
      return;
    }
  }
  blocks.push(newBlock);
}

/** Update the last assistant message in the array with current blocks */
function updateLastMsg(msgs: any[], blocks: ContentBlock[]): any[] {
  const copy = [...msgs];
  const last = copy[copy.length - 1];
  if (last && last.role === "assistant") {
    copy[copy.length - 1] = { ...last, blocks: [...blocks], content: "" };
  }
  return copy;
}

/** Subscribe to WebSocket events and wire into panel store with blocks-based accumulation. */
export function initPanelEvents(): void {
  wsSubscribe((event) => {
    const state = usePanelStore.getState();
    const panel = state.panels.find((p) => p.sessionKey === event.sessionKey);
    if (!panel) return;

    switch (event.eventType) {
      case "message_start": {
        usePanelStore.setState((s) => ({
          panels: s.panels.map((p) => {
            if (p.sessionKey !== event.sessionKey) return p;
            // Remove any stale empty placeholder messages
            const msgs = p.messages.filter((m) =>
              !(m.role === "assistant" && m.content === "" && (!m.blocks || m.blocks.length === 0))
            );
            msgs.push({ role: "assistant" as const, content: "", blocks: [], timestamp: new Date().toISOString() });
            return { ...p, messages: msgs, streamingBlocks: [], streaming: true, streamingOutputTokens: 0, thinkingTokens: 0, thinkingContent: "", thinkingStartTime: null };
          }),
        }));
        break;
      }

      case "text_delta": {
        if (!event.text) break;
        usePanelStore.setState((s) => ({
          panels: s.panels.map((p) => {
            if (p.sessionKey !== event.sessionKey) return p;
            const blocks: ContentBlock[] = [...p.streamingBlocks];
            upsertBlock(blocks, { type: "text", content: event.text! });
            const msgs = updateLastMsg(p.messages, blocks);
            return { ...p, messages: msgs, streamingBlocks: blocks, streamingOutputTokens: p.streamingOutputTokens + Math.round(event.text!.length / 4) };
          }),
        }));
        break;
      }

      case "thinking_delta": {
        if (!event.text) break;
        usePanelStore.setState((s) => ({
          panels: s.panels.map((p) => {
            if (p.sessionKey !== event.sessionKey) return p;
            const blocks: ContentBlock[] = [...p.streamingBlocks];
            upsertBlock(blocks, { type: "thinking", content: event.text! });
            const msgs = updateLastMsg(p.messages, blocks);
            return {
              ...p, messages: msgs, streamingBlocks: blocks,
              thinkingTokens: (p.thinkingTokens || 0) + Math.round(event.text!.length / 4),
              thinkingContent: p.thinkingContent + event.text,
              thinkingStartTime: p.thinkingStartTime ?? Date.now(),
            };
          }),
        }));
        break;
      }

      case "tool_start": {
        if (!event.toolName) break;
        const toolCallId = genToolCallId();
        _toolStartTimes.set(`${event.sessionKey}::${event.toolName}::${toolCallId}`, { time: Date.now(), toolCallId });
        usePanelStore.setState((s) => ({
          panels: s.panels.map((p) => {
            if (p.sessionKey !== event.sessionKey) return p;
            const blocks: ContentBlock[] = [...p.streamingBlocks];
            blocks.push({ type: "tool_start" as const, toolName: event.toolName!, toolInput: event.toolInput, toolCallId });
            const msgs = updateLastMsg(p.messages, blocks);
            return { ...p, messages: msgs, streamingBlocks: blocks };
          }),
        }));
        break;
      }

      case "tool_end": {
        if (!event.toolName || !event.toolOutput) break;
        // Find matching tool_start by toolName (most recent first)
        let toolCallId = `tc_${Date.now().toString(36)}`;
        const curBlocks = panel.streamingBlocks;
        for (let i = curBlocks.length - 1; i >= 0; i--) {
          if (curBlocks[i].type === "tool_start" && curBlocks[i].toolName === event.toolName) {
            toolCallId = curBlocks[i].toolCallId;
            break;
          }
        }
        const startKey = `${event.sessionKey}::${event.toolName}::${toolCallId}`;
        const startInfo = _toolStartTimes.get(startKey);
        const durationMs = startInfo ? Date.now() - startInfo.time : undefined;
        if (startInfo) _toolStartTimes.delete(startKey);

        usePanelStore.setState((s) => ({
          panels: s.panels.map((p) => {
            if (p.sessionKey !== event.sessionKey) return p;
            const blocks: ContentBlock[] = [...p.streamingBlocks];
            blocks.push({ type: "tool_end" as const, toolName: event.toolName!, toolOutput: event.toolOutput!, toolCallId, durationMs, status: "success" as const });
            const msgs = updateLastMsg(p.messages, blocks);
            return { ...p, messages: msgs, streamingBlocks: blocks };
          }),
        }));
        break;
      }

      case "agent_end": {
        const defaultCollapsed = useSettingsStore.getState().thinkingCollapsed;
        usePanelStore.setState((s) => ({
          panels: s.panels.map((p) => {
            if (p.sessionKey !== event.sessionKey) return p;
            const blocks = p.streamingBlocks.length > 0 ? [...p.streamingBlocks] : undefined;
            const msgs = [...p.messages];
            if (blocks && blocks.length > 0) {
              // Convert blocks to HTML for final message content (backward compat for downstream consumers)
              const html = blocksToHtml(blocks, p.hideThinking, p.thinkingStartTime, defaultCollapsed);
              const lastMsg = msgs[msgs.length - 1];
              if (lastMsg && lastMsg.role === "assistant" && (!lastMsg.content || lastMsg.blocks)) {
                msgs[msgs.length - 1] = { ...lastMsg, content: html, blocks, timestamp: lastMsg.timestamp };
              }
            } else {
              // No streaming blocks — remove empty placeholder
              const cleaned = msgs.filter((m) =>
                !(m.role === "assistant" && m.content === "" && m.blocks && m.blocks.length === 0)
              );
              if (cleaned.length < msgs.length) msgs.splice(0, msgs.length, ...cleaned);
            }
            return {
              ...p, messages: msgs, streaming: false, streamingBlocks: [],
              streamingOutputTokens: 0, thinkingTokens: 0,
              thinkingContent: "", thinkingStartTime: null,
              usage: event.usage || p.usage,
            };
          }),
        }));
        break;
      }

      case "error": {
        if (event.error) {
          usePanelStore.setState((s) => ({
            panels: s.panels.map((p) => {
              if (p.sessionKey !== event.sessionKey) return p;
              const msgs = [...p.messages];
              msgs.push({ role: "assistant" as const, content: `<div class="text-[var(--color-danger)] text-xs">Error: ${escapeHtml(event.error || '')}</div>`, timestamp: new Date().toISOString() });
              return { ...p, messages: msgs, streaming: false, streamingBlocks: [], streamingOutputTokens: 0, thinkingTokens: 0 };
            }),
          }));
        }
        break;
      }

      // ── Sub-agent events ──
      case "subagent_start": {
        if (!event.subAgentTask) break;
        const sid = event.subAgentId || `sub_${Date.now().toString(36)}`;
        usePanelStore.setState((s) => ({
          panels: s.panels.map((p) => {
            if (p.sessionKey !== event.sessionKey) return p;
            const blocks: ContentBlock[] = [...p.streamingBlocks];
            blocks.push({ type: "subagent_start" as const, subAgentId: sid, task: event.subAgentTask! });
            const msgs = updateLastMsg(p.messages, blocks);
            return { ...p, messages: msgs, streamingBlocks: blocks };
          }),
        }));
        break;
      }

      case "subagent_delta": {
        if (!event.subAgentId || !event.text) break;
        usePanelStore.setState((s) => {
          const panel = s.panels.find((p) => p.sessionKey === event.sessionKey);
          if (!panel) return s;
          // Find the subAgentId's task from the most recent subagent_start block
          let task = "";
          for (let i = panel.streamingBlocks.length - 1; i >= 0; i--) {
            if (panel.streamingBlocks[i].type === "subagent_start" && panel.streamingBlocks[i].subAgentId === event.subAgentId) {
              task = panel.streamingBlocks[i].task;
              break;
            }
          }
          return {
            panels: s.panels.map((p) => {
              if (p.sessionKey !== event.sessionKey) return p;
              const blocks: ContentBlock[] = [...p.streamingBlocks];
              let found = false;
              for (let i = blocks.length - 1; i >= 0; i--) {
                if (blocks[i].type === "subagent_delta" && blocks[i].subAgentId === event.subAgentId) {
                  (blocks as any)[i] = { ...blocks[i], content: (blocks[i] as Extract<ContentBlock, { type: "subagent_delta" }>).content + event.text! };
                  found = true;
                  break;
                }
              }
              if (!found) {
                blocks.push({ type: "subagent_delta" as const, subAgentId: event.subAgentId!, task, content: event.text! });
              }
              const msgs = updateLastMsg(p.messages, blocks);
              return { ...p, messages: msgs, streamingBlocks: blocks };
            }),
          };
        });
        break;
      }

      case "subagent_end": {
        if (!event.subAgentId) break;
        usePanelStore.setState((s) => {
          const panel = s.panels.find((p) => p.sessionKey === event.sessionKey);
          if (!panel) return s;
          // Find the subAgentId's task
          let task = "";
          for (let i = panel.streamingBlocks.length - 1; i >= 0; i--) {
            if (panel.streamingBlocks[i].type === "subagent_start" && panel.streamingBlocks[i].subAgentId === event.subAgentId) {
              task = panel.streamingBlocks[i].task;
              break;
            }
          }
          return {
            panels: s.panels.map((p) => {
              if (p.sessionKey !== event.sessionKey) return p;
              const blocks: ContentBlock[] = [...p.streamingBlocks];
              blocks.push({ type: "subagent_end" as const, subAgentId: event.subAgentId!, task, result: event.subAgentResult || "", usage: event.usage });
              const msgs = updateLastMsg(p.messages, blocks);
              return { ...p, messages: msgs, streamingBlocks: blocks };
            }),
          };
        });
        break;
      }

      case "subagent_error": {
        if (!event.subAgentId || !event.error) break;
        usePanelStore.setState((s) => {
          const panel = s.panels.find((p) => p.sessionKey === event.sessionKey);
          if (!panel) return s;
          let task = "";
          for (let i = panel.streamingBlocks.length - 1; i >= 0; i--) {
            if (panel.streamingBlocks[i].type === "subagent_start" && panel.streamingBlocks[i].subAgentId === event.subAgentId) {
              task = panel.streamingBlocks[i].task;
              break;
            }
          }
          return {
            panels: s.panels.map((p) => {
              if (p.sessionKey !== event.sessionKey) return p;
              const blocks: ContentBlock[] = [...p.streamingBlocks];
              blocks.push({ type: "subagent_end" as const, subAgentId: event.subAgentId!, task, result: `Error: ${event.error!}`, usage: undefined });
              const msgs = updateLastMsg(p.messages, blocks);
              return { ...p, messages: msgs, streamingBlocks: blocks };
            }),
          };
        });
        break;
      }
    }
  });

  // ── Reconnect handler — re-fetch transcripts ──
  onReconnect(() => {
    const state = usePanelStore.getState();
    for (const panel of state.panels) {
      if (!panel.sessionKey || !panel.workspacePath || !panel.sessionId) continue;
      api.getTranscript(panel.sessionKey).then((transcript) => {
        const current = usePanelStore.getState();
        usePanelStore.setState({
          panels: current.panels.map((p) =>
            p.sessionKey === panel.sessionKey
              ? { ...p, messages: transcript.transcript, usage: transcript.usage }
              : p
          ),
        });
      }).catch(() => {
        // Session may have been evicted from server; re-open if needed
        api.openSession(panel.workspacePath!, panel.sessionId!).then((result) => {
          const current = usePanelStore.getState();
          usePanelStore.setState({
            panels: current.panels.map((p) =>
              p.sessionKey === panel.sessionKey
                ? { ...p, sessionKey: result.key, sessionId: result.key.split("::")[1] || panel.sessionId }
                : p
            ),
          });
          return api.getTranscript(result.key);
        }).then((transcript) => {
          if (!transcript) return;
          const current = usePanelStore.getState();
          usePanelStore.setState({
            panels: current.panels.map((p) =>
              p.sessionKey === panel.sessionKey
                ? { ...p, messages: transcript.transcript, usage: transcript.usage }
                : p
            ),
          });
        }).catch(() => {});
      });
    }
  });
}
