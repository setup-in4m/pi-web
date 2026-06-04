import { Router } from "express";
import { readdirSync, existsSync, readFileSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import { join, basename } from "node:path";
import { agentDir } from "../config.js";

const router = Router();

const EXTENSIONS_DIR = join(agentDir, "extensions");

function ensureDir() {
  if (!existsSync(EXTENSIONS_DIR)) {
    mkdirSync(EXTENSIONS_DIR, { recursive: true });
  }
}

interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  description?: string;
}

function listLocalExtensions(): ExtensionInfo[] {
  ensureDir();
  const result: ExtensionInfo[] = [];
  try {
    const entries = readdirSync(EXTENSIONS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = join(EXTENSIONS_DIR, entry.name, "package.json");
      if (existsSync(manifestPath)) {
        try {
          const pkg = JSON.parse(readFileSync(manifestPath, "utf-8"));
          result.push({
            id: entry.name,
            name: pkg.displayName || pkg.name || entry.name,
            version: pkg.version || "0.0.0",
            enabled: pkg.enabled !== false,
            description: pkg.description,
          });
        } catch {
          // Skip invalid
        }
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
  return result;
}

// List extensions
router.get("/extensions", (_req, res) => {
  try {
    const extensions = listLocalExtensions();
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

    ensureDir();

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
