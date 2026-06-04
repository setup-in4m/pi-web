import { Router } from "express";
import { modelRegistry } from "../config.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { agentDir } from "../config.js";

const router = Router();

router.get("/models", async (_req, res) => {
  try {
    await modelRegistry.refresh();
    const available = modelRegistry.getAvailable();

    const models = available.map((m: any) => ({
      providerId: m.provider || "unknown",
      modelId: m.id,
      displayName: m.name || m.id,
      supportsThinking: Boolean(m.reasoning),
      cost: m.cost || null,
      contextWindow: m.contextWindow || null,
    }));

    const providers = [...new Set(models.map((m: any) => m.providerId))];

    let defaultProvider = "";
    let defaultModel = "";
    try {
      const settings = await getRuntimeSettings();
      defaultProvider = settings.defaultProvider || providers[0] || "";
      defaultModel = settings.defaultModel || models[0]?.modelId || "";
    } catch {}

    res.json({ models, providers, defaultProvider, defaultModel });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

async function getRuntimeSettings(): Promise<{ defaultProvider: string; defaultModel: string }> {
  try {
    const settingsPath = join(agentDir, "settings.json");
    if (existsSync(settingsPath)) {
      return JSON.parse(readFileSync(settingsPath, "utf-8"));
    }
  } catch {}
  return { defaultProvider: "", defaultModel: "" };
}
