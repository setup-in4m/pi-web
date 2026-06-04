import { Router } from "express";
import * as sessions from "../services/sessionStore.js";

const router = Router();

router.post("/session/:key/subagent", async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const { task, model, thinking } = req.body;
    if (!task) return res.status(400).json({ error: "task required" });

    const result = await sessions.spawnSubAgent(key, task, { model, thinking });
    res.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("Sub-agent error:", e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
