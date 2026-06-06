import { SessionManager, createAgentSession } from "@earendil-works/pi-coding-agent";
import type { SessionRecord } from "../store.js";
import * as store from "../store.js";
import { agentDir, authStorage, modelRegistry } from "../config.js";
import { broadcast } from "../ws/handler.js";

function buildSessionConfig(overrides: Record<string, unknown> = {}) {
  return {
    agentDir,
    authStorage,
    modelRegistry,
    ...overrides,
  };
}

interface ActiveSession {
  runtime: Awaited<ReturnType<typeof createAgentSession>>;
  session: ReturnType<typeof createAgentSession> extends Promise<infer T> ? T extends { session: infer S } ? S : never : never;
  workspacePath: string;
  model: { provider: string; modelId: string } | null;
  thinking: string | null;
  unsubscribe?: () => void;
}

const activeSessions = new Map<string, ActiveSession>();

export function get(key: string): ActiveSession | undefined {
  return activeSessions.get(key);
}

export function has(key: string): boolean {
  return activeSessions.has(key);
}

export function all(): Map<string, ActiveSession> {
  return activeSessions;
}

export async function open(workspacePath: string, sessionId: string): Promise<{ key: string; title: string; messageCount: number; usage: any }> {
  const key = `${workspacePath}::${sessionId}`;
  if (activeSessions.has(key)) return { key, title: "", messageCount: 0, usage: {} };

  const infos = await SessionManager.list(workspacePath);
  const info = infos.find(i => i.id === sessionId);
  if (!info || !info.path) throw new Error("Session file not found");

  const runtime = await createAgentSession(buildSessionConfig({
    cwd: workspacePath,
    sessionManager: SessionManager.open(info.path),
  }));
  const session = (runtime as any).session;
  if (!session) throw new Error("Failed to create session");

  const entry: ActiveSession = { runtime, session, workspacePath, model: null, thinking: null };
  activeSessions.set(key, entry);

  subscribeSession(key, sessionId, session as any);

  const msgs = (session as any).messages || [];
  const usage = (session as any).getContextUsage?.() || (session as any).getSessionStats?.() || {};

  store.upsertSession({
    key, workspacePath, sessionId,
    title: info.name || firstMsg(info.firstMessage) || "(untitled)",
    openedAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  });

  return { key, title: info.name || "(untitled)", messageCount: msgs.length, usage };
}

export async function create(
  workspacePath: string,
  title?: string,
  model?: { provider: string; modelId: string } | null,
  thinking?: string | null
): Promise<{ sessionId: string; key: string; title: string }> {
  const sm = SessionManager.create(workspacePath);
  const runtime = await createAgentSession(buildSessionConfig({
    cwd: workspacePath,
    sessionManager: sm,
  }));
  const session = (runtime as any).session;
  if (!session) throw new Error("Failed to create session");

  const sessionId = session.sessionId;
  const key = `${workspacePath}::${sessionId}`;

  if (title && (session as any).setSessionName) {
    (session as any).setSessionName(title);
  }

  // Apply model if provided (must resolve Model object from registry first)
  if (model && model.provider && model.modelId) {
    const modelObj = modelRegistry.find(model.provider, model.modelId);
    if (modelObj && (session as any).setModel) {
      try {
        await (session as any).setModel(modelObj);
      } catch (e) {
        console.error("Failed to set model on new session:", e);
      }
    }
  }

  // Apply thinking level if provided
  if (thinking && (session as any).setThinkingLevel) {
    try {
      (session as any).setThinkingLevel(thinking);
    } catch (e) {
      console.error("Failed to set thinking on new session:", e);
    }
  }

  const entry: ActiveSession = { runtime, session, workspacePath, model: model || null, thinking: thinking || null };
  activeSessions.set(key, entry);

  subscribeSession(key, sessionId, session as any);

  store.upsertSession({
    key, workspacePath, sessionId,
    title: title || "New thread",
    model: model || null,
    thinking: thinking || null,
    openedAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  });

  return { sessionId, key, title: title || "New thread" };
}

export async function setModel(key: string, provider: string, modelId: string): Promise<void> {
  const entry = activeSessions.get(key);
  if (!entry) throw new Error("Session not loaded");
  const modelObj = modelRegistry.find(provider, modelId);
  if (modelObj && (entry.session as any).setModel) {
    await (entry.session as any).setModel(modelObj);
  }
  entry.model = { provider, modelId };
  store.upsertSession({ ...store.getSession(key)!, model: entry.model });
}

export async function setThinking(key: string, level: string): Promise<void> {
  const entry = activeSessions.get(key);
  if (!entry) throw new Error("Session not loaded");
  if ((entry.session as any).setThinkingLevel) {
    (entry.session as any).setThinkingLevel(level);
  }
  entry.thinking = level;
  store.upsertSession({ ...store.getSession(key)!, thinking: level });
}

export async function sendMessage(key: string, message: string): Promise<void> {
  const entry = activeSessions.get(key);
  if (!entry) throw new Error("Session not loaded");
  await (entry.session as any).sendUserMessage(message);
}

export async function getTranscript(key: string): Promise<{ transcript: any[]; usage: any }> {
  const entry = activeSessions.get(key);
  if (!entry) throw new Error("Session not loaded");
  const msgs = (entry.session as any).messages || [];
  const usage = (entry.session as any).getContextUsage?.() || {};
  return {
    transcript: msgs.map((m: any) => {
      const role = m.role || (m.type === "user" ? "user" : "assistant");
      const ts = m.timestamp || new Date().toISOString();
      // Preserve structured content when available (SDK format: array of {type, text/thinking})
      if (Array.isArray(m.content)) {
        const blocks: Array<{ type: "text" | "thinking"; content: string }> = [];
        for (const c of m.content) {
          if (c.type === "text" && c.text) {
            blocks.push({ type: "text", content: c.text });
          } else if (c.type === "thinking" && c.thinking) {
            blocks.push({ type: "thinking", content: c.thinking });
          }
        }
        const plainText = blocks.filter(b => b.type === "text").map(b => b.content).join("\n");
        if (blocks.length > 0) {
          return { role, content: plainText, blocks, timestamp: ts };
        }
      }
      // Fallback: plain string content
      return {
        role,
        content: typeof m.content === "string" ? m.content : "",
        timestamp: ts,
      };
    }),
    usage,
  };
}

export async function getUsage(key: string): Promise<any> {
  const entry = activeSessions.get(key);
  if (!entry) throw new Error("Session not loaded");
  return (entry.session as any).getContextUsage?.() || {};
}

export async function compact(key: string): Promise<{ tokensBefore: number; tokensAfter: number; tokensRemoved: number; message: string }> {
  const entry = activeSessions.get(key);
  if (!entry) return { tokensBefore: 0, tokensAfter: 0, tokensRemoved: 0, message: "Session not loaded" };
  const session = entry.session as any;
  const before = session.getContextUsage?.() || session.getSessionStats?.() || {};
  const beforeTotal = (before.inputTokens || before.totalTokens || 0) + (before.outputTokens || 0);

  // Try pi SDK compaction if available
  if (typeof session.compactContext === "function") {
    try {
      await session.compactContext();
    } catch (e: any) {
      console.error("Compact error:", e);
      return { tokensBefore: beforeTotal, tokensAfter: beforeTotal, tokensRemoved: 0, message: `Compaction failed: ${e.message}` };
    }
  } else if (typeof session.compact === "function") {
    try {
      await session.compact();
    } catch (e: any) {
      console.error("Compact error:", e);
      return { tokensBefore: beforeTotal, tokensAfter: beforeTotal, tokensRemoved: 0, message: `Compaction failed: ${e.message}` };
    }
  } else {
    return { tokensBefore: beforeTotal, tokensAfter: beforeTotal, tokensRemoved: 0, message: "Compaction not supported by this session" };
  }

  const after = session.getContextUsage?.() || session.getSessionStats?.() || {};
  const afterTotal = (after.inputTokens || after.totalTokens || 0) + (after.outputTokens || 0);
  const removed = Math.max(0, beforeTotal - afterTotal);

  return {
    tokensBefore: beforeTotal,
    tokensAfter: afterTotal,
    tokensRemoved: removed,
    message: removed > 0 ? `Compacted: ${removed.toLocaleString()} tokens freed` : "Compact completed (no tokens removed)",
  };
}

export async function abort(key: string): Promise<void> {
  const entry = activeSessions.get(key);
  if (!entry) throw new Error("Session not loaded");
  if (typeof (entry.session as any).abort === "function") {
    await (entry.session as any).abort();
  }
}

export async function close(key: string): Promise<void> {
  const entry = activeSessions.get(key);
  if (entry) {
    if (entry.unsubscribe) {
      try { entry.unsubscribe(); } catch {}
    }
    try { (entry.runtime as any).dispose?.(); } catch {}
    activeSessions.delete(key);
  }
  store.removeSession(key);
}

export function disposeAll(): void {
  for (const [, entry] of activeSessions) {
    if (entry.unsubscribe) {
      try { entry.unsubscribe(); } catch {}
    }
    try { (entry.runtime as any).dispose?.(); } catch {}
  }
  activeSessions.clear();
}

// ── Sub-agent ────────────────────────────────────────────

export async function spawnSubAgent(
  parentKey: string,
  task: string,
  options?: { model?: string; thinking?: string }
): Promise<{ subSessionKey: string; subSessionId: string }> {
  const parent = activeSessions.get(parentKey);
  if (!parent) throw new Error("Parent session not loaded");

  // Create a new session in the same workspace
  const sm = SessionManager.create(parent.workspacePath);
  const runtime = await createAgentSession(buildSessionConfig({
    cwd: parent.workspacePath,
    sessionManager: sm,
  }));
  const subSession = (runtime as any).session;
  if (!subSession) throw new Error("Failed to create sub-agent session");

  const subSessionId = subSession.sessionId;
  const subKey = `${parent.workspacePath}::${subSessionId}`;

  // Apply model if specified
  if (options?.model && subSession.setModel) {
    const [provider, modelId] = options.model.split("/");
    if (provider && modelId) {
      const modelObj = modelRegistry.find(provider, modelId);
      if (modelObj) await subSession.setModel(modelObj);
    }
  }
  if (options?.thinking && subSession.setThinkingLevel) {
    subSession.setThinkingLevel(options.thinking);
  }

  // Set session name
  if (subSession.setSessionName) {
    subSession.setSessionName(task.slice(0, 50));
  }

  // Track the sub-agent
  activeSessions.set(subKey, { runtime, session: subSession, workspacePath: parent.workspacePath, model: null, thinking: null });

  // Subscribe to sub-agent events and forward them with parentKey
  if (subSession.subscribe) {
    let subResult = "";

    const subUnsub = subSession.subscribe((event: any) => {
      const rich: any = {
        type: "session-event",
        sessionKey: parentKey,  // route to parent panel
        sessionId: parentKey.split("::")[1],
        subAgentKey: subKey,
        subAgentId: subSessionId,
      };

      switch (event.type) {
        case "agent_start":
          rich.eventType = "subagent_start";
          rich.subAgentTask = task;
          break;
        case "message_update": {
          const de = event.assistantMessageEvent;
          if (de?.type === "text_delta") {
            rich.text = de.delta || "";
            rich.eventType = "subagent_delta";
            subResult += de.delta || "";
          } else if (de?.type === "thinking_delta") {
            rich.text = de.delta || "";
            rich.eventType = "subagent_thinking";
          } else {
            return;
          }
          break;
        }
        case "agent_end":
          rich.eventType = "subagent_end";
          rich.subAgentResult = subResult;
          rich.usage = subSession.getContextUsage?.() || {};
          break;
        case "error":
          rich.eventType = "subagent_error";
          rich.error = event.error || event.message;
          break;
        default:
          return;
      }

      broadcast(rich);
    });

    // Store unsubscribe on sub-agent entry for cleanup
    const subEntry = activeSessions.get(subKey);
    if (subEntry && typeof subUnsub === "function") {
      subEntry.unsubscribe = subUnsub;
    }
  }

  // Send the task as first message
  await subSession.sendUserMessage(task);

  return { subSessionKey: subKey, subSessionId };
}

// ── Subscribe helper ──────────────────────────────────────

function subscribeSession(key: string, sessionId: string, session: any): void {
  if (!session.subscribe) return;

  const entry = activeSessions.get(key);
  if (!entry) return;

  const unsubscribe = session.subscribe((event: any) => {
    const rich: any = {
      type: "session-event",
      sessionKey: key,
      sessionId,
    };

    switch (event.type) {
      case "message_start": {
        // Signal new message without text so text_delta appends work correctly.
        // pi SDK sends all content via text_delta events; including text here
        // would duplicate whatever text_deltas also deliver.
        rich.replace = true;
        rich.eventType = "message_start";
        break;
      }
      case "message_update": {
        const deltaEvent = event.assistantMessageEvent;
        if (deltaEvent?.type === "text_delta") {
          rich.text = deltaEvent.delta || "";
          rich.textDelta = true;
          rich.eventType = "text_delta";
        } else if (deltaEvent?.type === "tool_call") {
          rich.toolCall = deltaEvent;
          rich.eventType = "tool_call";
        } else if (deltaEvent?.type === "thinking_delta") {
          rich.text = deltaEvent.delta || "";
          rich.thinkingDelta = true;
          rich.eventType = "thinking_delta";
        } else {
          return; // skip unrecognized sub-events
        }
        break;
      }
      case "tool_execution_start": {
        rich.toolName = event.toolName;
        rich.toolInput = event.toolInput;
        rich.eventType = "tool_start";
        break;
      }
      case "tool_execution_end": {
        rich.toolName = event.toolName;
        rich.toolOutput = typeof event.result === "string" ? event.result : JSON.stringify(event.result);
        rich.eventType = "tool_end";
        break;
      }
      case "agent_start": {
        rich.eventType = "agent_start";
        break;
      }
      case "agent_end": {
        rich.done = true;
        rich.usage = session.getContextUsage?.() || session.getSessionStats?.() || {};
        rich.eventType = "agent_end";
        break;
      }
      case "error": {
        rich.error = event.error || event.message || "Unknown error";
        rich.eventType = "error";
        break;
      }
      default: {
        rich.eventType = event.type || "unknown";
        break;
      }
    }

    broadcast(rich);
  });

  // Store unsubscribe for cleanup on close
  if (typeof unsubscribe === "function") {
    entry.unsubscribe = unsubscribe;
  } else if (unsubscribe && typeof (unsubscribe as any).dispose === "function") {
    entry.unsubscribe = () => (unsubscribe as any).dispose();
  } else if (unsubscribe && typeof (unsubscribe as any).unsubscribe === "function") {
    entry.unsubscribe = () => (unsubscribe as any).unsubscribe();
  }
}

function firstMsg(m: any): string | null {
  if (!m) return null;
  const t = typeof m === "string" ? m : (m.text || m.content || "");
  return t.substring(0, 60);
}
