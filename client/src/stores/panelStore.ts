import { create } from "zustand";
import type { MessageRecord, UsageInfo } from "../lib/api";
import * as api from "../lib/api";
import { subscribe as wsSubscribe, onReconnect } from "../lib/ws";
import { useToastStore } from "./toastStore";
import { renderToolStart, renderToolEnd } from "../lib/tools";
import { createThinkingSectionRaw, escapeHtml } from "../lib/markdown";

export interface PanelData {
  id: number;
  workspacePath: string | null;
  sessionKey: string | null;
  sessionId: string | null;
  title: string;
  model: { provider: string; modelId: string } | null;
  thinking: string;
  messages: MessageRecord[];
  streaming: boolean;
  loadingMessages: boolean;
  thinkingContent: string;
  streamingOutputTokens: number;  // estimated output tokens during streaming
  thinkingTokens: number;           // estimated thinking tokens
  usage: UsageInfo | null;
  pinnedIndices: number[];          // indices of pinned messages
  stallTimer?: ReturnType<typeof setTimeout> | null;
  stallNotified?: boolean;
  streamingTextIdx: number | null;  // index of the live plain-text message during streaming
}

interface PanelSlice {
  panels: PanelData[];
  activeIndex: number;
  nextId: number;
}

interface PanelState extends PanelSlice {
  addPanel: () => void;
  removePanel: (index: number) => void;
  setActive: (index: number) => void;
  movePanel: (from: number, to: number) => void;

  setWorkspace: (index: number, path: string) => void;
  setModel: (index: number, provider: string, modelId: string) => void;
  setThinking: (index: number, level: string) => void;
  setTitle: (index: number, title: string) => void;

  createAndSend: (index: number, message: string) => Promise<void>;
  sendMessage: (index: number, message: string) => Promise<void>;
  openExistingSession: (index: number, workspacePath: string, sessionId: string) => Promise<void>;

  appendMessage: (key: string, message: MessageRecord) => void;
  updateLastAssistant: (key: string, content: string) => void;
  replaceLastAssistant: (key: string, content: string) => void;
  setStreaming: (key: string, streaming: boolean) => void;
  setUsage: (key: string, usage: UsageInfo) => void;
  setThinkingContent: (key: string, content: string) => void;
  flushThinking: (key: string) => void;
  setStreamingTokens: (key: string, tokens: number) => void;
  addThinkingTokens: (key: string, tokens: number) => void;
  resetThinkingTokens: (key: string) => void;
  resetStreamingTokens: (key: string) => void;

  getByKey: (key: string) => PanelData | undefined;

  // Orchestration
  spawnFromPanel: (sourceIndex: number) => void;
  runOnOtherModel: (sourceIndex: number, provider: string, modelId: string, message: string) => Promise<void>;
  closeOtherPanels: (keepIndex: number) => void;
  closeAllPanels: () => void;

  // Sub-agents
  spawnSubAgent: (index: number, task: string, options?: { model?: string; thinking?: string }) => Promise<void>;
  updateSubAgentCard: (key: string, subAgentId: string, content: string) => void;
  finalizeSubAgentCard: (key: string, subAgentId: string, result: string, usage?: UsageInfo) => void;
  branchFromMessage: (sourceIndex: number, messageIndex: number) => Promise<void>;

  // Pinning
  pinMessage: (panelIdx: number, msgIdx: number) => void;
  unpinMessage: (panelIdx: number, msgIdx: number) => void;

  // Regen
  regenLastMessage: (index: number) => Promise<void>;

  // Stop + continue
  stopStreaming: (index: number) => void;

  // Stall detection

  // Live thinking (streaming)
  upsertLiveThinking: (key: string, thinkingContent: string) => void;
  closeLiveThinking: (key: string) => void;
}

const STORAGE_KEY = "pi-web-panels";
const _toolStartTimes = new Map<string, number>();

function loadPersisted(): PanelSlice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return {
        panels: (data.panels || []).map((p: Partial<PanelData>) => ({
          ...p,
          messages: [] as MessageRecord[],
          streaming: false,
          loadingMessages: false,
          usage: null as UsageInfo | null,
        })),
        activeIndex: data.activeIndex || 0,
        nextId: data.nextId || 1,
      };
    }
  } catch { /* ignore */ }
  return {
    panels: [{
      id: 1, workspacePath: null, sessionKey: null, sessionId: null,
      title: "", model: null, thinking: "off",
      messages: [], streaming: false, loadingMessages: false, thinkingContent: "", streamingOutputTokens: 0, thinkingTokens: 0, usage: null, pinnedIndices: [], streamingTextIdx: null,
    }],
    activeIndex: 0,
    nextId: 2,
  };
}

function persist(state: PanelSlice): void {
  const slim = state.panels.map((p) => ({
    id: p.id,
    workspacePath: p.workspacePath,
    sessionKey: p.sessionKey,
    sessionId: p.sessionId,
    title: p.title,
    model: p.model,
    thinking: p.thinking,
    pinnedIndices: p.pinnedIndices,
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    panels: slim,
    activeIndex: state.activeIndex,
    nextId: state.nextId,
  }));
}

export const usePanelStore = create<PanelState>((set, get) => {
  const initial = loadPersisted();

  // WebSocket event handler
  wsSubscribe((event) => {
    const state = get();
    const panel = state.panels.find((p) => p.sessionKey === event.sessionKey);
    if (!panel) return;

    switch (event.eventType) {
      case "message_start":
        state.closeLiveThinking(event.sessionKey);
        state.resetStreamingTokens(event.sessionKey);
        if (event.replace && event.text !== undefined) {
          state.replaceLastAssistant(event.sessionKey, event.text);
        }
        state.setStreaming(event.sessionKey, true);
        break;
      case "text_delta":
        if (event.text) {
          state.updateLastAssistant(event.sessionKey, event.text);
          const estimatedTokens = Math.round(event.text.length / 4);
          state.setStreamingTokens(event.sessionKey, estimatedTokens);
        }
        break;
      case "thinking_delta":
        if (event.text) {
          // Progressive live thinking block (visible during streaming)
          state.upsertLiveThinking(event.sessionKey, event.text);
          // Track thinking tokens
          state.addThinkingTokens(event.sessionKey, Math.round(event.text.length / 4));
        }
        break;
      case "tool_start": {
        if (event.toolName) {
          // Track start time for duration
          _toolStartTimes.set(event.sessionKey + "::" + event.toolName, Date.now());
          state.appendMessage(event.sessionKey, {
            role: "assistant",
            content: renderToolStart({ toolName: event.toolName, toolInput: event.toolInput }),
            timestamp: new Date().toISOString(),
          });
        }
        break;
      }
      case "tool_end": {
        if (event.toolName && event.toolOutput) {
          const startKey = event.sessionKey + "::" + event.toolName;
          const startTime = _toolStartTimes.get(startKey);
          const durationMs = startTime ? Date.now() - startTime : undefined;
          if (startTime) _toolStartTimes.delete(startKey);
          state.appendMessage(event.sessionKey, {
            role: "assistant",
            content: renderToolEnd({ toolName: event.toolName, toolOutput: event.toolOutput, durationMs }),
            timestamp: new Date().toISOString(),
          });
        }
        break;
      }
      case "agent_end":
        state.setStreaming(event.sessionKey, false);
        state.resetStreamingTokens(event.sessionKey);
        if (event.usage) state.setUsage(event.sessionKey, event.usage);
        break;
      case "error":
        if (event.error) {
          state.appendMessage(event.sessionKey, {
            role: "assistant", content: `Error: ${event.error}`,
            timestamp: new Date().toISOString(),
          });
          state.setStreaming(event.sessionKey, false);
          state.resetStreamingTokens(event.sessionKey);
        }
        break;
      // ── Sub-agent events ────────────────────────────
      case "subagent_start":
        if (event.subAgentTask) {
          state.appendMessage(event.sessionKey, {
            role: "assistant",
            content: renderSubAgentStart(event.subAgentId || "sub", event.subAgentTask),
            timestamp: new Date().toISOString(),
          });
        }
        break;
      case "subagent_delta":
        if (event.subAgentId && event.text) {
          state.updateSubAgentCard(event.sessionKey, event.subAgentId, event.text);
        }
        break;
      case "subagent_end":
        if (event.subAgentId && event.subAgentResult !== undefined) {
          state.finalizeSubAgentCard(event.sessionKey, event.subAgentId, event.subAgentResult, event.usage);
        }
        break;
      case "subagent_error":
        if (event.subAgentId && event.error) {
          state.finalizeSubAgentCard(event.sessionKey, event.subAgentId, `Error: ${event.error}`);
        }
        break;
    }
  });

  // Register reconnect handler — re-fetch transcripts on reconnect
  onReconnect(() => {
    const state = get();
    for (const panel of state.panels) {
      if (!panel.sessionKey || !panel.workspacePath || !panel.sessionId) continue;
      // Re-fetch transcript to catch any missed messages during disconnect
      api.getTranscript(panel.sessionKey).then((transcript) => {
        const current = get();
        set({
          panels: current.panels.map((p) =>
            p.sessionKey === panel.sessionKey
              ? { ...p, messages: transcript.transcript, usage: transcript.usage }
              : p
          ),
        });
      }).catch(() => {
        // Session may have been evicted from server; re-open if needed
        api.openSession(panel.workspacePath!, panel.sessionId!).then((result) => {
          const current = get();
          set({
            panels: current.panels.map((p) =>
              p.sessionKey === panel.sessionKey
                ? { ...p, sessionKey: result.key, sessionId: result.key.split("::")[1] || panel.sessionId }
                : p
            ),
          });
          return api.getTranscript(result.key);
        }).then((transcript) => {
          if (!transcript) return;
          const current = get();
          set({
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

  return {
    ...initial,

    addPanel: () => {
      const s = get();
      if (s.panels.length >= 8) return;
      const newPanel: PanelData = {
        id: s.nextId,
        workspacePath: s.panels[s.activeIndex]?.workspacePath || null,
        sessionKey: null, sessionId: null, title: "",
        model: null, thinking: "off",
        messages: [], streaming: false, loadingMessages: false, thinkingContent: "", streamingOutputTokens: 0, thinkingTokens: 0, usage: null, pinnedIndices: [], streamingTextIdx: null,
      };
      const next: PanelSlice = {
        panels: [...s.panels, newPanel],
        activeIndex: s.panels.length,
        nextId: s.nextId + 1,
      };
      set(next);
      persist(next);
    },

    removePanel: (index: number) => {
      const s = get();
      if (s.panels.length <= 1) return;
      const panel = s.panels[index];
      if (panel.sessionKey) api.closeSession(panel.sessionKey).catch(() => {});
      const panels = s.panels.filter((_, i) => i !== index);
      const next: PanelSlice = {
        panels,
        activeIndex: Math.min(s.activeIndex, panels.length - 1),
        nextId: s.nextId,
      };
      set(next);
      persist(next);
    },

    setActive: (index: number) => set({ activeIndex: index }),

    movePanel: (from: number, to: number) => {
      const s = get();
      const panels = [...s.panels];
      const [moved] = panels.splice(from, 1);
      panels.splice(to, 0, moved);
      let activeIndex = s.activeIndex;
      if (activeIndex === from) activeIndex = to;
      else if (from < activeIndex && to >= activeIndex) activeIndex--;
      else if (from > activeIndex && to <= activeIndex) activeIndex++;
      const next: PanelSlice = { panels, activeIndex, nextId: s.nextId };
      set(next);
      persist(next);
    },

    setWorkspace: (index, path) => {
      const s = get();
      const panels = s.panels.map((p, i) => i === index ? { ...p, workspacePath: path } : p);
      const next: PanelSlice = { ...s, panels };
      set(next);
      persist(next);
    },

    setModel: (index, provider, modelId) => {
      const panel = get().panels[index];
      if (panel?.sessionKey) api.setModel(panel.sessionKey, provider, modelId).catch(() => {});
      set((s) => ({
        panels: s.panels.map((p, i) => i === index ? { ...p, model: { provider, modelId } } : p),
      }));
    },

    setThinking: (index, level) => {
      const panel = get().panels[index];
      if (panel?.sessionKey) api.setThinking(panel.sessionKey, level).catch(() => {});
      set((s) => ({
        panels: s.panels.map((p, i) => i === index ? { ...p, thinking: level } : p),
      }));
    },

    setTitle: (index, title) =>
      set((s) => ({
        panels: s.panels.map((p, i) => i === index ? { ...p, title } : p),
      })),

    createAndSend: async (index, message) => {
      const panel = get().panels[index];
      if (!panel) return;

      set((s) => ({
        panels: s.panels.map((p, i) =>
          i === index ? { ...p, messages: [...p.messages, { role: "user", content: message, timestamp: new Date().toISOString() }], streaming: true } : p
        ),
      }));

      try {
        const result = await api.createSession(panel.workspacePath!, message.slice(0, 40));
        const s = get();
        const next = {
          panels: s.panels.map((p, i) =>
            i === index ? { ...p, sessionKey: result.key, sessionId: result.sessionId, title: result.title } : p
          ),
          activeIndex: s.activeIndex,
          nextId: s.nextId,
        };
        set(next);
        persist(next);
        await api.sendMessage(result.key, message);
      } catch (e: any) {
        useToastStore.getState().addToast(e.message, "error");
        set((s) => ({
          panels: s.panels.map((p, i) =>
            i === index ? { ...p, messages: [...p.messages, { role: "assistant", content: `Error: ${e.message}`, timestamp: new Date().toISOString() }], streaming: false } : p
          ),
        }));
      }
    },

    sendMessage: async (index, message) => {
      const panel = get().panels[index];
      if (!panel?.sessionKey) return;
      set((s) => ({
        panels: s.panels.map((p, i) =>
          i === index ? { ...p, messages: [...p.messages, { role: "user", content: message, timestamp: new Date().toISOString() }], streaming: true } : p
        ),
      }));
      try {
        await api.sendMessage(panel.sessionKey, message);
      } catch (e: any) {
        useToastStore.getState().addToast(e.message, "error");
        set((s) => ({
          panels: s.panels.map((p, i) =>
            i === index ? { ...p, messages: [...p.messages, { role: "assistant", content: `Error: ${e.message}`, timestamp: new Date().toISOString() }], streaming: false } : p
          ),
        }));
      }
    },

    openExistingSession: async (index, workspacePath, sessionId) => {
      const panel = get().panels[index];
      if (panel?.sessionKey) await api.closeSession(panel.sessionKey).catch(() => {});

      // Start loading
      set((s) => ({
        panels: s.panels.map((p, i) =>
          i === index ? { ...p, loadingMessages: true, messages: [] } : p
        ),
      }));

      try {
        const result = await api.openSession(workspacePath, sessionId);
        const s = get();
        const next: PanelSlice = {
          panels: s.panels.map((p, i) =>
            i === index ? { ...p, workspacePath, sessionKey: result.key, sessionId, title: result.title, messages: [], usage: result.usage } : p
          ),
          activeIndex: s.activeIndex,
          nextId: s.nextId,
        };
        set(next);
        persist(next);

        const transcript = await api.getTranscript(result.key);
        set((s) => ({
          panels: s.panels.map((p, i) =>
            i === index ? { ...p, messages: transcript.transcript, usage: transcript.usage, loadingMessages: false } : p
          ),
        }));
      } catch (e: any) {
        useToastStore.getState().addToast(e.message, "error");
        set((s) => ({
          panels: s.panels.map((p, i) =>
            i === index ? { ...p, loadingMessages: false, messages: [...p.messages, { role: "assistant", content: `Error: ${e.message}`, timestamp: new Date().toISOString() }] } : p
          ),
        }));
      }
    },

    appendMessage: (key, message) => {
      const panel = get().panels.find((p) => p.sessionKey === key);
      // Insert infrastructure messages BEFORE the streaming text message
      const textIdx = panel ? findTextMsgIdx(panel.messages) : -1;
      set((s) => ({
        panels: s.panels.map((p) => {
          if (p.sessionKey !== key) return p;
          const msgs = [...p.messages];
          if (textIdx >= 0 && textIdx < msgs.length) {
            msgs.splice(textIdx, 0, message);
          } else {
            msgs.push(message);
          }
          return { ...p, messages: msgs };
        }),
      }));
    },

    updateLastAssistant: (key, content) =>
      set((s) => ({
        panels: s.panels.map((p) => {
          if (p.sessionKey !== key) return p;
          const msgs = [...p.messages];
          const textIdx = findTextMsgIdx(msgs);
          if (textIdx >= 0) {
            msgs[textIdx] = { ...msgs[textIdx], content: msgs[textIdx].content + content };
          } else {
            msgs.push({ role: "assistant", content, timestamp: new Date().toISOString() });
          }
          return { ...p, messages: msgs, streamingTextIdx: textIdx >= 0 ? textIdx : msgs.length - 1 };
        }),
      })),

    replaceLastAssistant: (key, content) =>
      set((s) => ({
        panels: s.panels.map((p) => {
          if (p.sessionKey !== key) return p;
          const msgs = [...p.messages];
          const textIdx = findTextMsgIdx(msgs);
          if (textIdx >= 0) {
            msgs[textIdx] = { ...msgs[textIdx], content };
          } else {
            msgs.push({ role: "assistant", content, timestamp: new Date().toISOString() });
          }
          const newTextIdx = textIdx >= 0 ? textIdx : msgs.length - 1;
          return { ...p, messages: msgs, streamingTextIdx: newTextIdx };
        }),
      })),

    setStreaming: (key, streaming) =>
      set((s) => ({
        panels: s.panels.map((p) => p.sessionKey === key ? { ...p, streaming } : p),
      })),

    setUsage: (key, usage) =>
      set((s) => ({
        panels: s.panels.map((p) => p.sessionKey === key ? { ...p, usage } : p),
      })),

    setThinkingContent: (key, content) =>
      set((s) => ({
        panels: s.panels.map((p) =>
          p.sessionKey === key ? { ...p, thinkingContent: p.thinkingContent + content } : p
        ),
      })),

    flushThinking: (key) => {
      const panel = get().panels.find((p) => p.sessionKey === key);
      if (!panel || !panel.thinkingContent) return;
      set((s) => ({
        panels: s.panels.map((p) => {
          if (p.sessionKey !== key) return p;
          const thinkingMsg: MessageRecord = {
            role: "assistant",
            content: createThinkingSectionRaw(p.thinkingContent),
            timestamp: new Date().toISOString(),
          };
          return { ...p, messages: [...p.messages, thinkingMsg], thinkingContent: "" };
        }),
      }));
    },

    setStreamingTokens: (key, tokens) =>
      set((s) => ({
        panels: s.panels.map((p) =>
          p.sessionKey === key ? { ...p, streamingOutputTokens: p.streamingOutputTokens + tokens } : p
        ),
      })),

    addThinkingTokens: (key, tokens) =>
      set((s) => ({
        panels: s.panels.map((p) =>
          p.sessionKey === key ? { ...p, thinkingTokens: (p.thinkingTokens || 0) + tokens } : p
        ),
      })),

    resetThinkingTokens: (key) =>
      set((s) => ({
        panels: s.panels.map((p) =>
          p.sessionKey === key ? { ...p, thinkingTokens: 0 } : p
        ),
      })),

    resetStreamingTokens: (key) =>
      set((s) => ({
        panels: s.panels.map((p) =>
          p.sessionKey === key ? { ...p, streamingOutputTokens: 0, thinkingTokens: 0 } : p
        ),
      })),

    getByKey: (key) => get().panels.find((p) => p.sessionKey === key),

    // ── Orchestration ──────────────────────────────────────

    spawnFromPanel: (sourceIndex) => {
      const s = get();
      if (s.panels.length >= 8) {
        useToastStore.getState().addToast("Max 8 panels", "warning");
        return;
      }
      const source = s.panels[sourceIndex];
      const newPanel: PanelData = {
        id: s.nextId,
        workspacePath: source?.workspacePath || null,
        sessionKey: null,
        sessionId: null,
        title: "",
        model: source?.model || null,
        thinking: source?.thinking || "off",
        messages: [],
        streaming: false,
        loadingMessages: false,
        thinkingContent: "",
        streamingOutputTokens: 0,
        thinkingTokens: 0,
        usage: null,
        pinnedIndices: [],
        streamingTextIdx: null,
      };
      const next: PanelSlice = {
        panels: [...s.panels, newPanel],
        activeIndex: s.panels.length,
        nextId: s.nextId + 1,
      };
      set(next);
      persist(next);
      useToastStore.getState().addToast("New panel spawned", "success");
    },

    runOnOtherModel: async (sourceIndex, provider, modelId, message) => {
      const s = get();
      if (s.panels.length >= 8) {
        useToastStore.getState().addToast("Max 8 panels", "warning");
        return;
      }
      const source = s.panels[sourceIndex];
      if (!source?.workspacePath) {
        useToastStore.getState().addToast("No workspace", "error");
        return;
      }

      // Create new panel with the target model
      const newPanel: PanelData = {
        id: s.nextId,
        workspacePath: source.workspacePath,
        sessionKey: null,
        sessionId: null,
        title: message.slice(0, 40),
        model: { provider, modelId },
        thinking: source.thinking || "off",
        messages: [{ role: "user", content: message, timestamp: new Date().toISOString() }],
        streaming: true,
        loadingMessages: false,
        thinkingContent: "",
        streamingOutputTokens: 0,
        thinkingTokens: 0,
        usage: null,
        pinnedIndices: [],
        streamingTextIdx: null,
      };
      const next: PanelSlice = {
        panels: [...s.panels, newPanel],
        activeIndex: s.panels.length,
        nextId: s.nextId + 1,
      };
      set(next);
      persist(next);

      // Create session and send
      const newIndex = s.panels.length;
      try {
        const result = await api.createSession(source.workspacePath, message.slice(0, 40));
        set((s2) => {
          const p = s2.panels.map((p, i) =>
            i === newIndex ? { ...p, sessionKey: result.key, sessionId: result.sessionId, title: result.title } : p
          );
          const ns = { panels: p, activeIndex: s2.activeIndex, nextId: s2.nextId };
          persist(ns);
          return ns;
        });
        await api.setModel(result.key, provider, modelId);
        await api.sendMessage(result.key, message);
      } catch (e: any) {
        useToastStore.getState().addToast(e.message, "error");
        set((s2) => ({
          panels: s2.panels.map((p, i) =>
            i === newIndex ? { ...p, streaming: false } : p
          ),
        }));
      }
    },

    closeOtherPanels: (keepIndex) => {
      const s = get();
      const toClose = s.panels.filter((_, i) => i !== keepIndex);
      for (const p of toClose) {
        if (p.sessionKey) api.closeSession(p.sessionKey).catch(() => {});
      }
      const panels = [s.panels[keepIndex]];
      const next: PanelSlice = { panels, activeIndex: 0, nextId: s.nextId };
      set(next);
      persist(next);
    },

    closeAllPanels: () => {
      const s = get();
      for (const p of s.panels) {
        if (p.sessionKey) api.closeSession(p.sessionKey).catch(() => {});
      }
      const panel: PanelData = {
        id: s.nextId,
        workspacePath: s.panels[0]?.workspacePath || null,
        sessionKey: null,
        sessionId: null,
        title: "",
        model: null,
        thinking: "off",
        messages: [],
        streaming: false,
        loadingMessages: false,
        thinkingContent: "",
        streamingOutputTokens: 0,
        thinkingTokens: 0,
        usage: null,
        pinnedIndices: [],
        streamingTextIdx: null,
      };
      const next: PanelSlice = { panels: [panel], activeIndex: 0, nextId: s.nextId + 1 };
      set(next);
      persist(next);
    },

    branchFromMessage: async (sourceIndex, messageIndex) => {
      const s = get();
      const source = s.panels[sourceIndex];
      if (!source?.workspacePath) {
        useToastStore.getState().addToast("No workspace to branch from", "error");
        return;
      }
      if (s.panels.length >= 8) {
        useToastStore.getState().addToast("Max 8 panels", "warning");
        return;
      }

      // Copy messages up to and including the branch point
      const contextMessages = source.messages.slice(0, messageIndex + 1);

      // Create new panel with those messages pre-loaded
      const newPanel: PanelData = {
        id: s.nextId,
        workspacePath: source.workspacePath,
        sessionKey: null,
        sessionId: null,
        title: source.title ? `${source.title} (branch)` : "Branch",
        model: source.model ? { ...source.model } : null,
        thinking: source.thinking || "off",
        messages: [...contextMessages],
        streaming: false,
        loadingMessages: false,
        thinkingContent: "",
        streamingOutputTokens: 0,
        thinkingTokens: 0,
        usage: null,
        pinnedIndices: [],
        streamingTextIdx: null,
      };
      const next: PanelSlice = {
        panels: [...s.panels, newPanel],
        activeIndex: s.panels.length,
        nextId: s.nextId + 1,
      };
      set(next);
      persist(next);

      // Create a new session on the server for the branch
      const newIndex = s.panels.length;
      try {
        const result = await api.createSession(source.workspacePath, `Branch: ${source.title || "thread"}`);
        set((s2) => {
          const p = s2.panels.map((p, i) =>
            i === newIndex ? { ...p, sessionKey: result.key, sessionId: result.sessionId, title: result.title } : p
          );
          const ns = { panels: p, activeIndex: s2.activeIndex, nextId: s2.nextId };
          persist(ns);
          return ns;
        });

        // Batch all user context messages into a single send to avoid triggering N agent turns
        const userMessages = contextMessages
          .filter((m) => m.role === "user")
          .map((m) => {
            const div = document.createElement("div");
            div.innerHTML = m.content;
            return (div.textContent || div.innerText || m.content).trim();
          })
          .filter(Boolean);
        if (userMessages.length > 0) {
          const batched = "[Context from branch — previous messages below, then continue]\n\n" + userMessages.join("\n\n");
          await api.sendMessage(result.key, batched);
        }

        useToastStore.getState().addToast("Branch created", "success");
      } catch (e: any) {
        useToastStore.getState().addToast(e.message, "error");
        set((s2) => ({
          panels: s2.panels.map((p, i) =>
            i === newIndex ? { ...p, loadingMessages: false } : p
          ),
        }));
      }
    },

    // ── Sub-agents ────────────────────────────────────────

    spawnSubAgent: async (index, task, options) => {
      const panel = get().panels[index];
      if (!panel?.sessionKey) return;

      // Add running sub-agent card
      set((s) => ({
        panels: s.panels.map((p, i) =>
          i === index ? {
            ...p,
            messages: [...p.messages, {
              role: "assistant" as const,
              content: renderSubAgentStart("pending", task),
              timestamp: new Date().toISOString(),
            }],
          } : p
        ),
      }));

      try {
        await api.spawnSubAgent(panel.sessionKey, task, options);
      } catch (e: any) {
        useToastStore.getState().addToast(e.message, "error");
      }
    },

    updateSubAgentCard: (key, subAgentId, content) =>
      set((s) => ({
        panels: s.panels.map((p) => {
          if (p.sessionKey !== key) return p;
          const msgs = [...p.messages];
          // Find the last sub-agent card and update it
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].content.includes(`data-sub-agent="${subAgentId}"`)) {
              // Replace the placeholder with accumulating content
              msgs[i] = {
                ...msgs[i],
                content: renderSubAgentRunning(subAgentId, msgs[i].content.match(/data-task="([^"]*)"/)?.[1] || "", content),
              };
              break;
            }
          }
          return { ...p, messages: msgs };
        }),
      })),

    finalizeSubAgentCard: (key, subAgentId, result, usage) =>
      set((s) => ({
        panels: s.panels.map((p) => {
          if (p.sessionKey !== key) return p;
          const msgs = [...p.messages];
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].content.includes(`data-sub-agent="${subAgentId}"`)) {
              const task = msgs[i].content.match(/data-task="([^"]*)"/)?.[1] || "";
              msgs[i] = {
                ...msgs[i],
                content: renderSubAgentDone(subAgentId, task, result, usage),
              };
              break;
            }
          }
          return { ...p, messages: msgs };
        }),
      })),

    // ── Regen ─────────────────────────────────────────

    regenLastMessage: async (index) => {
      const panel = get().panels[index];
      if (!panel?.sessionKey) return;
      // Find last user message
      const msgs = panel.messages;
      let lastUserIdx = -1;
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "user") { lastUserIdx = i; break; }
      }
      if (lastUserIdx < 0) return;
      const userMsg = msgs[lastUserIdx];
      // Extract plain text from HTML content
      const div = document.createElement("div");
      div.innerHTML = userMsg.content;
      const plain = (div.textContent || div.innerText || userMsg.content).trim();
      if (!plain) return;
      // Trim messages to just before the last user message (includes the user msg)
      const trimmed = msgs.slice(0, lastUserIdx + 1);
      set((s) => ({
        panels: s.panels.map((p, i) =>
          i === index ? { ...p, messages: trimmed, streaming: true } : p
        ),
      }));
      try {
        await api.sendMessage(panel.sessionKey, plain);
      } catch (e: any) {
        useToastStore.getState().addToast(e.message, "error");
        set((s) => ({
          panels: s.panels.map((p, i) =>
            i === index ? { ...p, streaming: false } : p
          ),
        }));
      }
    },

    // ── Stop Streaming (with continue option) ──────────

    stopStreaming: async (index) => {
      const panel = get().panels[index];
      if (!panel?.streaming) return;

      // Call server to abort
      if (panel.sessionKey) {
        api.stopStreaming(panel.sessionKey).catch(() => {});
      }

      const msgs = [...panel.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === "assistant" && last.content) {
        const lastContent = last.content;
        const plain = (() => { const d = document.createElement("div"); d.innerHTML = lastContent; return (d.textContent || "").slice(-500); })();
        msgs.push({
          role: "assistant",
          content: `<div class="stopped-indicator"><span>[Message interrupted]</span><button class="continue-btn" onclick="window._piContinue&amp;&amp;window._piContinue('${escapeHtml(panel.sessionKey || '')}','${escapeHtml(plain).replace(/'/g, "\\'")}')">▶ Continue</button></div>`,
          timestamp: new Date().toISOString(),
        });
      }
      set((s) => ({
        panels: s.panels.map((p, i) =>
          i === index ? { ...p, messages: msgs, streaming: false, stallTimer: null, stallNotified: false } : p
        ),
      }));
      // Register global continue handler
      (window as any)._piContinue = async (key: string, cutoff: string) => {
        const msg = `Your previous response was interrupted. It ended with:\n\n${cutoff}\n\nDo NOT repeat what you already said. Continue exactly from where you were cut off.`;
        set((s) => ({
          panels: s.panels.map((p) => p.sessionKey === key ? { ...p, messages: [...p.messages, { role: "user", content: msg, timestamp: new Date().toISOString() }], streaming: true } : p),
        }));
        try { await api.sendMessage(key, msg); } catch (e: any) {
          useToastStore.getState().addToast(e.message, "error");
        }
      };
    },

    // ── Stall detection ─────────────────────────────────

    startStallTimer: (key: string) => {
      const panel = get().panels.find((p) => p.sessionKey === key);
      if (!panel || panel.stallTimer) return;
      const timer = setTimeout(() => {
        const p = get().panels.find((p2) => p2.sessionKey === key);
        if (!p || !p.streaming || p.stallNotified) return;
        set((s) => ({
          panels: s.panels.map((p2) =>
            p2.sessionKey === key
              ? {
                  ...p2,
                  stallNotified: true,
                  messages: [
                    ...p2.messages,
                    {
                      role: "assistant" as const,
                      content: `<div class="stall-warning" style="font-size:10px;color:var(--color-warning);font-style:italic;padding:4px 8px">Still working… the model may be processing a long response.</div>`,
                      timestamp: new Date().toISOString(),
                    },
                  ],
                }
              : p2
          ),
        }));
      }, 60000);
      set((s) => ({
        panels: s.panels.map((p) =>
          p.sessionKey === key ? { ...p, stallTimer: timer } : p
        ),
      }));
    },

    resetStallTimer: (key: string) => {
      const panel = get().panels.find((p) => p.sessionKey === key);
      if (!panel) return;
      if (panel.stallTimer) clearTimeout(panel.stallTimer);
      const timer = setTimeout(() => {
        const p = get().panels.find((p2) => p2.sessionKey === key);
        if (!p || !p.streaming || p.stallNotified) return;
        set((s) => ({
          panels: s.panels.map((p2) =>
            p2.sessionKey === key
              ? {
                  ...p2,
                  stallNotified: true,
                  messages: [
                    ...p2.messages,
                    {
                      role: "assistant" as const,
                      content: `<div class="stall-warning" style="font-size:10px;color:var(--color-warning);font-style:italic;padding:4px 8px">Still working… the model may be processing a long response.</div>`,
                      timestamp: new Date().toISOString(),
                    },
                  ],
                }
              : p2
          ),
        }));
      }, 60000);
      set((s) => ({
        panels: s.panels.map((p) =>
          p.sessionKey === key ? { ...p, stallTimer: timer } : p
        ),
      }));
    },

    clearStallTimer: (key: string) => {
      const panel = get().panels.find((p) => p.sessionKey === key);
      if (!panel?.stallTimer) return;
      clearTimeout(panel.stallTimer as ReturnType<typeof setTimeout>);
      set((s) => ({
        panels: s.panels.map((p) =>
          p.sessionKey === key ? { ...p, stallTimer: null } : p
        ),
      }));
    },

    // ── Live thinking (progressive streaming thinking blocks) ──

    upsertLiveThinking: (key, thinkingContent) =>
      set((s) => {
        const panel = s.panels.find((p) => p.sessionKey === key);
        if (!panel) return s;
        const msgs = [...panel.messages];
        // Search for existing live thinking block
        let existingIdx = -1;
        for (let i = msgs.length - 1; i >= Math.max(0, msgs.length - 5); i--) {
          if (msgs[i].content.includes('data-live-thinking="true"')) {
            existingIdx = i;
            break;
          }
        }
        if (existingIdx >= 0) {
          // Update existing live thinking block
          msgs[existingIdx] = {
            ...msgs[existingIdx],
            content: renderLiveThinking({ content: thinkingContent, streaming: true }),
          };
        } else {
          // Create new live thinking block — insert BEFORE the plain-text message
          const textIdx = findTextMsgIdx(msgs);
          const thinkingMsg = {
            role: "assistant" as const,
            content: renderLiveThinking({ content: thinkingContent, streaming: true }),
            timestamp: new Date().toISOString(),
          };
          if (textIdx >= 0) {
            msgs.splice(textIdx, 0, thinkingMsg);
          } else {
            msgs.push(thinkingMsg);
          }
        }
        return {
          panels: s.panels.map((p) =>
            p.sessionKey === key ? { ...p, messages: msgs, thinkingContent: p.thinkingContent + thinkingContent } : p
          ),
        };
      }),

    closeLiveThinking: (key) =>
      set((s) => ({
        panels: s.panels.map((p) => {
          if (p.sessionKey !== key) return p;
          const msgs = [...p.messages];
          // Convert live thinking to static foldable block, but only if we have content
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].content.includes('data-live-thinking="true"')) {
              const content = p.thinkingContent;
              if (content) {
                msgs[i] = {
                  ...msgs[i],
                  content: renderLiveThinking({ content, streaming: false }),
                };
              } else {
                // No thinking content — remove the placeholder
                msgs.splice(i, 1);
              }
              break;
            }
          }
          return { ...p, messages: msgs, thinkingContent: "" };
        }),
      })),

    // ── Pinning ─────────────────────────────────────────

    pinMessage: (panelIdx, msgIdx) =>
      set((s) => ({
        panels: s.panels.map((p, i) =>
          i === panelIdx && !p.pinnedIndices.includes(msgIdx)
            ? { ...p, pinnedIndices: [...p.pinnedIndices, msgIdx].sort((a, b) => a - b) }
            : p
        ),
      })),

    unpinMessage: (panelIdx, msgIdx) =>
      set((s) => ({
        panels: s.panels.map((p, i) =>
          i === panelIdx
            ? { ...p, pinnedIndices: p.pinnedIndices.filter((idx) => idx !== msgIdx) }
            : p
        ),
      })),
  };
});

// ── Infrastructure message detection ──────────────────

function isInfrastructureMsg(content: string): boolean {
  return content.includes('thinking-section') ||
         content.includes('tool-card') ||
         content.includes('sub-agent-card') ||
         content.includes('data-live-thinking');
}

/** Find the last plain-text assistant message index, or -1 if none */
function findTextMsgIdx(msgs: MessageRecord[]): number {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'assistant' && !isInfrastructureMsg(msgs[i].content)) {
      return i;
    }
  }
  return -1;
}

// ── Sub-agent card renderers ─────────────────────────────

// ── Live thinking block renderer (streaming vs static) ──────

function renderLiveThinking({ content, streaming }: { content: string; streaming: boolean }): string {
  if (streaming) {
    return `<div class="thinking-section" data-live-thinking="true">
  <div class="thinking-header" style="cursor:default">
    <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse flex-shrink-0"></span>
    <span>View thinking process</span>
    <span class="thinking-toggle" style="transform:none">▾</span>
  </div>
  <div class="thinking-content">
    <div class="thinking-content-inner">${escapeHtml(content)}<span class="streaming-cursor">▊</span></div>
  </div>
</div>`;
  }
  return createThinkingSectionRaw(content);
}

function renderSubAgentStart(id: string, task: string): string {
  return `<div class="sub-agent-card my-1.5 px-2.5 py-2 rounded-lg border border-[var(--color-accent)]/30 bg-[rgba(59,130,246,0.06)]" data-sub-agent="${escapeHtml(id)}" data-task="${escapeHtml(task)}">
    <div class="flex items-center gap-2 text-[10px]">
      <span class="text-sm">🤖</span>
      <span class="font-medium text-[var(--color-t2)]">Sub-agent</span>
      <span class="text-[var(--color-t3)] flex-1 truncate">${escapeHtml(task)}</span>
      <span class="flex items-center gap-1 text-[var(--color-warning)]">
        <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-warning)] animate-pulse"></span>
        running
      </span>
    </div>
    <div class="mt-2 text-[11px] text-[var(--color-t2)] italic whitespace-pre-wrap hidden"></div>
  </div>`;
}

function renderSubAgentRunning(id: string, task: string, content: string): string {
  return `<div class="sub-agent-card my-1.5 px-2.5 py-2 rounded-lg border border-[var(--color-accent)]/30 bg-[rgba(59,130,246,0.06)]" data-sub-agent="${escapeHtml(id)}" data-task="${escapeHtml(task)}">
    <div class="flex items-center gap-2 text-[10px]">
      <span class="text-sm">🤖</span>
      <span class="font-medium text-[var(--color-t2)]">Sub-agent</span>
      <span class="text-[var(--color-t3)] flex-1 truncate">${escapeHtml(task)}</span>
      <span class="flex items-center gap-1 text-[var(--color-warning)]">
        <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-warning)] animate-pulse"></span>
        running
      </span>
    </div>
    <div class="mt-2 text-[11px] text-[var(--color-t2)] whitespace-pre-wrap" style="display:block">${escapeHtml(content)}</div>
  </div>`;
}

function renderSubAgentDone(id: string, task: string, result: string, usage?: { inputTokens?: number; outputTokens?: number; cost?: number }): string {
  const usageStr = usage
    ? [
        usage.inputTokens != null && `in:${usage.inputTokens}`,
        usage.outputTokens != null && `out:${usage.outputTokens}`,
        usage.cost != null && `$${Number(usage.cost).toFixed(4)}`,
      ].filter(Boolean).join(" ")
    : "";
  return `<details class="sub-agent-card my-1.5 px-2.5 py-2 rounded-lg border border-[rgba(59,130,246,0.3)] bg-[rgba(59,130,246,0.06)]" data-sub-agent="${escapeHtml(id)}" open>
    <summary class="flex items-center gap-2 text-[10px] cursor-pointer hover:text-[var(--color-t1)] select-none">
      <span class="text-sm">🤖</span>
      <span class="font-medium text-[var(--color-t2)]">Sub-agent</span>
      <span class="text-[var(--color-t3)] flex-1 truncate">${escapeHtml(task)}</span>
      <span class="text-[var(--color-success)]">✅ done</span>
      ${usageStr ? `<span class="text-[8px] text-[var(--color-t3)]">${escapeHtml(usageStr)}</span>` : ""}
    </summary>
    <div class="mt-2 text-[11px] text-[var(--color-t1)] whitespace-pre-wrap">${escapeHtml(result)}</div>
  </details>`;
}

// escapeHtml imported from ../lib/tools — no local duplicate needed
