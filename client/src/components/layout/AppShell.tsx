import { useState } from "react";
import { ErrorBoundary } from "../ErrorBoundary";
import { ToastContainer } from "../ToastContainer";
import { CommandPalette } from "../CommandPalette";
import { Sidebar } from "../sidebar/Sidebar";
import { TabBar } from "./TabBar";
import { PanelGrid } from "./PanelGrid";
import { useLayoutStore } from "../../stores/layoutStore";
import { SettingsDialog } from "../settings/SettingsDialog";

export function AppShell() {
  const sidebarVisible = useLayoutStore((s) => s.sidebarVisible);
  const focusMode = useLayoutStore((s) => s.focusMode);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex h-full w-full">
      {!focusMode && sidebarVisible && (
        <ErrorBoundary>
          <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
        </ErrorBoundary>
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <ErrorBoundary>
          <TabBar />
        </ErrorBoundary>
        <ErrorBoundary>
          <PanelGrid />
        </ErrorBoundary>
      </div>
      <ToastContainer />
      <CommandPalette />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
