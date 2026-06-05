// In production (Tauri), connect to the Node server on localhost.
// In dev, Vite proxies /api to the server so BASE is empty.
const BASE = import.meta.env.DEV ? "" : "http://localhost:3456";

// URL-safe base64 (RFC 4648 §5) — server decodes with 'base64url'
// Standard btoa produces + / = which break URL path segments
function toBase64Url(str: string): string {
  const utf8 = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < utf8.length; i++) {
    binary += String.fromCharCode(utf8[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try { msg = JSON.parse(text).error || text; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "POST", body: JSON.stringify(body) }),
  delete: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};

// Types
export interface Model {
  providerId: string;
  modelId: string;
  displayName: string;
  supportsThinking: boolean;
  cost: { input: number; output: number; cacheRead?: number; cacheWrite?: number } | null;
  contextWindow: number | null;
}

export interface SessionInfo {
  id: string;
  title: string;
  updatedAt: string;
}

export interface WorkspaceData {
  path: string;
  name: string;
  sessions: SessionInfo[];
}

export interface SessionRecord {
  key: string;
  workspacePath: string;
  sessionId: string;
  model: { provider: string; modelId: string } | null;
  thinking: string | null;
}

export interface MessageRecord {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface UsageInfo {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cost?: number;
}

// API calls
export const fetchInfo = () => api.get<{ agentDir: string; platform: string; piVersion: string }>("/api/info");

export const fetchModels = () =>
  api.get<{
    models: Model[];
    providers: string[];
    defaultProvider: string;
    defaultModel: string;
  }>("/api/models");

export const browseFolder = () =>
  api.post<{ cancelled: boolean; path?: string; error?: string }>("/api/browse-folder");

export const fetchWorkspace = (path: string, limit?: number, offset?: number) => {
  const params = new URLSearchParams();
  if (limit != null) params.set("limit", String(limit));
  if (offset != null) params.set("offset", String(offset));
  const qs = params.toString();
  return api.get<WorkspaceData>(`/api/workspace/${toBase64Url(path)}${qs ? "?" + qs : ""}`);
};

export const fetchWorkspaces = () =>
  api.get<{ workspaces: { path: string; name: string; addedAt: string }[] }>("/api/workspaces");

export const openSession = (workspacePath: string, sessionId: string) =>
  api.post<{ ok: boolean; key: string; title: string; messageCount: number; usage: UsageInfo }>(
    "/api/session/open",
    { workspacePath, sessionId }
  );

export const createSession = (workspacePath: string, title?: string) =>
  api.post<{ sessionId: string; key: string; title: string }>("/api/session/create", {
    workspacePath,
    title,
  });

export const sendMessage = (key: string, message: string) =>
  api.post<{ ok: boolean }>(`/api/session/${encodeURIComponent(key)}/message`, { message });

export const getTranscript = (key: string) =>
  api.get<{ transcript: MessageRecord[]; usage: UsageInfo }>(
    `/api/session/${encodeURIComponent(key)}/transcript`
  );

export const setModel = (key: string, provider: string, modelId: string) =>
  api.post<{ ok: boolean }>(`/api/session/${encodeURIComponent(key)}/model`, { provider, modelId });

export const setThinking = (key: string, level: string) =>
  api.post<{ ok: boolean }>(`/api/session/${encodeURIComponent(key)}/thinking`, { level });

export const closeSession = (key: string) =>
  api.delete<{ ok: boolean }>(`/api/session/${encodeURIComponent(key)}`);

export const deleteSession = (key: string) =>
  api.delete<{ ok: boolean }>(`/api/session/${encodeURIComponent(key)}/permanent`);

export const spawnSubAgent = (key: string, task: string, options?: { model?: string; thinking?: string }) =>
  api.post<{ ok: boolean; subSessionKey: string; subSessionId: string }>(
    `/api/session/${encodeURIComponent(key)}/subagent`,
    { task, ...options }
  );

export const getSessionUsage = (key: string) =>
  api.get<{ usage: UsageInfo }>(`/api/session/${encodeURIComponent(key)}/usage`);

export const compactSession = (key: string) =>
  api.post<{ tokensBefore?: number; tokensAfter?: number; tokensRemoved?: number; message: string; error?: string }>(
    `/api/session/${encodeURIComponent(key)}/compact`
  );

export const getActiveSessions = () =>
  api.get<{ sessions: SessionRecord[] }>("/api/sessions/active");

export const getExtensions = () =>
  api.get<{ extensions: { id: string; name: string; version: string; enabled: boolean; description?: string }[] }>("/api/extensions");

export const installExtension = (path: string) =>
  api.post<{ ok: boolean; name: string; id: string }>("/api/extensions/install", { path });

export const toggleExtension = (id: string, enabled: boolean) =>
  api.post<{ ok: boolean; enabled: boolean }>(`/api/extensions/${encodeURIComponent(id)}/toggle`, { enabled });

export const removeWorkspace = (path: string) =>
  api.delete<{ ok: boolean }>(`/api/workspace/${toBase64Url(path)}`);

export const clearAllData = () =>
  api.delete<{ ok: boolean }>("/api/data");

export const exportAll = () =>
  api.get<Record<string, unknown>>("/api/export/all");
