import { createServer } from "node:http";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import express from "express";
import { PORT } from "./config.js";
import { init as initWs } from "./ws/handler.js";
import { disposeAll } from "./services/sessionStore.js";
import infoRoutes from "./routes/info.js";
import modelRoutes from "./routes/models.js";
import workspaceRoutes from "./routes/workspace.js";
import browseRoutes from "./routes/browse.js";
import subagentRoutes from "./routes/subagent.js";
import dataRoutes from "./routes/data.js";
import extensionRoutes from "./routes/extensions.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

// CORS — allow Tauri webview (tauri:// origin) and localhost dev
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (_req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

// API routes
app.use("/api", infoRoutes);
app.use("/api", modelRoutes);
app.use("/api", workspaceRoutes);
app.use("/api", browseRoutes);
app.use("/api", subagentRoutes);
app.use("/api", dataRoutes);
app.use("/api", extensionRoutes);

// Serve static client in dev (if built) or fallback
// In production (bundled with Tauri): server is at resources/server/, client at resources/client/
// Try multiple paths to find client dist
let clientDist = join(__dirname, "..", "client");
if (!existsSync(join(clientDist, "index.html"))) {
  clientDist = join(__dirname, "..", "..", "client", "dist");
}
app.use(express.static(clientDist));
// Catch-all: serve client or API fallback
app.use((_req, res) => {
  res.sendFile(join(clientDist, "index.html"), (err) => {
    if (err) {
      res.status(200).json({ message: "pi-web server running", clientMissing: true });
    }
  });
});

const server = createServer(app);
initWs(server);

server.listen(PORT, () => {
  console.log(`\n  ◆  pi-web v2  —  http://localhost:${PORT}\n`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n  Shutting down...");
  disposeAll();
  server.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  disposeAll();
  server.close();
  process.exit(0);
});
