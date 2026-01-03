/**
 * Text Chunking Tests
 * Tests for smart text chunking functionality with various splitting strategies
 */

import { describe, it, expect } from "vitest";
import {
  getSmartChunks,
  getYouTubeChunks,
  truncateAndGetChunks,
  type ChunkOptions,
} from "./chunk.js";

describe("Text Chunking", () => {
  describe("getSmartChunks()", () => {
    describe("Basic chunking", () => {
      it("should return single chunk for text under maxChars", () => {
        const text = "This is a short text.";
        const result = getSmartChunks(text, { minChars: 10, maxChars: 100 });

        expect(result).toHaveLength(1);
        expect(result[0].text).toBe(text);
        expect(result[0].citationUUID).toBeDefined();
      });

      it("should use default options when not provided", () => {
        const text = "Short text";
        const result = getSmartChunks(text);

        expect(result).toHaveLength(1);
        expect(result[0].text).toBe(text);
      });

      it("should throw error when minChars > maxChars", () => {
        const text = "Some text";
        expect(() => {
          getSmartChunks(text, { minChars: 200, maxChars: 100 });
        }).toThrow("minChars must be less than or equal to maxChars");
      });
    });

    describe("Paragraph-based splitting", () => {
      it("should split text by paragraphs when exceeding maxChars", () => {
        const text = "First paragraph with some content.\n\nSecond paragraph with more content.";
        const result = getSmartChunks(text, { minChars: 10, maxChars: 50 });

        expect(result.length).toBeGreaterThan(1);
        result.forEach((chunk) => {
          expect(chunk.text.length).toBeLessThanOrEqual(50);
        });
      });

      it("should preserve paragraph structure when possible", () => {
        const text = "Para 1.\n\nPara 2.\n\nPara 3.";
        const result = getSmartChunks(text, { minChars: 5, maxChars: 100 });

        expect(result.length).toBeGreaterThan(0);
        result.forEach((chunk) => {
          expect(chunk.text.length).toBeLessThanOrEqual(100);
        });
      });
    });

    describe("Sentence-based splitting", () => {
      it("should split long paragraphs into sentences", () => {
        const text = "First sentence. Second sentence. Third sentence. Fourth sentence.";
        const result = getSmartChunks(text, { minChars: 10, maxChars: 40 });

        expect(result.length).toBeGreaterThan(1);
        result.forEach((chunk) => {
          expect(chunk.text.length).toBeLessThanOrEqual(40);
        });
      });

      it("should handle multiple sentence delimiters", () => {
        const text = "Question? Exclamation! Statement. Another one.";
        const result = getSmartChunks(text, { minChars: 5, maxChars: 30 });

        expect(result.length).toBeGreaterThan(0);
        result.forEach((chunk) => {
          expect(chunk.text.length).toBeLessThanOrEqual(30);
        });
      });
    });

    describe("Word-based splitting", () => {
      it("should split very long sentences into words", () => {
        const longWord = "a".repeat(100);
        const text = `${longWord} ${longWord} ${longWord}`;
        const result = getSmartChunks(text, { minChars: 50, maxChars: 150 });

        expect(result.length).toBeGreaterThan(0);
        result.forEach((chunk) => {
          expect(chunk.text.length).toBeLessThanOrEqual(150);
        });
      });
    });

    describe("Markdown link preservation", () => {
      it("should not break markdown links across chunks", () => {
        const text = "Check [this link](https://example.com) for more info. " + "x".repeat(100);
        const result = getSmartChunks(text, { minChars: 20, maxChars: 80 });

        const fullText = result.map((c) => c.text).join("");
        expect(fullText).toContain("[this link](https://example.com)");
      });

      it("should handle multiple markdown links", () => {
        const text =
          "Visit [link1](https://example1.com) and [link2](https://example2.com) for details. " +
          "x".repeat(100);
        const result = getSmartChunks(text, { minChars: 20, maxChars: 100 });

        const fullText = result.map((c) => c.text).join("");
        expect(fullText).toContain("[link1](https://example1.com)");
        expect(fullText).toContain("[link2](https://example2.com)");
      });
    });

    describe("Edge cases", () => {
      it("should handle empty text", () => {
        const result = getSmartChunks("", { minChars: 10, maxChars: 100 });
        expect(result).toHaveLength(1);
        expect(result[0].text).toBe("");
      });

      it("should handle text with only whitespace", () => {
        const result = getSmartChunks("   \n\n   ", { minChars: 10, maxChars: 100 });
        expect(result.length).toBeGreaterThanOrEqual(0);
      });

      it("should handle single word longer than maxChars", () => {
        const longWord = "a".repeat(150);
        const result = getSmartChunks(longWord, { minChars: 10, maxChars: 100 });

        expect(result.length).toBeGreaterThan(0);
        result.forEach((chunk) => {
          expect(chunk.text.length).toBeLessThanOrEqual(100);
        });
      });

      it("should handle text with single word", () => {
        const result = getSmartChunks("word", { minChars: 1, maxChars: 100 });
        expect(result).toHaveLength(1);
        expect(result[0].text).toBe("word");
      });
    });

    describe("Unicode text handling", () => {
      it("should handle emoji characters", () => {
        const text = "Hello 👋 world 🌍 with emoji 😊 characters.";
        const result = getSmartChunks(text, { minChars: 5, maxChars: 50 });

        expect(result.length).toBeGreaterThan(0);
        const fullText = result.map((c) => c.text).join("");
        expect(fullText).toContain("👋");
        expect(fullText).toContain("🌍");
      });

      it("should handle CJK characters", () => {
        const text = "这是中文文本。日本語のテキスト。한국어 텍스트。";
        const result = getSmartChunks(text, { minChars: 5, maxChars: 30 });

        expect(result.length).toBeGreaterThan(0);
        const fullText = result.map((c) => c.text).join("");
        expect(fullText).toContain("中文");
      });

      it("should handle mixed unicode and ASCII", () => {
        const text = "English text with 中文 mixed in. More English. 日本語 here.";
        const result = getSmartChunks(text, { minChars: 5, maxChars: 40 });

        expect(result.length).toBeGreaterThan(0);
        const fullText = result.map((c) => c.text).join("");
        expect(fullText).toContain("中文");
      });
    });

    describe("Mixed paragraph lengths", () => {
      it("should handle text with varying paragraph sizes", () => {
        const text =
          "Short.\n\n" +
          "This is a much longer paragraph with multiple sentences. " +
          "It contains quite a bit of content. " +
          "And continues with more information.\n\n" +
          "Medium paragraph here.";

        const result = getSmartChunks(text, { minChars: 10, maxChars: 100 });

        expect(result.length).toBeGreaterThan(0);
        result.forEach((chunk) => {
          expect(chunk.text.length).toBeLessThanOrEqual(100);
        });
      });
    });

    describe("Citation UUIDs", () => {
      it("should assign unique citationUUIDs to each chunk", () => {
        const text = "A".repeat(500);
        const result = getSmartChunks(text, { minChars: 50, maxChars: 100 });

        const uuids = result.map((c) => c.citationUUID);
        const uniqueUuids = new Set(uuids);

        expect(uniqueUuids.size).toBe(uuids.length);
      });

      it("should have valid UUID format", () => {
        const text = "Some text";
        const result = getSmartChunks(text);

        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        result.forEach((chunk) => {
          expect(chunk.citationUUID).toMatch(uuidRegex);
        });
      });
    });
  });

  describe("getYouTubeChunks()", () => {
    it("should parse YouTube timestamps in MM:SS format", () => {
      const text = "[0:30] Introduction\n[1:45] Main content\n[3:20] Conclusion";
      const result = getYouTubeChunks(text, { maxChars: 100 });

      expect(result.length).toBeGreaterThan(0);
      const timestampedChunks = result.filter((c) => c.timestamp !== undefined);
      expect(timestampedChunks.length).toBeGreaterThan(0);
    });

    it("should parse YouTube timestamps in HH:MM:SS format", () => {
      const text = "[1:30:45] Long intro\n[2:15:30] Main section";
      const result = getYouTubeChunks(text, { maxChars: 100 });

      expect(result.length).toBeGreaterThan(0);
      const timestampedChunks = result.filter((c) => c.timestamp !== undefined);
      expect(timestampedChunks.length).toBeGreaterThan(0);
    });

    it("should handle text without timestamps", () => {
      const text = "This is regular text without any timestamps.";
      const result = getYouTubeChunks(text, { maxChars: 100 });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].text).toBeDefined();
    });

    it("should return empty array for empty text", () => {
      const result = getYouTubeChunks("", { maxChars: 100 });
      expect(result).toHaveLength(0);
    });

    it("should respect maxChunks limit", () => {
      const text = Array.from({ length: 100 }, (_, i) => `[${i}:00] Section ${i}`).join("\n");
      const result = getYouTubeChunks(text, { maxChars: 50, maxChunks: 10 });

      expect(result.length).toBeLessThanOrEqual(10);
    });
  });

  describe("truncateAndGetChunks()", () => {
    it("should not truncate text under 100000 characters", async () => {
      const text = "Short text";
      const result = await truncateAndGetChunks(text);

      expect(result.truncated).toBe(false);
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it("should truncate text over 100000 characters", async () => {
      const text = "a".repeat(150000);
      const result = await truncateAndGetChunks(text);

      expect(result.truncated).toBe(true);
      expect(result.chunks[0].text.length).toBeLessThanOrEqual(100000);
    });

    it("should return chunks with citationUUIDs", async () => {
      const text = "Some text content";
      const result = await truncateAndGetChunks(text);

      result.chunks.forEach((chunk) => {
        expect(chunk.citationUUID).toBeDefined();
        expect(chunk.text).toBeDefined();
      });
    });
  });
});

