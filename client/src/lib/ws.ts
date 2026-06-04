export type WsEvent = {
  type: "session-event";
  sessionKey: string;
  sessionId: string;
  eventType: string;
  text?: string;
  textDelta?: boolean;
  thinkingDelta?: boolean;
  replace?: boolean;
  done?: boolean;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number; cost?: number };
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: string;
  toolCall?: unknown;
  error?: string;
  // Sub-agent fields
  subAgentKey?: string;
  subAgentId?: string;
  subAgentTask?: string;
  subAgentResult?: string;
};

type EventHandler = (event: WsEvent) => void;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let handlers = new Set<EventHandler>();
let _connected = false;
let _reconnectAttempt = 0;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
let _onReconnect: (() => void) | null = null;

export function isConnected(): boolean {
  return _connected;
}

export function connect(): void {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  // In production (Tauri), connect to the Node server directly.
  // In dev, use the current host (Vite proxies /ws).
  const wsUrl = import.meta.env.DEV
    ? `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`
    : `ws://localhost:3456/ws`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    _connected = true;
    _reconnectAttempt = 0;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    // Notify reconnect listener
    if (_onReconnect) {
      _onReconnect();
      _onReconnect = null;
    }
  };

  ws.onclose = () => {
    _connected = false;
    scheduleReconnect();
  };

  ws.onerror = () => {
    _connected = false;
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as WsEvent;
      if (data.type === "session-event") {
        handlers.forEach((h) => h(data));
      }
    } catch {
      // ignore malformed messages
    }
  };
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  _reconnectAttempt++;
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s, up to 30s
  const baseDelay = Math.min(RECONNECT_BASE_MS * Math.pow(2, _reconnectAttempt - 1), RECONNECT_MAX_MS);
  // Add ±20% jitter
  const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
  const delay = Math.round(baseDelay + jitter);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

// Register a callback to run once on successful reconnect
export function onReconnect(cb: () => void): void {
  _onReconnect = cb;
}

export function subscribe(handler: EventHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

export function disconnect(): void {
  handlers.clear();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  ws?.close();
  ws = null;
  _connected = false;
}
