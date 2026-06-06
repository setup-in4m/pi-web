import type { PanelData } from "../../stores/panelStore";
import { PanelHeader } from "./PanelHeader";
import { ChatView } from "../chat/ChatView";
import { Composer } from "../composer/Composer";

interface Props {
  panel: PanelData;
  isActive: boolean;
  panelIndex: number;
}

export function Panel({ panel, isActive, panelIndex }: Props) {
  const hasWorkspace = !!panel.workspacePath;

  return (
    <div
      data-panel-active={isActive ? "true" : undefined}
      className={`flex flex-col h-full bg-[var(--color-bg)] overflow-hidden min-w-0 min-h-0 px-3`}
    >
      <PanelHeader panel={panel} panelIndex={panelIndex} />
      <ChatView panel={panel} panelIndex={panelIndex} />
      <Composer panelIndex={panelIndex} disabled={!hasWorkspace || panel.streaming} />
    </div>
  );
}
