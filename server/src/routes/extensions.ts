import { Router } from "express";
import { readdirSync, existsSync, readFileSync, writeFileSync, mkdirSync, cpSync, unlinkSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { agentDir } from "../config.js";
import { SettingsManager, type PackageSource } from "@earendil-works/pi-coding-agent";

const router = Router();
const EXTENSIONS_DIR = join(agentDir, "extensions");
const DISABLED_PATH = join(agentDir, "pi-web-disabled-packages.json");

// --- Disabled packages tracking (pi-web own store, preserves full PackageSource config) ---

function loadDisabled(): PackageSource[] {
  try {
    if (existsSync(DISABLED_PATH)) {
      const data = JSON.parse(readFileSync(DISABLED_PATH, "utf-8"));
      return Array.isArray(data.disabled) ? data.disabled : [];
    }
  } catch { /* corrupt file */ }
  return [];
}

function saveDisabled(pkgs: PackageSource[]): void {
  const dir = dirname(DISABLED_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(DISABLED_PATH, JSON.stringify({ disabled: pkgs }, null, 2), "utf-8");
}

function disabledSources(): string[] {
  return loadDisabled().map(pkgSource);
}

function disabledSourceSet(): Set<string> {
  return new Set(disabledSources());
}

function pkgId(source: string): string {
  return source.replace(/[:\/]/g, "-");
}

function pkgSource(pkg: PackageSource): string {
  return typeof pkg === "string" ? pkg : (pkg as any).source || String(pkg);
}

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
  const disabledSet = disabledSourceSet();

  try {
    // Read from pi's settings.json (same source as pi CLI)
    const settings = SettingsManager.create(process.cwd(), agentDir);
    const packages = settings.getPackages();
    const extPaths = settings.getExtensionPaths();

    // Map configured packages (skip disabled ones)
    for (const pkg of packages) {
      const sourceStr = pkgSource(pkg);
      if (disabledSet.has(sourceStr)) continue;
      const id = pkgId(sourceStr);
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

  // Show disabled packages so they can be re-enabled
  for (const pkg of loadDisabled()) {
    const sourceStr = pkgSource(pkg);
    const id = pkgId(sourceStr);
    if (seen.has(id)) continue;
    seen.add(id);
    extensions.push({
      id,
      name: sourceStr,
      version: "0.0.0",
      enabled: false,
      description: "Disabled package",
    });
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
        // No manifest — read enabled state from sidecar file
        const sidecarPath = join(fullPath, ".pi-web-enabled");
        const manualEnabled = !existsSync(sidecarPath);
        result.push({ id: entry.name, name: entry.name, version: "0.0.0", enabled: manualEnabled });
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
// Handles both local extensions (extensions/ dir) and pi-managed packages (settings.json)
router.post("/extensions/:id/toggle", async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    // 1. Try local extension directory (package.json or config.json toggle)
    const extDir = join(EXTENSIONS_DIR, id);
    if (existsSync(extDir)) {
      const pkgPath = join(extDir, "package.json");
      const cfgPath = join(extDir, "config.json");
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        pkg.enabled = enabled;
        writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf-8");
        return res.json({ ok: true, enabled });
      }
      if (existsSync(cfgPath)) {
        const cfg = JSON.parse(readFileSync(cfgPath, "utf-8"));
        cfg.enabled = enabled;
        writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), "utf-8");
        return res.json({ ok: true, enabled });
      }
      // Directory exists but no known manifest — toggle anyway via a sidecar file
      const sidecarPath = join(extDir, ".pi-web-enabled");
      if (enabled) {
        if (existsSync(sidecarPath)) {
          try { unlinkSync(sidecarPath); } catch {}
        }
      } else {
        writeFileSync(sidecarPath, "disabled", "utf-8");
      }
      return res.json({ ok: true, enabled });
    }

    // 2. Try pi-managed packages (settings.json packages array)
    const settings = SettingsManager.create(process.cwd(), agentDir);
    const currentPkgs = settings.getPackages();
    const currentDisabled = loadDisabled();
    const disabledSrcSet = new Set(currentDisabled.map(pkgSource));

    // Find matching source by reverse-mapping the URL id back to a source string
    const findSource = (sources: string[]): string | undefined =>
      sources.find((s) => pkgId(s) === id);

    let source = findSource(currentPkgs.map(pkgSource));
    let disabledPkg: PackageSource | undefined;
    if (!source && enabled) {
      // Re-enabling a previously disabled package
      disabledPkg = currentDisabled.find((p) => pkgId(pkgSource(p)) === id);
      if (disabledPkg) source = pkgSource(disabledPkg);
    }
    if (!source && !enabled) {
      // Disabling a package that might already be disabled (idempotent)
      disabledPkg = currentDisabled.find((p) => pkgId(pkgSource(p)) === id);
      if (disabledPkg) return res.json({ ok: true, enabled }); // already disabled
    }

    if (!source) {
      return res.status(404).json({ error: "Extension not found" });
    }

    if (enabled) {
      // Enable: restore full PackageSource to settings, remove from disabled
      const restored = disabledPkg || source;
      saveDisabled(currentDisabled.filter((p) => pkgSource(p) !== source));
      if (!currentPkgs.some((p) => pkgSource(p) === source)) {
        settings.setPackages([...currentPkgs, restored]);
        await settings.flush();
      }
    } else {
      // Disable: save full PackageSource in disabled, remove from settings.packages
      const fullPkg = currentPkgs.find((p) => pkgSource(p) === source);
      if (!disabledSrcSet.has(source!)) {
        saveDisabled([...currentDisabled, fullPkg || source]);
      }
      const filtered = currentPkgs.filter((p) => pkgSource(p) !== source);
      if (filtered.length !== currentPkgs.length) {
        settings.setPackages(filtered);
        await settings.flush();
      }
    }

    res.json({ ok: true, enabled });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
