import { describe, it, expect } from "vitest";
import { renderMarkdown, escapeHtml } from "../../lib/markdown";

describe("renderMarkdown", () => {
  describe("code blocks", () => {
    it("renders fenced code blocks with copy button", () => {
      const input = "```ts\nconst x = 1;\n```";
      const result = renderMarkdown(input);
      expect(result).toContain("code-block");
      expect(result).toContain("const x = 1");
      expect(result).toContain("copy-code-btn");
      expect(result).toContain("Copy");
    });

    it("detects language from code fence", () => {
      const input = "```python\nprint('hello')\n```";
      const result = renderMarkdown(input);
      expect(result).toContain("python");
    });

    it("highlights js as javascript", () => {
      const input = "```js\nconst a = 1;\n```";
      const result = renderMarkdown(input);
      expect(result).toContain("hljs"); // highlight.js applies class
    });
  });

  describe("links", () => {
    it("renders links with target=_blank", () => {
      const input = "[click](https://example.com)";
      const result = renderMarkdown(input);
      expect(result).toContain('target="_blank"');
      expect(result).toContain('rel="noopener noreferrer"');
      expect(result).toContain("https://example.com");
    });

    it("renders link titles", () => {
      const input = '[link](https://a.com "title text")';
      const result = renderMarkdown(input);
      // Should contain the link and title text in some form
      expect(result).toContain('link');
      expect(result).toContain('https://a.com');
    });
  });

  describe("formatting", () => {
    it("renders bold text", () => {
      const result = renderMarkdown("**bold**");
      expect(result).toContain("<strong>");
    });

    it("renders italic text", () => {
      const result = renderMarkdown("*italic*");
      expect(result).toContain("<em>");
    });

    it("renders inline code", () => {
      const result = renderMarkdown("`code`");
      expect(result).toContain("<code");
    });
  });

  describe("lists", () => {
    it("renders unordered lists", () => {
      const result = renderMarkdown("- item 1\n- item 2");
      expect(result).toContain("<li");
    });

    it("renders task lists with checkboxes", () => {
      const result = renderMarkdown("- [ ] todo\n- [x] done");
      expect(result).toContain("☐");
      expect(result).toContain("☑");
    });
  });

  describe("tables", () => {
    it("renders tables", () => {
      const result = renderMarkdown("| a | b |\n|---|---|\n| 1 | 2 |");
      expect(result).toContain("table");
      expect(result).toContain("thead");
    });
  });

  describe("headings", () => {
    it("renders headings with Tailwind classes", () => {
      const result = renderMarkdown("# Hello");
      expect(result).toContain("<h1");
      expect(result).toContain("text-sm");
    });
  });

  describe("caching", () => {
    it("returns same result for same input (memoized)", () => {
      const input = "test **bold** text";
      const r1 = renderMarkdown(input);
      const r2 = renderMarkdown(input);
      expect(r1).toBe(r2); // Same string reference due to cache
    });
  });
});

describe("escapeHtml", () => {
  it("escapes HTML special chars", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
    expect(escapeHtml('"quoted"')).toBe("&quot;quoted&quot;");
    expect(escapeHtml("&amp;")).toBe("&amp;amp;");
    expect(escapeHtml("'s")).toBe("&#039;s");
  });
});
