/**
 * Tools Text Chunking Tests
 * Regression tests for getSmartChunks: no text is dropped, long sentences are
 * hard-split rather than truncated, and truncateAndGetChunks caps total size
 */

import { describe, it, expect } from "vitest";
import { getSmartChunks, truncateAndGetChunks } from "./chunk.js";
import type { ContentChunk } from "./types";

function normalize(text: string): string {
  return text.replace(/\s+/g, "");
}

function joinChunks(chunks: ContentChunk[]): string {
  return chunks.map((c) => c.text).join("");
}

describe("Tools Text Chunking", () => {
  describe("getSmartChunks()", () => {
    describe("No-character-loss invariant", () => {
      const cases: Array<{ name: string; text: string }> = [
        {
          name: "many short sentences across paragraphs",
          text: Array.from(
            { length: 40 },
            (_, i) => `Sentence number ${i + 1} has some words. It also has a follow-up.`,
          ).join("\n\n"),
        },
        {
          name: "a sentence longer than maxChars",
          text: `Intro paragraph before the long part.\n\nLONGSTART ${"x".repeat(2400)} LONGEND.\n\nA short closing paragraph.`,
        },
        {
          name: "mixed long and short paragraphs with a trailing short chunk",
          text: `${"A repeated sentence that fills the paragraph nicely. ".repeat(40)}\n\nTiny tail.`,
        },
      ];

      cases.forEach(({ name, text }) => {
        it(`should preserve all input text for ${name}`, () => {
          const result = getSmartChunks(text, { minChars: 100, maxChars: 1000 });

          expect(result.length).toBeGreaterThan(1);
          expect(normalize(joinChunks(result))).toBe(normalize(text));
        });
      });

      it("should keep the full content of a sentence longer than maxChars across chunks", () => {
        const longSentence = `LONGSTART ${"y".repeat(2400)} LONGEND.`;
        const text = `A first paragraph of normal text.\n\n${longSentence}`;
        const result = getSmartChunks(text, { minChars: 100, maxChars: 1000 });

        const joined = normalize(joinChunks(result));
        expect(joined).toContain(normalize(longSentence));
        expect(joined).toContain("LONGSTART");
        expect(joined).toContain("LONGEND.");
      });

      it("should not drop a final chunk shorter than minChars", () => {
        const text = `${"Filler sentence with enough words to matter. ".repeat(30)}\n\nORPHAN_TAIL.`;
        const result = getSmartChunks(text, { minChars: 100, maxChars: 1000 });

        expect(joinChunks(result)).toContain("ORPHAN_TAIL.");
        expect(normalize(joinChunks(result))).toBe(normalize(text));
      });
    });

    describe("Hard-splitting long sentences", () => {
      it("should split a sentence longer than maxChars into multiple chunks instead of truncating", () => {
        const sentence = `BEGIN ${"z".repeat(2500)} END.`;
        const result = getSmartChunks(sentence, { minChars: 100, maxChars: 1000 });

        expect(result.length).toBeGreaterThan(1);
        result.forEach((chunk) => {
          expect(chunk.text.length).toBeLessThanOrEqual(1000);
        });
        expect(normalize(joinChunks(result))).toBe(normalize(sentence));
      });
    });

    describe("Chunk size limits", () => {
      it("should keep every chunk within maxChars", () => {
        const text = Array.from(
          { length: 20 },
          (_, i) => `Paragraph ${i + 1} content. ${"More words here. ".repeat(10)}`,
        ).join("\n\n");
        const result = getSmartChunks(text, { minChars: 50, maxChars: 200 });

        result.forEach((chunk) => {
          expect(chunk.text.length).toBeLessThanOrEqual(200);
        });
        expect(normalize(joinChunks(result))).toBe(normalize(text));
      });
    });

    describe("Citation UUIDs", () => {
      it("should assign unique citationUUIDs to each chunk", () => {
        const text = "Sentence one is here. ".repeat(100);
        const result = getSmartChunks(text, { minChars: 100, maxChars: 500 });

        const uuids = result.map((c) => c.citationUUID);
        expect(new Set(uuids).size).toBe(uuids.length);
      });
    });
  });

  describe("truncateAndGetChunks()", () => {
    it("should not truncate text under the 100000-character cap", () => {
      const text = "Short text that easily fits under the cap.";
      const result = truncateAndGetChunks(text);

      expect(result.truncated).toBe(false);
      expect(joinChunks(result.chunks)).toBe(text);
    });

    it("should cap total chunk text at 100000 characters for oversized input", () => {
      const text = "a".repeat(150000);
      const result = truncateAndGetChunks(text);

      expect(result.truncated).toBe(true);
      const totalLength = result.chunks.reduce((sum, chunk) => sum + chunk.text.length, 0);
      expect(totalLength).toBeLessThanOrEqual(100000);
      expect(totalLength).toBe(100000);
    });
  });
});
