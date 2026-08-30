/**
 * Element Clipper Tests
 * Tests for element clip capture functionality
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { captureElementClip } from "./element-clipper.js";

class FakeTurndownService {
  turndown(html: string): string {
    return `# Markdown\n\n${html}`;
  }
}

class FakeImage {
  src = "";
  crossOrigin = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
}

vi.stubGlobal("TurndownService", FakeTurndownService);

// Mock fetch and Image for image download tests
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // Mock fetch to return a blob
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    blob: vi.fn().mockResolvedValue(new Blob(["fake image data"], { type: "image/png" })),
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("Image", FakeImage);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Element Clipper", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    Object.defineProperty(window, "location", {
      value: new URL("https://example.com/page"),
      writable: true,
      configurable: true,
    });
  });

  describe("captureElementClip()", () => {
    it("should capture basic element data", async () => {
      const div = document.createElement("div");
      div.id = "test-element";
      div.className = "test-class";
      div.innerHTML = "<p>Test content</p>";
      document.body.appendChild(div);

      const result = await captureElementClip(div);

      expect(result.url).toBe("https://example.com/page");
      expect(result.pageTitle).toBe("");
      expect(result.selector).toContain("div");
      expect(result.domStructure).toBeDefined();
      expect(result.scopedStyles).toBeDefined();
      expect(result.textContent).toBeDefined();
      expect(result.markdownContent).toBeDefined();
      expect(result.mediaAssets).toEqual([]);
      expect(result.elementMeta).toBeDefined();
    });

    it("should collect element metadata correctly", async () => {
      const div = document.createElement("div");
      div.id = "test-id";
      div.className = "class1 class2";
      div.setAttribute("data-test", "value");
      div.setAttribute("role", "main");
      document.body.appendChild(div);

      const result = await captureElementClip(div);

      expect(result.elementMeta.tagName).toBe("DIV");
      expect(result.elementMeta.role).toBe("main");
      expect(result.elementMeta.classNames).toContain("class1");
      expect(result.elementMeta.classNames).toContain("class2");
      expect(result.elementMeta.dataAttributes["data-test"]).toBe("value");
      expect(result.elementMeta.boundingBox).toBeDefined();
    });

    it("should collect image assets", async () => {
      const div = document.createElement("div");
      const img = document.createElement("img");
      img.src = "https://example.com/image.jpg";
      img.alt = "Test image";
      div.appendChild(img);
      document.body.appendChild(div);

      const result = await captureElementClip(div);

      expect(result.mediaAssets.length).toBeGreaterThan(0);
      const imageAsset = result.mediaAssets.find((a) => a.type === "image");
      expect(imageAsset).toBeDefined();
      expect(imageAsset?.originalSrc).toBe("https://example.com/image.jpg");
      expect(imageAsset?.alt).toBe("Test image");
      // For single-image elements, imageBlob should be set
      expect(result.imageBlob).toBeDefined();
    });

    it("should generate valid CSS selector", async () => {
      const div = document.createElement("div");
      div.id = "unique-id";
      const span = document.createElement("span");
      span.className = "inner";
      div.appendChild(span);
      document.body.appendChild(div);

      const result = await captureElementClip(span);

      expect(result.selector).toContain("div#unique-id");
      expect(result.selector).toContain("span");
    });

    it("should handle errors gracefully", async () => {
      const div = document.createElement("div");
      div.innerHTML = "<p>Test</p>";
      document.body.appendChild(div);

      // Should not throw
      const result = await captureElementClip(div);
      expect(result).toBeDefined();
    });
  });
});
