/**
 * Tauri native bridge — only active when running inside Tauri.
 * Falls back gracefully to web APIs when not in Tauri.
 */

let tauriInvoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;
let isTauri = false;

// Detect Tauri environment
try {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    isTauri = true;
  }
} catch {
  isTauri = false;
}

export function runningInTauri(): boolean {
  return isTauri;
}

async function getInvoke() {
  if (tauriInvoke) return tauriInvoke;
  try {
    const mod = await import("@tauri-apps/api/core");
    tauriInvoke = mod.invoke;
    return tauriInvoke;
  } catch {
    return null;
  }
}

// ── Dialog ─────────────────────────────────────────────────

export async function openFolder(): Promise<string | null> {
  if (!isTauri) return null; // fallback to server API

  try {
    const invoke = await getInvoke();
    if (!invoke) return null;

    const { open } = await import("@tauri-apps/plugin-dialog");
    const result = await open({
      directory: true,
      multiple: false,
      title: "Select project folder",
    });
    return result as string | null;
  } catch {
    return null;
  }
}

// ── Shell ──────────────────────────────────────────────────

export async function openExternal(url: string): Promise<void> {
  if (!isTauri) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  try {
    const invoke = await getInvoke();
    if (!invoke) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    const { open } = await import("@tauri-apps/plugin-shell");
    await open(url);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

// ── Global Shortcuts ───────────────────────────────────────

export async function registerGlobalShortcut(
  shortcut: string,
  handler: () => void
): Promise<(() => void) | (() => {})> {
  if (!isTauri) return () => {};

  try {
    const { register } = await import("@tauri-apps/plugin-global-shortcut");
    const unlisten = await register(shortcut, handler);
    return unlisten as unknown as () => void;
  } catch {
    return () => {};
  }
}

// ── Window ─────────────────────────────────────────────────

export async function setWindowTitle(title: string): Promise<void> {
  if (!isTauri) {
    document.title = title;
    return;
  }

  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setTitle(title);
  } catch {}
}
