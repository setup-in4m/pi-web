import { create } from "zustand";
import type { MessageRecord, ContentBlock, UsageInfo } from "../lib/api";
import * as api from "../lib/api";
import { useToastStore } from "./toastStore";
import { escapeHtml } from "../lib/sanitize";
import { useModelStore } from "./modelStore";
import { useSettingsStore } from "./settingsStore";
import { isInfrastructureMsg, findTextMsgIdx, blocksToHtml, nextThinkId } from "./messageUtils";

export interface PanelData {
  id: number;
  workspacePath: string | null;
  sessionKey: string | null;
  sessionId: string | null;
  title: string;
  model: { provider: string; modelId: string } | null;
  thinking: string;
  /** Whether thinking blocks are hidden (collapsed). Persisted across restarts. */
  hideThinking: boolean;
  messages: MessageRecord[];
  streaming: boolean;
  loadingMessages: boolean;
  thinkingContent: string;
  thinkingStartTime: number | null;   // ms timestamp when thinking started
  streamingOutputTokens: number;  // estimated output tokens during streaming
  thinkingTokens: number;           // estimated thinking tokens
  usage: UsageInfo | null;
  pinnedIndices: number[];          // indices of pinned messages
  stallTimer?: ReturnType<typeof setTimeout> | null;
  stallNotified?: boolean;
  /** Accumulating content blocks during streaming (unified text+thinking within one message) */
  streamingBlocks: ContentBlock[];
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
  toggleHideThinking: (index: number) => void;
  setHideThinking: (index: number, hide: boolean) => void;

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
  branchFromMessage: (sourceIndex: number, messageIndex: number) => Promise<void>;

  // Pinning
  pinMessage: (panelIdx: number, msgIdx: number) => void;
  unpinMessage: (panelIdx: number, msgIdx: number) => void;

  // Regen
  regenLastMessage: (index: number) => Promise<void>;

  // Stop + continue
  stopStreaming: (index: number) => void;

  // Stall detection


}

const STORAGE_KEY = "pi-web-panels";

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
          hideThinking: p.hideThinking ?? false,
          streamingBlocks: [] as ContentBlock[],
        })),
        activeIndex: data.activeIndex || 0,
        nextId: data.nextId || 1,
      };
    }
  } catch { /* ignore */ }
  return {
    panels: [{
      id: 1, workspacePath: null, sessionKey: null, sessionId: null,
      title: "", model: null, thinking: "off", hideThinking: false,
      messages: [], streaming: false, loadingMessages: false, thinkingContent: "", thinkingStartTime: null, streamingOutputTokens: 0, thinkingTokens: 0, usage: null, pinnedIndices: [], streamingBlocks: [],
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
    hideThinking: p.hideThinking,
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

  return {
    ...initial,

    addPanel: () => {
      const s = get();
      if (s.panels.length >= 8) return;
      const active = s.panels[s.activeIndex];
      const newPanel: PanelData = {
        id: s.nextId,
        workspacePath: active?.workspacePath || null,
        sessionKey: null, sessionId: null, title: "",
        model: active?.model || null,
        thinking: active?.thinking || "off",
        hideThinking: active?.hideThinking ?? false,
        messages: [], streaming: false, loadingMessages: false, thinkingContent: "", thinkingStartTime: null, streamingOutputTokens: 0, thinkingTokens: 0, usage: null, pinnedIndices: [], streamingBlocks: [],
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

    toggleHideThinking: (index) => {
      const panel = get().panels[index];
      if (!panel) return;
      const newHide = !panel.hideThinking;
      const defaultCollapsed = useSettingsStore.getState().thinkingCollapsed;
      // Rebuild message HTML for all messages that have blocks
      set((s) => ({
        panels: s.panels.map((p, i) => {
          if (i !== index) return p;
          const msgs = p.messages.map((m, mi) => {
            if (m.blocks && m.blocks.length > 0) {
              const thinkId = nextThinkId(p.id, mi);
              return { ...m, content: blocksToHtml(m.blocks, newHide, null, defaultCollapsed, thinkId) };
            }
            return m;
          });
          return { ...p, hideThinking: newHide, messages: msgs };
        }),
      }));
      // Persist after state update
      const next = get();
      persist({ panels: next.panels, activeIndex: next.activeIndex, nextId: next.nextId });
    },

    setHideThinking: (index, hide) => {
      const panel = get().panels[index];
      if (!panel || panel.hideThinking === hide) return;
      const defaultCollapsed = useSettingsStore.getState().thinkingCollapsed;
      set((s) => ({
        panels: s.panels.map((p, i) => {
          if (i !== index) return p;
          const msgs = p.messages.map((m, mi) => {
            if (m.blocks && m.blocks.length > 0) {
              const thinkId = nextThinkId(p.id, mi);
              return { ...m, content: blocksToHtml(m.blocks, hide, null, defaultCollapsed, thinkId) };
            }
            return m;
          });
          return { ...p, hideThinking: hide, messages: msgs };
        }),
      }));
      const next = get();
      persist({ panels: next.panels, activeIndex: next.activeIndex, nextId: next.nextId });
    },

    createAndSend: async (index, message) => {
      const panel = get().panels[index];
      if (!panel) return;

      set((s) => ({
        panels: s.panels.map((p, i) =>
          i === index ? { ...p, messages: [...p.messages, { role: "user", content: message, timestamp: new Date().toISOString() }], streaming: true } : p
        ),
      }));

      try {
        // Resolve model: use panel model, or fall back to store default
        const model = panel.model || (() => {
          const ms = useModelStore.getState();
          if (ms.defaultProvider && ms.defaultModel) {
            return { provider: ms.defaultProvider, modelId: ms.defaultModel };
          }
          return null;
        })();
        const result = await api.createSession(panel.workspacePath!, message.slice(0, 40), model, panel.thinking);
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
            i === index ? { ...p, workspacePath, sessionKey: result.key, sessionId, title: result.title, messages: result.messages, usage: result.usage, loadingMessages: false } : p
          ),
          activeIndex: s.activeIndex,
          nextId: s.nextId,
        };
        set(next);
        persist(next);
      } catch (e: any) {
        useToastStore.getState().addToast(e.message, "error");
        set((s) => ({
          panels: s.panels.map((p, i) =>
            i === index ? { ...p, loadingMessages: false, messages: [...p.messages, { role: "assistant", content: `Error: ${e.message}`, timestamp: new Date().toISOString() }] } : p
          ),
        }));
      }
    },

    setStreaming: (key, streaming) =>
      set((s) => ({
        panels: s.panels.map((p) => p.sessionKey === key ? { ...p, streaming } : p),
      })),

    setUsage: (key, usage) =>
      set((s) => ({
        panels: s.panels.map((p) => p.sessionKey === key ? { ...p, usage } : p),
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
        hideThinking: source?.hideThinking ?? false,
        messages: [],
        streaming: false,
        loadingMessages: false,
        thinkingContent: "", thinkingStartTime: null,
        streamingOutputTokens: 0,
        thinkingTokens: 0,
        usage: null,
        pinnedIndices: [],
        streamingBlocks: [],
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
        hideThinking: source.hideThinking ?? false,
        messages: [{ role: "user", content: message, timestamp: new Date().toISOString() }],
        streaming: true,
        loadingMessages: false,
        thinkingContent: "", thinkingStartTime: null,
        streamingOutputTokens: 0,
        thinkingTokens: 0,
        usage: null,
        pinnedIndices: [],
        streamingBlocks: [],
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
        const result = await api.createSession(source.workspacePath, message.slice(0, 40), { provider, modelId }, source.thinking);
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
        hideThinking: false,
        messages: [],
        streaming: false,
        loadingMessages: false,
        thinkingContent: "", thinkingStartTime: null,
        streamingOutputTokens: 0,
        thinkingTokens: 0,
        usage: null,
        pinnedIndices: [],
        streamingBlocks: [],
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
        hideThinking: source.hideThinking ?? false,
        messages: [...contextMessages],
        streaming: false,
        loadingMessages: false,
        thinkingContent: "", thinkingStartTime: null,
        streamingOutputTokens: 0,
        thinkingTokens: 0,
        usage: null,
        pinnedIndices: [],
        streamingBlocks: [],
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
      // Server sends subagent_start/end events → handled by panelEvents.ts
      // which adds blocks to the streaming message. No separate message needed.
      try {
        await api.spawnSubAgent(panel.sessionKey, task, options);
      } catch (e: any) {
        useToastStore.getState().addToast(e.message, "error");
      }
    },

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


