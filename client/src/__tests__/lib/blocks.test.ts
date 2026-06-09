import { describe, it, expect } from "vitest";
import { classifyTool } from "../../lib/tools";
import type { ContentBlock } from "../../lib/api";

describe("block architecture", () => {
  describe("classifyTool routing", () => {
    it("routes known tools to typed renderers", () => {
      expect(classifyTool("read_file")).toBe("read");
      expect(classifyTool("write")).toBe("write");
      expect(classifyTool("edit")).toBe("edit");
      expect(classifyTool("bash")).toBe("bash");
      expect(classifyTool("grep")).toBe("grep");
      expect(classifyTool("find_files")).toBe("find");
      expect(classifyTool("ls")).toBe("ls");
    });

    it("routes unknown tools to generic fallback", () => {
      expect(classifyTool("web_search")).toBe("unknown");
      expect(classifyTool("web_fetch")).toBe("unknown");
      expect(classifyTool("browser_navigate")).toBe("unknown");
      expect(classifyTool("some_custom_skill")).toBe("unknown");
      expect(classifyTool("fetch_content")).toBe("unknown");
    });
  });

  describe("ContentBlock type discrimination", () => {
    it("tool_start blocks have required fields", () => {
      const block: ContentBlock = {
        type: "tool_start",
        toolName: "read_file",
        toolInput: { filePath: "/src/app.ts" },
        toolCallId: "tc_abc123",
      };
      // TypeScript verifies these at compile time — test validates at runtime
      expect(block.type).toBe("tool_start");
      expect(block.toolName).toBe("read_file");
      expect(block.toolCallId).toBe("tc_abc123");
    });

    it("tool_end blocks have output and status", () => {
      const block: ContentBlock = {
        type: "tool_end",
        toolName: "read_file",
        toolOutput: "console.log('hello')",
        toolCallId: "tc_abc123",
        durationMs: 42,
        status: "success",
      };
      expect(block.type).toBe("tool_end");
      expect(block.status).toBe("success");
      expect(block.durationMs).toBe(42);
    });

    it("thinking blocks merge via upsert pattern", () => {
      const blocks: ContentBlock[] = [];
      // Simulate upsertBlock logic
      const newBlock: ContentBlock = { type: "thinking", content: "Let me think" };
      const last = blocks[blocks.length - 1];
      if (last && last.type === newBlock.type) {
        blocks[blocks.length - 1] = { ...last, content: last.content + newBlock.content };
      } else {
        blocks.push(newBlock);
      }
      // Second chunk should merge
      const nextBlock: ContentBlock = { type: "thinking", content: " about this" };
      const l = blocks[blocks.length - 1];
      if (l && l.type === nextBlock.type) {
        blocks[blocks.length - 1] = { ...l, content: l.content + nextBlock.content };
      } else {
        blocks.push(nextBlock);
      }
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe("thinking");
      expect(blocks[0].content).toBe("Let me think about this");
    });

    it("tool blocks do NOT merge (each is separate)", () => {
      const blocks: ContentBlock[] = [];
      blocks.push({ type: "tool_start", toolName: "read_file", toolInput: {}, toolCallId: "tc_1" });
      blocks.push({ type: "tool_end", toolName: "read_file", toolOutput: "ok", toolCallId: "tc_1", status: "success" });
      expect(blocks).toHaveLength(2);
      expect(blocks[0].type).toBe("tool_start");
      expect(blocks[1].type).toBe("tool_end");
    });

    it("subagent blocks have required fields", () => {
      const start: ContentBlock = {
        type: "subagent_start",
        subAgentId: "sub123",
        task: "Analyze the code",
      };
      expect(start.subAgentId).toBe("sub123");
      expect(start.task).toBe("Analyze the code");

      const end: ContentBlock = {
        type: "subagent_end",
        subAgentId: "sub123",
        task: "Analyze the code",
        result: "Analysis complete",
        usage: { inputTokens: 100, outputTokens: 50 },
      };
      expect(end.result).toBe("Analysis complete");
      expect(end.usage?.inputTokens).toBe(100);
    });

    it("text blocks remain simple", () => {
      const block: ContentBlock = {
        type: "text",
        content: "Here is the answer",
      };
      expect(block.type).toBe("text");
      expect(block.content).toBe("Here is the answer");
    });
  });
});
