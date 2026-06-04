import { Router } from "express";
import * as store from "../store.js";
import * as sessions from "../services/sessionStore.js";

const router = Router();

// Export all data as JSON
router.get("/export/all", async (_req, res) => {
  try {
    const workspaces = store.listWorkspaces();
    const sessionsList = store.listSessions();

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      workspaces,
      sessions: sessionsList,
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="pi-web-export-${new Date().toISOString().slice(0, 10)}.json"`
    );
    res.json(exportData);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Clear all data
router.delete("/data", async (_req, res) => {
  try {
    // Close all active sessions
    sessions.disposeAll();

    // Get and clear store data
    const sList = store.listSessions();
    for (const s of sList) {
      store.removeSession(s.key);
    }
    const wList = store.listWorkspaces();
    for (const w of wList) {
      store.removeWorkspace(w.path);
    }

    res.json({ ok: true, clearedSessions: sList.length, clearedWorkspaces: wList.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Copy transcript as plain text
router.get("/session/:key/copy", async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const { transcript } = await sessions.getTranscript(key);

    let text = "";
    for (const msg of transcript) {
      const role = msg.role === "user" ? "You" : "pi";
      const content = typeof msg.content === "string"
        ? msg.content.replace(/<[^>]*>/g, "") // strip HTML
        : "";
      text += `## ${role}\n\n${content}\n\n`;
    }

    res.setHeader("Content-Type", "text/plain");
    res.send(text);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
