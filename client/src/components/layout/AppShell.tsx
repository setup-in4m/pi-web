import { useState, useEffect, Suspense } from "react";
import { Minus, Square, X } from "lucide-react";
import { ErrorBoundary } from "../ErrorBoundary";
import { ToastContainer } from "../ToastContainer";
import { Sidebar } from "../sidebar/Sidebar";
import { TabBar } from "./TabBar";
import { PanelGrid } from "./PanelGrid";
import { useLayoutStore } from "../../stores/layoutStore";
import {
  runningInTauri,
  minimizeWindow,
  maximizeWindow,
  closeWindow,
  getDecorations,
  listenForTauriEvent,
} from "../../lib/tauri";
import { SettingsDialog, CommandPalette, WorkflowBuilder, LazyFallback } from "../../App";

export function AppShell() {
  const sidebarVisible = useLayoutStore((s) => s.sidebarVisible);
  const focusMode = useLayoutStore((s) => s.focusMode);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showCustomTitlebar, setShowCustomTitlebar] = useState(false);

  // Listen for titlebar decoration changes from Rust backend
  useEffect(() => {
    if (!runningInTauri()) return;

    getDecorations().then((decorated) => {
      setShowCustomTitlebar(!decorated);
    });

    let cleanup: (() => void) | undefined;
    listenForTauriEvent<boolean>("titlebar-changed", (decorated) => {
      setShowCustomTitlebar(!decorated);
    }).then((fn) => { cleanup = fn; });

    return () => {
      cleanup?.();
    };
  }, []);

  return (
    <div className="flex h-full w-full flex-col">
      {/* Skip-to-content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-1.5 focus:bg-[var(--color-accent)] focus:text-white focus:rounded focus:text-[11px] focus:font-medium focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Custom titlebar — shown when native decorations are disabled */}
      {showCustomTitlebar && (
        <div
          data-tauri-drag-region
          className="flex items-center justify-between h-8 bg-[var(--color-bg2)] border-b border-[var(--color-bd)] select-none flex-shrink-0"
        >
          <div className="flex items-center gap-2 px-3">
            <span className="text-[11px] font-semibold text-[var(--color-t2)] tracking-wide">
              pi
            </span>
            <span className="text-[9px] text-[var(--color-t3)]">v2</span>
          </div>
          <div className="flex h-full">
            <button
              onClick={minimizeWindow}
              className="w-10 h-full flex items-center justify-center text-[var(--color-t3)] hover:text-[var(--color-t1)] hover:bg-[var(--color-bgh)] transition-colors"
              aria-label="Minimize"
              tabIndex={-1}
            >
              <Minus size={14} aria-hidden="true" />
            </button>
            <button
              onClick={maximizeWindow}
              className="w-10 h-full flex items-center justify-center text-[var(--color-t3)] hover:text-[var(--color-t1)] hover:bg-[var(--color-bgh)] transition-colors"
              aria-label="Maximize"
              tabIndex={-1}
            >
              <Square size={12} aria-hidden="true" />
            </button>
            <button
              onClick={closeWindow}
              className="w-10 h-full flex items-center justify-center text-[var(--color-t3)] hover:text-white hover:bg-[var(--color-danger)] transition-colors"
              aria-label="Close"
              tabIndex={-1}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {!focusMode && sidebarVisible && (
          <ErrorBoundary>
            <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
          </ErrorBoundary>
        )}
        <div id="main-content" className="flex-1 flex flex-col min-w-0">
          <ErrorBoundary>
            <TabBar />
          </ErrorBoundary>
          <ErrorBoundary>
            <PanelGrid />
          </ErrorBoundary>
        </div>
      </div>
      <ToastContainer />
      <Suspense fallback={<LazyFallback />}>
        <CommandPalette />
      </Suspense>
      <Suspense fallback={<LazyFallback />}>
        <WorkflowBuilder />
      </Suspense>
      <Suspense fallback={<LazyFallback />}>
        <SettingsDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      </Suspense>
    </div>
  );
}
