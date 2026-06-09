import { classifyTool, type ToolType } from "../../../lib/tools";
import type { ContentBlock } from "../../../lib/api";
import { ToolRead } from "./ToolRead";
import { ToolWrite } from "./ToolWrite";
import { ToolBash } from "./ToolBash";
import { ToolSearch } from "./ToolSearch";
import { ToolLs } from "./ToolLs";
import { ToolGeneric } from "./ToolGeneric";

type ToolStartBlock = Extract<ContentBlock, { type: "tool_start" }>;
type ToolEndBlock = Extract<ContentBlock, { type: "tool_end" }>;

type Props = { block: ToolStartBlock | ToolEndBlock };

export function ToolBlock({ block }: Props) {
  const toolType = classifyTool(block.toolName);
  const isRunning = block.type === "tool_start";
  const shared = {
    toolName: block.toolName,
    isRunning,
    ...(block.type === "tool_end" ? {
      output: block.toolOutput,
      durationMs: block.durationMs,
      status: block.status,
    } : {}),
  };

  switch (toolType) {
    case "read":
      return <ToolRead {...shared} />;
    case "write":
    case "edit":
      return <ToolWrite {...shared} />;
    case "bash":
      return <ToolBash {...shared} />;
    case "grep":
    case "find":
      return <ToolSearch {...shared} />;
    case "ls":
      return <ToolLs {...shared} />;
    default:
      return <ToolGeneric {...shared} />;
  }
}
