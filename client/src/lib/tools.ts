export type ToolType = "read" | "write" | "edit" | "bash" | "grep" | "find" | "ls" | "unknown";

export function classifyTool(toolName: string): ToolType {
  const lower = toolName.toLowerCase();
  if (lower.includes("read")) return "read";
  if (lower.includes("write")) return "write";
  if (lower.includes("edit")) return "edit";
  if (lower.includes("bash") || lower.includes("shell") || lower.includes("exec")) return "bash";
  if (lower.includes("grep")) return "grep";
  if (lower.includes("find")) return "find";
  if (lower.includes("ls") || lower.includes("list")) return "ls";
  return "unknown";
}

export interface ToolStart {
  toolName: string;
  toolInput?: unknown;
}

export interface ToolEnd {
  toolName: string;
  toolOutput: string;
  durationMs?: number;
}


