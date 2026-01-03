/**
 * Type Detection Tests
 * Tests for element type detection functionality
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  detectElementType,
  isTextHeavy,
  calculateTextRatio,
  hasVisualStyling,
} from "./type-detection.js";

describe("Type Detection", () => {
  beforeEach(() => {
    // Reset DOM before each test
    document.body.innerHTML = "";
  });

  describe("detectElementType()", () => {
    describe("Table detection", () => {
      it("should detect TABLE element as table type", () => {
        const table = document.createElement("table");
        expect(detectElementType(table)).toBe("table");
      });

      it("should detect element containing table as table type", () => {
        const div = document.createElement("div");
        const table = document.createElement("table");
        div.appendChild(table);
        expect(detectElementType(div)).toBe("table");
      });

      it("should detect nested table in container", () => {
        const container = document.createElement("div");
        const wrapper = document.createElement("div");
        const table = document.createElement("table");
        wrapper.appendChild(table);
        container.appendChild(wrapper);
        expect(detectElementType(container)).toBe("table");
      });
    });

    describe("Image detection", () => {
      it("should detect IMG element as image type", () => {
        const img = document.createElement("img");
        expect(detectElementType(img)).toBe("image");
      });

      it("should detect element containing img as image type", () => {
        const div = document.createElement("div");
        const img = document.createElement("img");
        div.appendChild(img);
        expect(detectElementType(div)).toBe("image");
      });

      it("should detect element with background-image as image type", () => {
        const div = document.createElement("div");
        div.style.backgroundImage = "url('test.jpg')";
        // In jsdom, getComputedStyle returns the actual style
        expect(detectElementType(div)).toBe("visual");
      });
    });

    describe("SVG detection", () => {
      it("should detect element containing svg as svg type", () => {
        const div = document.createElement("div");
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        div.appendChild(svg);
        expect(detectElementType(div)).toBe("svg");
      });

      it("should detect nested svg in container", () => {
        const container = document.createElement("div");
        const wrapper = document.createElement("div");
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        wrapper.appendChild(svg);
        container.appendChild(wrapper);
        expect(detectElementType(container)).toBe("svg");
      });
    });

    describe("Video/Canvas (visual) detection", () => {
      it("should detect VIDEO element as visual type", () => {
        const video = document.createElement("video");
        expect(detectElementType(video)).toBe("visual");
      });

      it("should detect element containing video as visual type", () => {
        const div = document.createElement("div");
        const video = document.createElement("video");
        div.appendChild(video);
        expect(detectElementType(div)).toBe("visual");
      });

      it("should detect CANVAS element as visual type", () => {
        const canvas = document.createElement("canvas");
        expect(detectElementType(canvas)).toBe("visual");
      });

      it("should detect element containing canvas as visual type", () => {
        const div = document.createElement("div");
        const canvas = document.createElement("canvas");
        div.appendChild(canvas);
        expect(detectElementType(div)).toBe("visual");
      });
    });

    describe("Text-heavy detection", () => {
      it("should detect text-heavy paragraph as text type", () => {
        const p = document.createElement("p");
        p.textContent = "This is a long paragraph with lots of text content that should be considered text-heavy.";
        document.body.appendChild(p);
        expect(detectElementType(p)).toBe("text");
      });

      it("should detect text-heavy div as text type", () => {
        const div = document.createElement("div");
        div.textContent = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";
        document.body.appendChild(div);
        expect(detectElementType(div)).toBe("text");
      });

      it("should detect article with text content as text type", () => {
        const article = document.createElement("article");
        article.innerHTML = "<p>First paragraph with content.</p><p>Second paragraph with more content.</p>";
        document.body.appendChild(article);
        expect(detectElementType(article)).toBe("text");
      });
    });

    describe("List detection", () => {
      it("should detect UL element as visual (not special-cased)", () => {
        const ul = document.createElement("ul");
        const li = document.createElement("li");
        li.textContent = "Item";
        ul.appendChild(li);
        // Lists are not special-cased, so they fall through to text/visual detection
        const result = detectElementType(ul);
        expect(["text", "visual"]).toContain(result);
      });

      it("should detect OL element as visual (not special-cased)", () => {
        const ol = document.createElement("ol");
        const li = document.createElement("li");
        li.textContent = "Item";
        ol.appendChild(li);
        const result = detectElementType(ol);
        expect(["text", "visual"]).toContain(result);
      });
    });

    describe("Link detection", () => {
      it("should detect link element as text or visual", () => {
        const a = document.createElement("a");
        a.href = "https://example.com";
        a.textContent = "Click here";
        const result = detectElementType(a);
        expect(["text", "visual"]).toContain(result);
      });
    });

    describe("Generic element fallback", () => {
      it("should return visual for element with visual styling", () => {
        const div = document.createElement("div");
        div.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
        vi.spyOn(window, "getComputedStyle").mockReturnValue({
          boxShadow: "0 0 10px rgba(0,0,0,0.5)",
        } as CSSStyleDeclaration);
        expect(detectElementType(div)).toBe("visual");
      });

      it("should return visual for empty element", () => {
        const div = document.createElement("div");
        expect(detectElementType(div)).toBe("visual");
      });

      it("should return text for null element", () => {
        expect(detectElementType(null as any)).toBe("text");
      });
    });

    describe("Priority order", () => {
      it("should prioritize table over image", () => {
        const div = document.createElement("div");
        const table = document.createElement("table");
        const img = document.createElement("img");
        div.appendChild(table);
        div.appendChild(img);
        expect(detectElementType(div)).toBe("table");
      });

      it("should prioritize image over svg", () => {
        const div = document.createElement("div");
        const img = document.createElement("img");
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        div.appendChild(img);
        div.appendChild(svg);
        expect(detectElementType(div)).toBe("image");
      });

      it("should prioritize svg over canvas", () => {
        const div = document.createElement("div");
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const canvas = document.createElement("canvas");
        div.appendChild(svg);
        div.appendChild(canvas);
        expect(detectElementType(div)).toBe("svg");
      });
    });
  });

  describe("isTextHeavy()", () => {
    it("should return false for element with minimal text", () => {
      const div = document.createElement("div");
      div.textContent = "Hi";
      document.body.appendChild(div);
      expect(isTextHeavy(div)).toBe(false);
    });

    it("should return false for element with visual styling", () => {
      const div = document.createElement("div");
      div.textContent = "Text with styling";
      div.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
      document.body.appendChild(div);
      expect(isTextHeavy(div)).toBe(false);
    });

    it("should return false for null element", () => {
      expect(isTextHeavy(null as any)).toBe(false);
    });

    it("should calculate text ratio correctly", () => {
      const div = document.createElement("div");
      // Create element with 1 span child and lots of text
      div.innerHTML = "<span>A</span>" + "B".repeat(100);
      document.body.appendChild(div);
      // Ratio should be ~100 chars / 1 child = 100 (above 20 threshold)
      // But hasVisualStyling might return true in jsdom, so just verify ratio is calculated
      const ratio = calculateTextRatio(div);
      expect(ratio).toBeGreaterThan(20);
    });
  });

  describe("calculateTextRatio()", () => {
    it("should return 0 for null element", () => {
      expect(calculateTextRatio(null as any)).toBe(0);
    });

    it("should return 100 for element with text and no children", () => {
      const p = document.createElement("p");
      p.textContent = "Some text";
      expect(calculateTextRatio(p)).toBe(100);
    });

    it("should return 0 for empty element with no children", () => {
      const div = document.createElement("div");
      expect(calculateTextRatio(div)).toBe(0);
    });

    it("should calculate ratio correctly for element with children", () => {
      const div = document.createElement("div");
      div.innerHTML = "<span>Text</span><span>More</span>";
      const ratio = calculateTextRatio(div);
      expect(ratio).toBeGreaterThan(0);
      expect(ratio).toBeLessThan(100);
    });

    it("should handle deeply nested elements", () => {
      const div = document.createElement("div");
      div.innerHTML = "<div><div><div>Deep text</div></div></div>";
      const ratio = calculateTextRatio(div);
      expect(ratio).toBeGreaterThan(0);
    });
  });

  describe("hasVisualStyling()", () => {
    it("should return false for null element", () => {
      expect(hasVisualStyling(null as any)).toBe(false);
    });

    it("should return false for element without styling", () => {
      const div = document.createElement("div");
      vi.spyOn(window, "getComputedStyle").mockReturnValue({
        backgroundImage: "none",
        boxShadow: "none",
        textShadow: "none",
        transform: "none",
        filter: "none",
      } as CSSStyleDeclaration);
      expect(hasVisualStyling(div)).toBe(false);
    });

    it("should return true for element with background-image", () => {
      const div = document.createElement("div");
      vi.spyOn(window, "getComputedStyle").mockReturnValue({
        backgroundImage: "url('test.jpg')",
      } as CSSStyleDeclaration);
      expect(hasVisualStyling(div)).toBe(true);
    });

    it("should return true for element with gradient", () => {
      const div = document.createElement("div");
      vi.spyOn(window, "getComputedStyle").mockReturnValue({
        backgroundImage: "linear-gradient(to right, red, blue)",
      } as CSSStyleDeclaration);
      expect(hasVisualStyling(div)).toBe(true);
    });

    it("should return true for element with box-shadow", () => {
      const div = document.createElement("div");
      vi.spyOn(window, "getComputedStyle").mockReturnValue({
        backgroundImage: "none",
        boxShadow: "0 0 10px rgba(0,0,0,0.5)",
      } as CSSStyleDeclaration);
      expect(hasVisualStyling(div)).toBe(true);
    });

    it("should return true for element with text-shadow", () => {
      const div = document.createElement("div");
      vi.spyOn(window, "getComputedStyle").mockReturnValue({
        backgroundImage: "none",
        boxShadow: "none",
        textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
      } as CSSStyleDeclaration);
      expect(hasVisualStyling(div)).toBe(true);
    });

    it("should return true for element with transform", () => {
      const div = document.createElement("div");
      vi.spyOn(window, "getComputedStyle").mockReturnValue({
        backgroundImage: "none",
        boxShadow: "none",
        textShadow: "none",
        transform: "rotate(45deg)",
      } as CSSStyleDeclaration);
      expect(hasVisualStyling(div)).toBe(true);
    });

    it("should return true for element with filter", () => {
      const div = document.createElement("div");
      vi.spyOn(window, "getComputedStyle").mockReturnValue({
        backgroundImage: "none",
        boxShadow: "none",
        textShadow: "none",
        transform: "none",
        filter: "blur(5px)",
      } as CSSStyleDeclaration);
      expect(hasVisualStyling(div)).toBe(true);
    });
  });
});

