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

export function isConnected(): boolean {
  return _connected;
}

export function connect(): void {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  const protocol = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${protocol}://${location.host}/ws`);

  ws.onopen = () => {
    _connected = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
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
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 2000);
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
