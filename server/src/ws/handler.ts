import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";

const clients = new Set<WebSocket>();

export function init(server: Server): void {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    clients.add(ws);

    ws.on("close", () => clients.delete(ws));
    ws.on("error", () => clients.delete(ws));

    ws.send(JSON.stringify({ type: "connected" }));
  });
}

export function broadcast(data: Record<string, unknown>): void {
  const msg = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}
