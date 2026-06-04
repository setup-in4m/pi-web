import { Router } from "express";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import * as store from "../store.js";
import * as sessions from "../services/sessionStore.js";

const router = Router();

// ── Error helper ─────────────────────────────────────────

function errorCode(e: any): string {
  const msg = (e.message || "").toLowerCase();
  if (msg.includes("permission") || msg.includes("eacces") || msg.includes("access denied")) return "PERMISSION";
  if (msg.includes("disk") || msg.includes("space") || msg.includes("enospc") || msg.includes("full")) return "DISK_FULL";
  if (msg.includes("not found") || msg.includes("enoent") || msg.includes("does not exist")) return "NOT_FOUND";
  if (msg.includes("already") || msg.includes("exist")) return "ALREADY_EXISTS";
  return "INTERNAL";
}

function sendError(res: any, e: any, status = 500) {
  const code = errorCode(e);
  res.status(status).json({ error: e.message || "Internal server error", code });
}

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
    sendError(res, e);
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
    sendError(res, e);
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
      return res.status(400).json({ error: "workspacePath and sessionId required", code: "INVALID_INPUT" });
    }
    const result = await sessions.open(workspacePath, sessionId);
    res.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("Open error:", e);
    sendError(res, e);
  }
});

// Create session
router.post("/session/create", async (req, res) => {
  try {
    const { workspacePath, title } = req.body;
    if (!workspacePath) {
      return res.status(400).json({ error: "workspacePath required", code: "INVALID_INPUT" });
    }
    const result = await sessions.create(workspacePath, title);
    res.json(result);
  } catch (e: any) {
    console.error("Create error:", e);
    sendError(res, e);
  }
});

// Send message
router.post("/session/:key/message", async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "message required", code: "INVALID_INPUT" });
    await sessions.sendMessage(key, message);
    res.json({ ok: true });
  } catch (e: any) {
    sendError(res, e);
  }
});

// Get transcript
router.get("/session/:key/transcript", async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const result = await sessions.getTranscript(key);
    res.json(result);
  } catch (e: any) {
    sendError(res, e);
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
    sendError(res, e);
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
    sendError(res, e);
  }
});

// Get usage
router.get("/session/:key/usage", async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const usage = await sessions.getUsage(key);
    res.json({ usage });
  } catch (e: any) {
    sendError(res, e);
  }
});

// Compaction
router.post("/session/:key/compact", async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const result = await sessions.compact(key);
    res.json(result);
  } catch (e: any) {
    sendError(res, e);
  }
});

// Close session
router.delete("/session/:key", async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    await sessions.close(key);
    res.json({ ok: true });
  } catch (e: any) {
    sendError(res, e);
  }
});

export default router;

function firstMsg(m: any): string | null {
  if (!m) return null;
  const t = typeof m === "string" ? m : m.text || m.content || "";
  return t.substring(0, 60);
}

// ── Export session as markdown / html ───────────────────

router.get("/session/:key/export", async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const format = (req.query.format as string) || "md";
    const entry = sessions.get(key);
    if (!entry) return res.status(404).json({ error: "Session not loaded", code: "NOT_FOUND" });

    const msgs = (entry.session as any).messages || [];
    const storedSession = store.getSession(key);
    const title = storedSession?.title || "pi session";

    if (format === "html") {
      let html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js"><\/script>
<style>
:root {
  --bg: #0d1117; --bg2: #161b22; --bg3: #21262d;
  --tx1: #e6edf3; --tx2: #8b949e; --tx3: #6e7681;
  --bd: #30363d; --accent: #7c5cf0;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg); color: var(--tx1); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 820px; margin: 0 auto; padding: 2rem 1.5rem; line-height: 1.6; font-size: 14px; }
h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--tx1); }
.meta { color: var(--tx3); font-size: 0.75rem; margin-bottom: 2rem; }
.msg { margin-bottom: 1.5rem; padding: 1rem; border-radius: 8px; border: 1px solid var(--bd); }
.msg.user { background: rgba(124,92,240,0.05); border-color: rgba(124,92,240,0.15); }
.msg.assistant { background: var(--bg3); }
.role { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; margin-bottom: 0.5rem; }
.role.user { color: var(--accent); }
.role.assistant { color: #3fb950; }
pre { background: var(--bg); border: 1px solid var(--bd); border-radius: 6px; padding: 1rem; overflow-x: auto; margin: 0.5rem 0; }
code { font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 0.8rem; }
.thinking { border: 1px solid var(--bd); border-radius: 6px; padding: 0.75rem; margin: 0.5rem 0; background: var(--bg2); }
.thinking summary { color: var(--tx3); font-size: 0.75rem; cursor: pointer; }
.thinking .content { color: var(--tx2); font-style: italic; margin-top: 0.5rem; font-size: 0.75rem; white-space: pre-wrap; }
.sub-agent { border: 1px solid rgba(59,130,246,0.3); background: rgba(59,130,246,0.06); border-radius: 6px; padding: 0.75rem; margin: 0.5rem 0; }
.sub-agent summary { cursor: pointer; font-size: 0.75rem; color: var(--tx2); }
.sub-agent .result { margin-top: 0.5rem; white-space: pre-wrap; }
.tool { border: 1px solid var(--bd); border-radius: 6px; padding: 0.75rem; margin: 0.5rem 0; background: var(--bg2); }
.tool summary { cursor: pointer; font-size: 0.75rem; color: var(--tx2); }
.tool .output { margin-top: 0.5rem; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<div class="meta">Exported from pi-web on ${new Date().toLocaleString()}</div>
`;

      for (const m of msgs) {
        const role = m.role || "assistant";
        const content = typeof m.content === "string" ? m.content : Array.isArray(m.content) ? m.content.map((c: any) => c.text || "").join("") : "";
        html += `<div class="msg ${role}">
<div class="role ${role}">${role === "user" ? "You" : "pi"}</div>
<div class="content">${content}</div>
</div>
`;
      }

      html += `<script>hljs.highlightAll();<\/script>
</body>
</html>`;

      res.setHeader("Content-Type", "text/html");
      res.setHeader("Content-Disposition", `attachment; filename="${title.replace(/[^a-zA-Z0-9]/g, "_")}.html"`);
      res.send(html);
      return;
    }

    // Default: markdown export
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
    sendError(res, e);
  }
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ── Copy transcript as plain text ────────────────────────

router.get("/session/:key/copy", async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const entry = sessions.get(key);
    if (!entry) return res.status(404).json({ error: "Session not loaded", code: "NOT_FOUND" });

    const msgs = (entry.session as any).messages || [];
    const storedSession = store.getSession(key);
    const title = storedSession?.title || "pi session";

    let text = `${title}\n${new Date().toISOString()}\n${'─'.repeat(60)}\n\n`;
    for (const m of msgs) {
      const role = m.role === "user" ? "You" : "pi";
      const content = typeof m.content === "string" ? m.content : Array.isArray(m.content) ? m.content.map((c: any) => c.text || "").join("") : "";
      // Strip HTML tags for plain text
      const plain = content.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'");
      text += `${role}: ${plain}\n\n`;
    }

    res.setHeader("Content-Type", "text/plain");
    res.send(text);
  } catch (e: any) {
    sendError(res, e);
  }
});

// ── Share via GitHub Gist ────────────────────────────────

router.get("/session/:key/share", async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const entry = sessions.get(key);
    if (!entry) return res.status(404).json({ error: "Session not loaded", code: "NOT_FOUND" });

    const msgs = (entry.session as any).messages || [];
    const storedSession = store.getSession(key);
    const title = storedSession?.title || "pi session";

    // Build markdown
    let md = `# ${title}\n\n`;
    md += `*Shared from pi-web on ${new Date().toISOString()}*\n\n---\n\n`;
    for (const m of msgs) {
      const role = m.role === "user" ? "**You**" : "**pi**";
      const content = typeof m.content === "string" ? m.content : Array.isArray(m.content) ? m.content.map((c: any) => c.text || "").join("") : "";
      md += `### ${role}\n\n${content}\n\n---\n\n`;
    }

    // Try creating anonymous Gist
    try {
      const apiRes = await fetch("https://api.github.com/gists", {
        method: "POST",
        headers: {
          "Accept": "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: `pi-web: ${title}`,
          public: true,
          files: {
            [`${title.replace(/[^a-zA-Z0-9]/g, "_")}.md`]: {
              content: md,
            },
          },
        }),
      });

      if (apiRes.ok) {
        const gist = await apiRes.json() as any;
        res.json({ url: gist.html_url, id: gist.id });
        return;
      }
      // Fall through to error
      res.json({ error: `GitHub API error: ${apiRes.status}`, markdown: md });
    } catch (e: any) {
      // Network error — return markdown for manual sharing
      res.json({ error: `Gist creation failed: ${e.message}. Copy markdown manually.`, markdown: md });
    }
  } catch (e: any) {
    sendError(res, e);
  }
});
