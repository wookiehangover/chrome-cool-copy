/**
 * HTML Chunk Splitter Tests
 */

import { describe, it, expect } from "vitest";
import { getHtmlChunks, HtmlChunk } from "./html-chunk-splitter.js";

describe("HTML Chunk Splitter", () => {
  describe("getHtmlChunks()", () => {
    describe("Basic behavior", () => {
      it("should return empty array for empty string", () => {
        const result = getHtmlChunks("");
        expect(result).toEqual([]);
      });

      it("should return empty array for whitespace-only string", () => {
        const result = getHtmlChunks("   \n\t  ");
        expect(result).toEqual([]);
      });

      it("should return single chunk for small content", () => {
        const html = "<p>Hello world</p>";
        const result = getHtmlChunks(html);

        expect(result).toHaveLength(1);
        expect(result[0].html).toBe(html);
        expect(result[0].id).toBeDefined();
        expect(result[0].id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      });

      it("should throw error when minChars > maxChars", () => {
        expect(() => {
          getHtmlChunks("<p>Test</p>", { minChars: 200, maxChars: 100 });
        }).toThrow("minChars must be less than or equal to maxChars");
      });
    });

    describe("Heading-based splitting", () => {
      it("should split content at h1 boundaries", () => {
        const html = `
          <h1>Section 1</h1>
          <p>${"A".repeat(100)}</p>
          <h1>Section 2</h1>
          <p>${"B".repeat(100)}</p>
        `;
        const result = getHtmlChunks(html, { minChars: 50, maxChars: 200 });

        expect(result.length).toBeGreaterThanOrEqual(2);
        expect(result[0].html).toContain("Section 1");
        expect(result.some((c) => c.html.includes("Section 2"))).toBe(true);
      });

      it("should split content at h2 boundaries", () => {
        const html = `
          <h2>Part A</h2>
          <p>${"X".repeat(100)}</p>
          <h2>Part B</h2>
          <p>${"Y".repeat(100)}</p>
        `;
        const result = getHtmlChunks(html, { minChars: 50, maxChars: 200 });

        expect(result.length).toBeGreaterThanOrEqual(2);
      });

      it("should split content at h3 boundaries", () => {
        const html = `
          <h3>Topic 1</h3>
          <p>${"M".repeat(100)}</p>
          <h3>Topic 2</h3>
          <p>${"N".repeat(100)}</p>
        `;
        const result = getHtmlChunks(html, { minChars: 50, maxChars: 200 });

        expect(result.length).toBeGreaterThanOrEqual(2);
      });

      it("should combine small sections when below minChars", () => {
        const html = `
          <h1>A</h1>
          <p>Short</p>
          <h1>B</h1>
          <p>Also short</p>
        `;
        const result = getHtmlChunks(html, { minChars: 100, maxChars: 500 });

        // Should combine because combined content is under maxChars and individual is under minChars
        expect(result).toHaveLength(1);
      });
    });

    describe("Content without headings", () => {
      it("should split by top-level elements when no headings", () => {
        const html = `
          <p>${"A".repeat(150)}</p>
          <p>${"B".repeat(150)}</p>
          <p>${"C".repeat(150)}</p>
        `;
        const result = getHtmlChunks(html, { minChars: 100, maxChars: 200 });

        expect(result.length).toBeGreaterThan(1);
        result.forEach((chunk) => {
          expect(chunk.html.length).toBeLessThanOrEqual(200);
        });
      });
    });

    describe("Deeply nested structures", () => {
      it("should handle nested divs", () => {
        const html = `
          <div>
            <div>
              <div>
                <p>Nested content</p>
              </div>
            </div>
          </div>
        `;
        const result = getHtmlChunks(html);

        expect(result).toHaveLength(1);
        expect(result[0].html).toContain("Nested content");
      });

      it("should split large nested structures", () => {
        const html = `
          <div>
            <p>${"A".repeat(200)}</p>
            <p>${"B".repeat(200)}</p>
            <p>${"C".repeat(200)}</p>
          </div>
        `;
        const result = getHtmlChunks(html, { minChars: 100, maxChars: 300 });

        expect(result.length).toBeGreaterThan(1);
      });
    });

    describe("UUID generation", () => {
      it("should generate unique IDs for each chunk", () => {
        const html = `
          <h1>Section 1</h1>
          <p>${"A".repeat(200)}</p>
          <h1>Section 2</h1>
          <p>${"B".repeat(200)}</p>
        `;
        const result = getHtmlChunks(html, { minChars: 50, maxChars: 250 });

        const ids = result.map((c) => c.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
      });
    });

    describe("Default options", () => {
      it("should use default 3000-5000 character range", () => {
        // Create content that's larger than 5000 chars
        const html = `<div>${"<p>Content paragraph.</p>".repeat(500)}</div>`;
        const result = getHtmlChunks(html);

        expect(result.length).toBeGreaterThan(1);
      });
    });
  });
});

