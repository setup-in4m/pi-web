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

export function renderToolStart({ toolName, toolInput }: ToolStart): string {
  const type = classifyTool(toolName);
  const icon = toolIcon(type);
  const label = toolLabel(type, toolInput);

  return `<div class="tool-card tool-running my-1 px-2 py-1.5 rounded border border-[var(--color-bdl)] bg-[var(--color-bg2)]"><div class="flex items-center gap-1.5 text-[10px] text-[var(--color-warning)]"><span class="animate-spin inline-block">${icon}</span><span class="font-medium">${label}</span></div></div>`;
}

export function renderToolEnd({ toolName, toolOutput, durationMs }: ToolEnd): string {
  const type = classifyTool(toolName);
  const icon = toolIconDone(type);
  const label = toolLabelDone(type, toolName);
  const body = renderToolBody(type, toolOutput);
  const timeStr = durationMs != null ? `<span class="text-[8px] text-[var(--color-t3)] ml-auto">⏱ ${(durationMs / 1000).toFixed(1)}s</span>` : "";

  return `<details class="tool-card my-1 px-2 py-1.5 rounded border border-[var(--color-bdl)] bg-[var(--color-bg2)]" open><summary class="text-[10px] text-[var(--color-t2)] cursor-pointer hover:text-[var(--color-t1)] select-none flex items-center gap-1.5"><span>${icon}</span><span>${label}</span>${timeStr}</summary>${body}</details>`;
}

const SVG_READ = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
const SVG_WRITE = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>';
const SVG_EDIT = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
const SVG_BASH = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>';
const SVG_SEARCH = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>';
const SVG_FOLDER = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
const SVG_GEAR = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

function toolIcon(type: ToolType): string {
  switch (type) {
    case "read": return SVG_READ;
    case "write": return SVG_WRITE;
    case "edit": return SVG_EDIT;
    case "bash": return SVG_BASH;
    case "grep": return SVG_SEARCH;
    case "find": return SVG_SEARCH;
    case "ls": return SVG_FOLDER;
    default: return SVG_GEAR;
  }
}

function toolIconDone(type: ToolType): string {
  switch (type) {
    case "read": return SVG_READ;
    case "write": return SVG_WRITE;
    case "edit": return SVG_EDIT;
    case "bash": return SVG_BASH;
    case "grep": return SVG_SEARCH;
    case "find": return SVG_SEARCH;
    case "ls": return SVG_FOLDER;
    default: return SVG_GEAR;
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
  switch (type) {
    case "read": return renderReadBody(output);
    case "write":
    case "edit": return renderDiffBody(output);
    case "bash": return renderBashBody(output);
    case "grep":
    case "find": return renderResultsTable(output);
    case "ls": return renderFileTree(output);
    default: return renderGenericBody(output);
  }
}

// ── Read: content + line numbers ──────────────────────────

function renderReadBody(output: string): string {
  const truncated = output.length > 5000 ? output.slice(0, 5000) + "\n…(truncated)" : output;
  const lines = truncated.split("\n");
  const numWidth = String(lines.length).length;
  return `<div class="mt-1 overflow-auto max-h-[350px] rounded border border-[var(--color-bd)]">
    <table class="w-full text-[11px] leading-relaxed font-mono border-collapse">
      <tbody class="font-mono">
        ${lines.map((line, i) => `<tr class="${i % 2 === 0 ? "bg-[#0d1117]" : "bg-[#0a0e14]"}">
          <td class="text-right pr-3 pl-2 py-0 text-[#6e7681] select-none border-r border-[var(--color-bd)] align-top whitespace-nowrap" style="min-width:${numWidth + 2}ch">${i + 1}</td>
          <td class="pl-2 py-0 text-[var(--color-t1)] whitespace-pre-wrap break-all">${escapeHtml(line) || " "}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>`;
}

// ── Write/Edit: unified diff ──────────────────────────────

function renderDiffBody(output: string): string {
  const truncated = output.length > 5000 ? output.slice(0, 5000) + "\n…(truncated)" : output;
  const lines = truncated.split("\n");
  return `<div class="mt-1 overflow-auto max-h-[350px] rounded border border-[var(--color-bd)]">
    <table class="w-full text-[11px] leading-relaxed font-mono border-collapse">
      <tbody class="font-mono">
        ${lines.map((line) => {
          const esc = escapeHtml(line) || " ";
          if (line.startsWith("+")) return `<tr class="bg-[rgba(34,197,94,0.08)]"><td class="w-[1em] text-center text-[#22c55e] pl-2 py-0 select-none">+</td><td class="pl-1 py-0 text-[var(--color-t1)] whitespace-pre-wrap break-all">${esc}</td></tr>`;
          if (line.startsWith("-")) return `<tr class="bg-[rgba(239,68,68,0.08)]"><td class="w-[1em] text-center text-[#ef4444] pl-2 py-0 select-none">-</td><td class="pl-1 py-0 text-[var(--color-t1)] whitespace-pre-wrap break-all">${esc}</td></tr>`;
          if (line.startsWith("@@")) return `<tr class="bg-[rgba(59,130,246,0.08)]"><td class="text-[#3b82f6] pl-2 py-0 select-none">${esc}</td></tr>`;
          return `<tr class="bg-[#0d1117]"><td class="w-[1em] text-center text-[#6e7681] pl-2 py-0 select-none"> </td><td class="pl-1 py-0 text-[var(--color-t1)] whitespace-pre-wrap break-all">${esc}</td></tr>`;
        }).join("")}
      </tbody>
    </table>
  </div>`;
}

// ── Bash: command + exit code + stdout/stderr ─────────────

function renderBashBody(output: string): string {
  const truncated = output.length > 5000 ? output.slice(0, 5000) + "\n…(truncated)" : output;
  // Try to detect if output contains exit code info or stderr markers
  const hasError = /error|fail|command not found/i.test(truncated.slice(0, 500));
  const exitBadge = hasError
    ? `<span class="px-1 py-0 rounded text-[9px] font-medium bg-[rgba(239,68,68,0.15)] text-[#ef4444]">exit ≠ 0</span>`
    : `<span class="px-1 py-0 rounded text-[9px] font-medium bg-[rgba(34,197,94,0.12)] text-[#22c55e]">exit 0</span>`;

  return `<div class="mt-1">
    <div class="flex items-center gap-1.5 mb-1.5">
      <span class="text-[9px] text-[var(--color-t3)] uppercase">Output</span>
      ${exitBadge}
    </div>
    <pre class="p-1.5 bg-[#0d1117] rounded border border-[var(--color-bd)] overflow-x-auto max-h-[300px] overflow-y-auto text-[11px] leading-relaxed"><code>${escapeHtml(truncated)}</code></pre>
  </div>`;
}

// ── Grep/Find: results table ──────────────────────────────

function renderResultsTable(output: string): string {
  const truncated = output.length > 5000 ? output.slice(0, 5000) + "\n…(truncated)" : output;
  const lines = truncated.split("\n").filter(Boolean);

  // Parse common grep output format: file:line:match  or  file: line: match
  const parsed: { file: string; line: string; match: string }[] = [];
  for (const raw of lines) {
    // Strip ANSI codes
    const clean = raw.replace(/\x1b\[[0-9;]*m/g, "");
    const match = clean.match(/^(.+?):(\d+):\s*(.*)$/);
    if (match) {
      parsed.push({ file: match[1], line: match[2], match: match[3] });
    } else if (clean.trim()) {
      parsed.push({ file: "", line: "", match: clean });
    }
  }

  if (parsed.length === 0) {
    return `<div class="mt-1 text-[10px] text-[var(--color-t3)]">No matches found</div>`;
  }

  return `<div class="mt-1 overflow-auto max-h-[250px] rounded border border-[var(--color-bd)]">
    <table class="w-full text-[10px] leading-relaxed border-collapse">
      <thead class="sticky top-0 bg-[var(--color-bg3)] text-[var(--color-t2)] font-medium">
        <tr>
          <th class="text-left px-2 py-0.5 border-b border-[var(--color-bd)]">File</th>
          <th class="text-right px-2 py-0.5 border-b border-[var(--color-bd)] w-[4ch]">#</th>
          <th class="text-left px-2 py-0.5 border-b border-[var(--color-bd)]">Match</th>
        </tr>
      </thead>
      <tbody>
        ${parsed.slice(0, 200).map((row, i) =>
          `<tr class="${i % 2 === 0 ? "bg-[#0d1117]" : "bg-[#0a0e14]"}">
            <td class="px-2 py-0 font-mono text-[var(--color-accent)] whitespace-nowrap">${escapeHtml(row.file)}</td>
            <td class="px-2 py-0 text-right text-[#6e7681] font-mono">${escapeHtml(row.line)}</td>
            <td class="px-2 py-0 text-[var(--color-t1)] font-mono whitespace-pre-wrap break-all">${escapeHtml(row.match)}</td>
          </tr>`
        ).join("")}
      </tbody>
    </table>
  </div>`;
}

// ── Ls: file tree ─────────────────────────────────────────

function renderFileTree(output: string): string {
  const truncated = output.length > 5000 ? output.slice(0, 5000) + "\n…(truncated)" : output;
  const lines = truncated.split("\n").filter(l => l.trim());

  // Split into dirs and files, sort alphabetically
  const dirs: string[] = [];
  const files: string[] = [];
  for (const line of lines) {
    const clean = line.replace(/\x1b\[[0-9;]*m/g, "").replace(/^\s*[-–*>·]\s*/, "").trim();
    if (!clean) continue;
    // Heuristic: entries ending with / or containing no . are dirs
    if (clean.endsWith("/") || clean.endsWith("\\") || !clean.includes(".")) {
      dirs.push(clean.replace(/[/\\]$/, ""));
    } else {
      files.push(clean);
    }
  }

  if (dirs.length === 0 && files.length === 0) {
    return `<div class="mt-1"><pre class="p-1.5 bg-[#0d1117] rounded border border-[var(--color-bd)] overflow-x-auto max-h-[300px] overflow-y-auto text-[11px] leading-relaxed"><code>${escapeHtml(truncated)}</code></pre></div>`;
  }

  const dirHtml = dirs.sort().map(d =>
    `<div class="flex items-center gap-1 py-0 hover:bg-[var(--color-bgh)] px-1 rounded"><span class="text-xs">📁</span><span class="text-[11px] font-mono text-[var(--color-accent)]">${escapeHtml(d)}/</span></div>`
  ).join("");
  const fileHtml = files.sort().map(f =>
    `<div class="flex items-center gap-1 py-0 hover:bg-[var(--color-bgh)] px-1 rounded"><span class="text-xs">📄</span><span class="text-[11px] font-mono text-[var(--color-t1)]">${escapeHtml(f)}</span></div>`
  ).join("");

  const total = dirs.length + files.length;
  return `<div class="mt-1 overflow-auto max-h-[300px] rounded border border-[var(--color-bd)] bg-[#0d1117] p-1.5">
    ${dirHtml}
    ${dirHtml && fileHtml ? "" : ""}
    ${fileHtml}
    <div class="text-[9px] text-[var(--color-t3)] mt-1 pt-1 border-t border-[var(--color-bd)]">${dirs.length} dirs, ${files.length} files (${total} total)</div>
  </div>`;
}

// ── Generic fallback ──────────────────────────────────────

function renderGenericBody(output: string): string {
  const truncated = output.length > 5000 ? output.slice(0, 5000) + "\n…(truncated)" : output;
  return `<div class="mt-1">
    <pre class="p-1.5 bg-[#0d1117] rounded border border-[var(--color-bd)] overflow-x-auto max-h-[300px] overflow-y-auto text-[11px] leading-relaxed"><code>${escapeHtml(truncated)}</code></pre>
  </div>`;
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
