/**
 * Markdown Tests
 * Tests for markdown link creation and page title utilities
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { getPageTitle, createMarkdownLink, handleCopyMarkdownLink } from "./markdown.js";
import { resetChromeMocks } from "../../test/setup.js";

// Mock clipboard and toast modules
vi.mock("../clipboard.js", () => ({
  copyToClipboard: vi.fn(),
}));

vi.mock("../toast.js", () => ({
  showToast: vi.fn(),
}));

vi.mock("./url-cleaner.js", () => ({
  cleanUrl: vi.fn((url: string) => url),
}));

describe("Markdown Utilities", () => {
  beforeEach(() => {
    resetChromeMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getPageTitle", () => {
    it("should return the document title", () => {
      document.title = "Test Page Title";
      expect(getPageTitle()).toBe("Test Page Title");
    });

    it("should return 'Untitled' when document title is empty", () => {
      document.title = "";
      expect(getPageTitle()).toBe("Untitled");
    });

    it("should handle special characters in title", () => {
      document.title = "Title with [brackets] and (parens)";
      expect(getPageTitle()).toBe("Title with [brackets] and (parens)");
    });

    it("should handle unicode characters in title", () => {
      document.title = "日本語タイトル 🎉";
      expect(getPageTitle()).toBe("日本語タイトル 🎉");
    });
  });

  describe("createMarkdownLink", () => {
    it("should create a basic markdown link", () => {
      const result = createMarkdownLink("https://example.com", "Example Site");
      expect(result).toBe("[Example Site](https://example.com)");
    });

    it("should escape square brackets in title", () => {
      const result = createMarkdownLink("https://example.com", "Title [with] brackets");
      expect(result).toBe("[Title \\[with\\] brackets](https://example.com)");
    });

    it("should escape multiple square brackets", () => {
      const result = createMarkdownLink("https://example.com", "[a] and [b] and [c]");
      expect(result).toBe("[\\[a\\] and \\[b\\] and \\[c\\]](https://example.com)");
    });

    it("should handle empty title", () => {
      const result = createMarkdownLink("https://example.com", "");
      expect(result).toBe("[](https://example.com)");
    });

    it("should handle URL with special characters", () => {
      const result = createMarkdownLink("https://example.com/path?query=value&other=123", "Page");
      expect(result).toBe("[Page](https://example.com/path?query=value&other=123)");
    });

    it("should handle URL with parentheses", () => {
      const result = createMarkdownLink(
        "https://en.wikipedia.org/wiki/JavaScript_(programming_language)",
        "JavaScript",
      );
      expect(result).toBe(
        "[JavaScript](https://en.wikipedia.org/wiki/JavaScript_(programming_language))",
      );
    });

    it("should handle unicode in URL", () => {
      const result = createMarkdownLink("https://example.com/日本語", "Japanese Page");
      expect(result).toBe("[Japanese Page](https://example.com/日本語)");
    });

    it("should preserve nested brackets in title", () => {
      const result = createMarkdownLink("https://example.com", "[[nested]] brackets");
      expect(result).toBe("[\\[\\[nested\\]\\] brackets](https://example.com)");
    });

    it("should handle title with only brackets", () => {
      const result = createMarkdownLink("https://example.com", "[]");
      expect(result).toBe("[\\[\\]](https://example.com)");
    });

    it("should not escape parentheses in title", () => {
      const result = createMarkdownLink("https://example.com", "Title (subtitle)");
      expect(result).toBe("[Title (subtitle)](https://example.com)");
    });
  });

  describe("handleCopyMarkdownLink", () => {
    beforeEach(() => {
      Object.defineProperty(window, "location", {
        value: new URL("https://example.com/test"),
        writable: true,
        configurable: true,
      });
      document.title = "Test Page";
    });

    it("should copy markdown link and show success toast", async () => {
      const { copyToClipboard } = await import("../clipboard.js");
      const { showToast } = await import("../toast.js");

      vi.mocked(copyToClipboard).mockResolvedValue(true);

      await handleCopyMarkdownLink();

      expect(copyToClipboard).toHaveBeenCalledWith("[Test Page](https://example.com/test)");
      expect(showToast).toHaveBeenCalledWith("✓ Link copied");
    });

    it("should show error toast on copy failure", async () => {
      const { copyToClipboard } = await import("../clipboard.js");
      const { showToast } = await import("../toast.js");

      vi.mocked(copyToClipboard).mockResolvedValue(false);

      await handleCopyMarkdownLink();

      expect(copyToClipboard).toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith("× Failed to copy link");
    });

    it("should escape brackets in page title when copying", async () => {
      const { copyToClipboard } = await import("../clipboard.js");

      document.title = "Page [with] Brackets";
      vi.mocked(copyToClipboard).mockResolvedValue(true);

      await handleCopyMarkdownLink();

      expect(copyToClipboard).toHaveBeenCalledWith(
        "[Page \\[with\\] Brackets](https://example.com/test)",
      );
    });

    it("should use cleaned URL from url-cleaner", async () => {
      const { copyToClipboard } = await import("../clipboard.js");
      const { cleanUrl } = await import("./url-cleaner.js");

      vi.mocked(cleanUrl).mockReturnValue("https://cleaned.example.com");
      vi.mocked(copyToClipboard).mockResolvedValue(true);

      await handleCopyMarkdownLink();

      expect(cleanUrl).toHaveBeenCalledWith("https://example.com/test");
      expect(copyToClipboard).toHaveBeenCalledWith("[Test Page](https://cleaned.example.com)");
    });
  });

  describe("Edge Cases", () => {
    describe("malformed or unusual input", () => {
      it("should handle title with newlines", () => {
        const result = createMarkdownLink("https://example.com", "Title\nwith\nnewlines");
        expect(result).toBe("[Title\nwith\nnewlines](https://example.com)");
      });

      it("should handle title with tabs", () => {
        const result = createMarkdownLink("https://example.com", "Title\twith\ttabs");
        expect(result).toBe("[Title\twith\ttabs](https://example.com)");
      });

      it("should handle very long titles", () => {
        const longTitle = "A".repeat(1000);
        const result = createMarkdownLink("https://example.com", longTitle);
        expect(result).toBe(`[${longTitle}](https://example.com)`);
      });

      it("should handle very long URLs", () => {
        const longUrl = "https://example.com/" + "a".repeat(1000);
        const result = createMarkdownLink(longUrl, "Title");
        expect(result).toBe(`[Title](${longUrl})`);
      });

      it("should handle empty URL", () => {
        const result = createMarkdownLink("", "Title");
        expect(result).toBe("[Title]()");
      });

      it("should handle both empty URL and title", () => {
        const result = createMarkdownLink("", "");
        expect(result).toBe("[]()");
      });

      it("should handle title with backslashes", () => {
        const result = createMarkdownLink("https://example.com", "Path\\to\\file");
        expect(result).toBe("[Path\\to\\file](https://example.com)");
      });

      it("should handle title with markdown-like syntax", () => {
        const result = createMarkdownLink("https://example.com", "**bold** and *italic*");
        expect(result).toBe("[**bold** and *italic*](https://example.com)");
      });

      it("should handle title with pipes (table syntax)", () => {
        const result = createMarkdownLink("https://example.com", "Column | Value");
        expect(result).toBe("[Column | Value](https://example.com)");
      });
    });

    describe("special URL formats", () => {
      it("should handle data URLs", () => {
        const result = createMarkdownLink("data:text/html,<h1>Hello</h1>", "Data URL");
        expect(result).toBe("[Data URL](data:text/html,<h1>Hello</h1>)");
      });

      it("should handle file URLs", () => {
        const result = createMarkdownLink("file:///home/user/doc.html", "Local File");
        expect(result).toBe("[Local File](file:///home/user/doc.html)");
      });

      it("should handle URLs with fragments", () => {
        const result = createMarkdownLink("https://example.com/page#section-1", "Page Section");
        expect(result).toBe("[Page Section](https://example.com/page#section-1)");
      });

      it("should handle URLs with encoded characters", () => {
        const result = createMarkdownLink(
          "https://example.com/path%20with%20spaces",
          "Encoded URL",
        );
        expect(result).toBe("[Encoded URL](https://example.com/path%20with%20spaces)");
      });
    });
  });
});
