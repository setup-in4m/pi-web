import { describe, it, expect } from "vitest";
import {
  classifyTool,
  renderToolStart,
  renderToolEnd,
  escapeHtml,
} from "../../lib/tools";

describe("classifyTool", () => {
  it("classifies read tools", () => {
    expect(classifyTool("read_file")).toBe("read");
    expect(classifyTool("Read")).toBe("read");
    expect(classifyTool("file_read")).toBe("read");
  });

  it("classifies write tools", () => {
    expect(classifyTool("write_file")).toBe("write");
    expect(classifyTool("Write")).toBe("write");
    expect(classifyTool("file_write")).toBe("write");
  });

  it("classifies edit tools", () => {
    expect(classifyTool("edit_file")).toBe("edit");
    expect(classifyTool("edit")).toBe("edit");
    expect(classifyTool("text_edit")).toBe("edit");
  });

  it("classifies bash tools", () => {
    expect(classifyTool("bash")).toBe("bash");
    expect(classifyTool("execute_shell")).toBe("bash");
    expect(classifyTool("exec_command")).toBe("bash");
  });

  it("classifies grep tools", () => {
    expect(classifyTool("grep")).toBe("grep");
    expect(classifyTool("search_grep")).toBe("grep");
  });

  it("classifies find tools", () => {
    expect(classifyTool("find_files")).toBe("find");
    expect(classifyTool("glob_find")).toBe("find");
  });

  it("classifies ls tools", () => {
    expect(classifyTool("ls")).toBe("ls");
    expect(classifyTool("list_directory")).toBe("ls");
  });

  it("returns unknown for unrecognized", () => {
    // Note: classifyTool uses .includes(), so avoid substrings like "ls" or "edit"
    expect(classifyTool("foobar_baz_qux")).toBe("unknown");
  });
});

describe("renderToolStart", () => {
  it("renders running tool card", () => {
    const result = renderToolStart({ toolName: "read_file", toolInput: { filePath: "/src/app.ts" } });
    expect(result).toContain("tool-running");
    expect(result).toContain("app.ts");
  });

  it("shows command for bash tools", () => {
    const result = renderToolStart({ toolName: "bash", toolInput: { command: "npm test" } });
    expect(result).toContain("npm test");
  });
});

describe("renderToolEnd", () => {
  it("renders collapsible tool card", () => {
    const result = renderToolEnd({ toolName: "read_file", toolOutput: "file contents here" });
    expect(result).toContain("<details");
    expect(result).toContain("file contents here");
  });

  it("renders bash output", () => {
    const result = renderToolEnd({ toolName: "bash", toolOutput: "test passed" });
    expect(result).toContain("test passed");
    expect(result).toContain("completed");
  });

  it("truncates large outputs", () => {
    const bigOutput = "x".repeat(6000);
    const result = renderToolEnd({ toolName: "read_file", toolOutput: bigOutput });
    expect(result).toContain("truncated");
    expect(result.length).toBeLessThan(bigOutput.length + 500);
  });
});

describe("escapeHtml", () => {
  it("escapes special chars", () => {
    expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
    expect(escapeHtml('"x"')).toBe("&quot;x&quot;");
    expect(escapeHtml("'s")).toBe("&#039;s");
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("preserves normal text", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });
});
