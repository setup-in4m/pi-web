import { createServer } from "node:http";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { PORT } from "./config.js";
import { init as initWs } from "./ws/handler.js";
import { disposeAll } from "./services/sessionStore.js";
import infoRoutes from "./routes/info.js";
import modelRoutes from "./routes/models.js";
import workspaceRoutes from "./routes/workspace.js";
import browseRoutes from "./routes/browse.js";
import subagentRoutes from "./routes/subagent.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

// API routes
app.use("/api", infoRoutes);
app.use("/api", modelRoutes);
app.use("/api", workspaceRoutes);
app.use("/api", browseRoutes);
app.use("/api", subagentRoutes);

// Serve static client in dev (if built) or fallback
const clientDist = join(__dirname, "..", "..", "client", "dist");
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
