import { useEffect } from "react";
import { useWorkspaceStore } from "./stores/workspaceStore";
import { useModelStore } from "./stores/modelStore";
import { connect as wsConnect } from "./lib/ws";
import { AppShell } from "./components/layout/AppShell";
import { SidebarSkeleton } from "./components/Skeletons";
import { PanelSkeleton } from "./components/Skeletons";
import { useKeyboard } from "./hooks/useKeyboard";

export default function App() {
  const loadWorkspaces = useWorkspaceStore((s) => s.loadWorkspaces);
  const loadModels = useModelStore((s) => s.loadModels);
  const loading = useWorkspaceStore((s) => s.loading);

  useEffect(() => {
    loadWorkspaces();
    loadModels();
    wsConnect();
  }, [loadWorkspaces, loadModels]);

  useKeyboard();

  if (loading) {
    return (
      <div className="flex h-full w-full">
        <SidebarSkeleton />
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-0.5 px-2 py-0.5 bg-[var(--color-bg2)] border-b border-[var(--color-bd)] min-h-[28px]" />
          <div className="flex-1 grid gap-0.5 bg-[var(--color-bd)] overflow-hidden min-h-0 grid-cols-1">
            <PanelSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return <AppShell />;
}
