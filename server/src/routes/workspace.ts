import { Router } from "express";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import * as store from "../store.js";
import * as sessions from "../services/sessionStore.js";

const router = Router();

// List sessions in a workspace
router.get("/workspace/:enc", async (req, res) => {
  try {
    const path = Buffer.from(req.params.enc, "base64url").toString("utf-8");
    const infos = await SessionManager.list(path);
    const ss = infos.map((i: any) => ({
      id: i.id,
      title: i.name || firstMsg(i.firstMessage) || "(untitled)",
      updatedAt: i.modified || new Date().toISOString(),
    }));
    const name = path.split(/[\\/]/).pop() || path;

    store.addWorkspace(path, name);

    res.json({ path, name, sessions: ss });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get stored workspaces
router.get("/workspaces", (_req, res) => {
  res.json({ workspaces: store.listWorkspaces() });
});

// Remove workspace
router.delete("/workspace/:enc", (req, res) => {
  try {
    const path = Buffer.from(req.params.enc, "base64url").toString("utf-8");
    store.removeWorkspace(path);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Active sessions (survive refresh)
router.get("/sessions/active", (_req, res) => {
  const list: any[] = [];
  for (const [key, entry] of sessions.all()) {
    const parts = key.split("::");
    list.push({
      key,
      workspacePath: parts[0],
      sessionId: parts[1],
      model: entry.model,
      thinking: entry.thinking,
    });
  }
  res.json({ sessions: list });
});

// Open session
router.post("/session/open", async (req, res) => {
  try {
    const { workspacePath, sessionId } = req.body;
    if (!workspacePath || !sessionId) {
      return res.status(400).json({ error: "workspacePath and sessionId required" });
    }
    const result = await sessions.open(workspacePath, sessionId);
    res.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("Open error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Create session
router.post("/session/create", async (req, res) => {
  try {
    const { workspacePath, title } = req.body;
    if (!workspacePath) {
      return res.status(400).json({ error: "workspacePath required" });
    }
    const result = await sessions.create(workspacePath, title);
    res.json(result);
  } catch (e: any) {
    console.error("Create error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Send message
router.post("/session/:key/message", async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "message required" });
    await sessions.sendMessage(key, message);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get transcript
router.get("/session/:key/transcript", async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const result = await sessions.getTranscript(key);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Set model
router.post("/session/:key/model", async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const { provider, modelId } = req.body;
    await sessions.setModel(key, provider, modelId);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Set thinking
router.post("/session/:key/thinking", async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const { level } = req.body;
    await sessions.setThinking(key, level);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get usage
router.get("/session/:key/usage", async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const usage = await sessions.getUsage(key);
    res.json({ usage });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Close session
router.delete("/session/:key", async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    await sessions.close(key);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

function firstMsg(m: any): string | null {
  if (!m) return null;
  const t = typeof m === "string" ? m : m.text || m.content || "";
  return t.substring(0, 60);
}

// ── Export session as markdown ───────────────────────────

router.get("/session/:key/export", async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const entry = sessions.get(key);
    if (!entry) return res.status(404).json({ error: "Session not loaded" });

    const msgs = (entry.session as any).messages || [];
    const storedSession = store.getSession(key);
    const title = storedSession?.title || "pi session";

    let md = `# ${title}\n\n`;
    md += `*Exported from pi-web on ${new Date().toISOString()}*\n\n---\n\n`;

    for (const m of msgs) {
      const role = m.role === "user" ? "**You**" : "**pi**";
      const content = typeof m.content === "string" ? m.content : Array.isArray(m.content) ? m.content.map((c: any) => c.text || "").join("") : "";
      md += `### ${role}\n\n${content}\n\n---\n\n`;
    }

    res.setHeader("Content-Type", "text/markdown");
    res.setHeader("Content-Disposition", `attachment; filename="${title.replace(/[^a-zA-Z0-9]/g, "_")}.md"`);
    res.send(md);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
