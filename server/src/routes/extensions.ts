import { Router } from "express";
import { readdirSync, existsSync, readFileSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import { join, basename } from "node:path";
import { agentDir } from "../config.js";

const router = Router();

const EXTENSIONS_DIR = join(agentDir, "extensions");
const GIT_DIR = join(agentDir, "git");

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

  // Scan installed extensions directory
  scanExtensionsDir(EXTENSIONS_DIR, result);

  // Scan git-cloned extensions (pi installs via git here)
  if (existsSync(GIT_DIR)) {
    try {
      scanGitDir(GIT_DIR, "", result);
    } catch (e: any) {
      console.error(`[extensions] Failed to scan git dir ${GIT_DIR}:`, e.message);
    }
  }

  return result;
}

function scanGitDir(dir: string, prefix: string, result: ExtensionInfo[]) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = join(dir, entry.name);
      const displayPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;

      // Check if this directory has extensions/ subdir
      const extSubdir = join(fullPath, "extensions");
      if (existsSync(extSubdir)) {
        scanExtensionsDir(extSubdir, result, displayPrefix);
      }

      // Check if this directory IS an extension (has package.json or config.json)
      const repoPkg = join(fullPath, "package.json");
      const repoCfg = join(fullPath, "config.json");
      if (existsSync(repoPkg) || existsSync(repoCfg)) {
        readExtensionManifest(fullPath, entry.name, displayPrefix, result);
      }

      // Recurse deeper (for github.com/org/repo structures)
      // Stop at 4 levels to avoid infinite recursion
      const depth = displayPrefix.split("/").length;
      if (depth < 4) {
        scanGitDir(fullPath, displayPrefix, result);
      }
    }
  } catch (e: any) {
    console.error(`[extensions] Failed to scan ${dir}:`, e.message);
  }
}

function scanExtensionsDir(dir: string, result: ExtensionInfo[], prefix = "") {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const displayId = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        // Directory-based extension (has its own manifest)
        readExtensionManifest(fullPath, entry.name, displayId, result);
      } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".js") || entry.name.endsWith(".mjs"))) {
        // Single-file extension (pi SDK format)
        const extName = entry.name.replace(/\.(ts|js|mjs)$/, "");
        result.push({
          id: prefix ? `${prefix}/${extName}` : extName,
          name: extName,
          version: "0.0.0",
          enabled: true,
          description: `File extension`,
        });
      }
    }
  } catch (e: any) {
    console.error(`[extensions] Failed to read ${dir}:`, e.message);
  }
}

function readExtensionManifest(fullPath: string, name: string, displayId: string, result: ExtensionInfo[]) {
  const manifestPath = join(fullPath, "package.json");
  const configPath = join(fullPath, "config.json");

  if (existsSync(manifestPath)) {
    try {
      const pkg = JSON.parse(readFileSync(manifestPath, "utf-8"));
      result.push({
        id: displayId,
        name: pkg.displayName || pkg.name || name,
        version: pkg.version || "0.0.0",
        enabled: pkg.enabled !== false,
        description: pkg.description,
      });
    } catch (e: any) {
      console.error(`[extensions] Failed to parse ${manifestPath}:`, e.message);
    }
  } else if (existsSync(configPath)) {
    try {
      const cfg = JSON.parse(readFileSync(configPath, "utf-8"));
      result.push({
        id: displayId,
        name: cfg.displayName || cfg.name || name,
        version: cfg.version || "0.0.0",
        enabled: cfg.enabled !== false,
        description: cfg.description,
      });
    } catch (e: any) {
      console.error(`[extensions] Failed to parse ${configPath}:`, e.message);
    }
  } else {
    // No manifest — list it anyway
    result.push({
      id: displayId,
      name: name,
      version: "0.0.0",
      enabled: true,
      description: "No manifest",
    });
  }
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
