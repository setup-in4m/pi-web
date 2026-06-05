import { Router } from "express";
import { readdirSync, existsSync, readFileSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import { join, basename } from "node:path";
import { agentDir } from "../config.js";
import { SettingsManager } from "@earendil-works/pi-coding-agent";

const router = Router();
const EXTENSIONS_DIR = join(agentDir, "extensions");

interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  description?: string;
}

async function listExtensions(): Promise<ExtensionInfo[]> {
  const extensions: ExtensionInfo[] = [];
  const seen = new Set<string>();

  try {
    // Read from pi's settings.json (same source as pi CLI)
    const settings = SettingsManager.create(process.cwd(), agentDir);
    const packages = settings.getPackages();
    const extPaths = settings.getExtensionPaths();

    // Map configured packages
    for (const pkg of packages) {
      const sourceStr = typeof pkg === "string" ? pkg : (pkg as any).source || String(pkg);
      const id = sourceStr.replace(/[:\/]/g, "-");
      if (seen.has(id)) continue;
      seen.add(id);
      extensions.push({
        id,
        name: sourceStr,
        version: "0.0.0",
        enabled: true,
        description: typeof pkg === "string" ? `Package: ${pkg}` : undefined,
      });
    }

    // Map resolved extension paths
    for (const extPath of extPaths) {
      const name = basename(extPath);
      const id = name.toLowerCase().replace(/\s+/g, "-");
      if (seen.has(id)) continue;
      seen.add(id);
      extensions.push({
        id,
        name,
        version: "0.0.0",
        enabled: true,
        description: `Path: ${extPath}`,
      });
    }
  } catch (e: any) {
    console.error("[extensions] SettingsManager failed:", e.message);
  }

  // Fallback: scan local extensions directory
  const localExts = listLocalExtensionDirs();
  for (const local of localExts) {
    if (!seen.has(local.id)) {
      seen.add(local.id);
      extensions.push(local);
    }
  }

  return extensions;
}

function listLocalExtensionDirs(): ExtensionInfo[] {
  const result: ExtensionInfo[] = [];
  try {
    if (!existsSync(EXTENSIONS_DIR)) return result;
    const entries = readdirSync(EXTENSIONS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = join(EXTENSIONS_DIR, entry.name);
      const pkgPath = join(fullPath, "package.json");
      const cfgPath = join(fullPath, "config.json");
      if (existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
          result.push({ id: entry.name, name: pkg.displayName || pkg.name || entry.name, version: pkg.version || "0.0.0", enabled: pkg.enabled !== false, description: pkg.description });
        } catch { /* skip */ }
      } else if (existsSync(cfgPath)) {
        try {
          const cfg = JSON.parse(readFileSync(cfgPath, "utf-8"));
          result.push({ id: entry.name, name: cfg.displayName || cfg.name || entry.name, version: cfg.version || "0.0.0", enabled: cfg.enabled !== false, description: cfg.description });
        } catch { /* skip */ }
      } else {
        result.push({ id: entry.name, name: entry.name, version: "0.0.0", enabled: true });
      }
    }
  } catch { /* skip */ }
  return result;
}

// List extensions
router.get("/extensions", async (_req, res) => {
  try {
    const extensions = await listExtensions();
    res.json({ extensions });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Install extension from path
router.post("/extensions/install", async (req, res) => {
  try {
    const { path } = req.body;
    if (!path) return res.status(400).json({ error: "path required" });

    if (!existsSync(EXTENSIONS_DIR)) {
      mkdirSync(EXTENSIONS_DIR, { recursive: true });
    }

    // Simple copy: treat the path as a folder to symlink/copy
    if (!existsSync(path)) {
      return res.status(400).json({ error: `Path not found: ${path}` });
    }

    const name = basename(path);
    const dest = join(EXTENSIONS_DIR, name);

    if (existsSync(dest)) {
      return res.status(400).json({ error: `Extension "${name}" already installed` });
    }

    // Copy directory recursively
    cpSync(path, dest, { recursive: true });

    // Try to read manifest
    const pkgPath = join(dest, "package.json");
    let displayName = name;
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        displayName = pkg.displayName || pkg.name || name;
      } catch {}
    }

    res.json({ ok: true, name: displayName, id: name });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Toggle extension enabled/disabled
router.post("/extensions/:id/toggle", (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    const extDir = join(EXTENSIONS_DIR, id);
    if (!existsSync(extDir)) {
      return res.status(404).json({ error: "Extension not found" });
    }

    const pkgPath = join(extDir, "package.json");
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      pkg.enabled = enabled;
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf-8");
    }

    res.json({ ok: true, enabled });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
