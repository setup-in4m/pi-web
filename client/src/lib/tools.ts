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
}

export function renderToolStart({ toolName, toolInput }: ToolStart): string {
  const type = classifyTool(toolName);
  const icon = toolIcon(type);
  const label = toolLabel(type, toolInput);

  return `<div class="tool-card tool-running my-1 px-2 py-1.5 rounded border border-[var(--color-bdl)] bg-[var(--color-bg2)]">
    <div class="flex items-center gap-1.5 text-[10px] text-[var(--color-warning)]">
      <span class="animate-spin inline-block">${icon}</span>
      <span class="font-medium">${label}</span>
    </div>
  </div>`;
}

export function renderToolEnd({ toolName, toolOutput }: ToolEnd): string {
  const type = classifyTool(toolName);
  const icon = toolIconDone(type);
  const label = toolLabelDone(type, toolName);
  const body = renderToolBody(type, toolOutput);

  return `<details class="tool-card my-1 px-2 py-1.5 rounded border border-[var(--color-bdl)] bg-[var(--color-bg2)]" open>
    <summary class="text-[10px] text-[var(--color-t2)] cursor-pointer hover:text-[var(--color-t1)] select-none flex items-center gap-1.5">
      <span>${icon}</span>
      <span>${label}</span>
    </summary>
    ${body}
  </details>`;
}

function toolIcon(type: ToolType): string {
  switch (type) {
    case "read": return "📖";
    case "write": return "✍";
    case "edit": return "🔧";
    case "bash": return "⚡";
    case "grep": return "🔍";
    case "find": return "🔎";
    case "ls": return "📂";
    default: return "⚙";
  }
}

function toolIconDone(type: ToolType): string {
  switch (type) {
    case "read": return "📖";
    case "write": return "✅";
    case "edit": return "✅";
    case "bash": return "⚡";
    case "grep": return "🔍";
    case "find": return "🔎";
    case "ls": return "📂";
    default: return "✅";
  }
}

function toolLabel(type: ToolType, input?: unknown): string {
  const path = extractPath(input);
  switch (type) {
    case "read": return path ? `Reading ${path}` : "Reading file…";
    case "write": return path ? `Writing ${path}` : "Writing file…";
    case "edit": return path ? `Editing ${path}` : "Editing file…";
    case "bash": return extractCommand(input) || "Running command…";
    case "grep": return "Searching…";
    case "find": return "Finding files…";
    case "ls": return "Listing directory…";
    default: return "Running tool…";
  }
}

function toolLabelDone(type: ToolType, name: string): string {
  switch (type) {
    case "read": return "File read";
    case "write": return "File written";
    case "edit": return "Edit applied";
    case "bash": return "Command completed";
    case "grep": return "Search results";
    case "find": return "Files found";
    case "ls": return "Directory listing";
    default: return `\`${name}\` completed`;
  }
}

function renderToolBody(type: ToolType, output: string): string {
  const truncated = output.length > 5000 ? output.slice(0, 5000) + "\n…(truncated)" : output;
  const escaped = escapeHtml(truncated);

  switch (type) {
    case "bash":
      return `<div class="mt-1 text-[10px]">
        <div class="text-[var(--color-t3)] text-[9px] mb-0.5">Output:</div>
        <pre class="p-1.5 bg-[#0d1117] rounded border border-[var(--color-bd)] overflow-x-auto max-h-[300px] overflow-y-auto text-[11px] leading-relaxed"><code>${escaped}</code></pre>
      </div>`;
    case "read":
      return `<div class="mt-1 text-[10px]">
        <pre class="p-1.5 bg-[#0d1117] rounded border border-[var(--color-bd)] overflow-x-auto max-h-[350px] overflow-y-auto text-[11px] leading-relaxed"><code>${escaped}</code></pre>
      </div>`;
    case "grep":
    case "find":
      return `<div class="mt-1">
        <pre class="p-1.5 bg-[#0d1117] rounded border border-[var(--color-bd)] overflow-x-auto max-h-[250px] overflow-y-auto text-[11px] leading-relaxed"><code>${escaped}</code></pre>
      </div>`;
    default:
      return `<div class="mt-1">
        <pre class="p-1.5 bg-[#0d1117] rounded border border-[var(--color-bd)] overflow-x-auto max-h-[300px] overflow-y-auto text-[11px] leading-relaxed"><code>${escaped}</code></pre>
      </div>`;
  }
}

function extractPath(input: unknown): string | null {
  if (!input) return null;
  if (typeof input === "string") {
    // Try to extract file path patterns
    const match = input.match(/[^\s"']+\.[a-zA-Z]{1,6}/);
    if (match) return match[0];
    const dirMatch = input.match(/[^\s"']+\/[^\s"']+/);
    if (dirMatch) return dirMatch[0];
    return input.length < 80 ? input : null;
  }
  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;
    if (obj.filePath) return String(obj.filePath);
    if (obj.path) return String(obj.path);
    if (obj.file_path) return String(obj.file_path);
  }
  return null;
}

function extractCommand(input: unknown): string {
  if (!input) return "Running command…";
  if (typeof input === "string") return `\`${input.slice(0, 60)}${input.length > 60 ? "…" : ""}\``;
  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;
    if (obj.command) return `\`${String(obj.command).slice(0, 60)}\``;
  }
  return "Running command…";
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
