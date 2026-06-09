import { describe, it, expect } from "vitest";
import { escapeHtml } from "../../lib/sanitize";
import { classifyTool } from "../../lib/tools";

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
    expect(classifyTool("foobar_baz_qux")).toBe("unknown");
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
