/**
 * Structured Data Extractor Tests
 * Tests for JSON-LD, microdata, Open Graph, and ARIA attribute extraction
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { extractStructuredData } from "./structured-data-extractor.js";

describe("Structured Data Extractor", () => {
  let container: HTMLElement;

  beforeEach(() => {
    // Create a fresh container for each test
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    // Clean up
    document.body.removeChild(container);
  });

  describe("JSON-LD extraction", () => {
    it("should extract JSON-LD from script tags", () => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "Test Article",
      });
      document.head.appendChild(script);

      const result = extractStructuredData(container);
      expect(result.jsonLd).toHaveLength(1);
      expect(result.jsonLd[0]).toEqual({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "Test Article",
      });

      document.head.removeChild(script);
    });

    it("should handle multiple JSON-LD scripts", () => {
      const script1 = document.createElement("script");
      script1.type = "application/ld+json";
      script1.textContent = JSON.stringify({ "@type": "Article" });
      document.head.appendChild(script1);

      const script2 = document.createElement("script");
      script2.type = "application/ld+json";
      script2.textContent = JSON.stringify({ "@type": "Organization" });
      document.head.appendChild(script2);

      const result = extractStructuredData(container);
      expect(result.jsonLd).toHaveLength(2);

      document.head.removeChild(script1);
      document.head.removeChild(script2);
    });

    it("should handle malformed JSON-LD gracefully", () => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.textContent = "{ invalid json }";
      document.head.appendChild(script);

      const result = extractStructuredData(container);
      expect(result.jsonLd).toHaveLength(0);

      document.head.removeChild(script);
    });
  });

  describe("Open Graph extraction", () => {
    it("should extract Open Graph meta tags", () => {
      const ogTitle = document.createElement("meta");
      ogTitle.setAttribute("property", "og:title");
      ogTitle.setAttribute("content", "Test Title");
      document.head.appendChild(ogTitle);

      const ogDesc = document.createElement("meta");
      ogDesc.setAttribute("property", "og:description");
      ogDesc.setAttribute("content", "Test Description");
      document.head.appendChild(ogDesc);

      const result = extractStructuredData(container);
      expect(result.openGraph["og:title"]).toBe("Test Title");
      expect(result.openGraph["og:description"]).toBe("Test Description");

      document.head.removeChild(ogTitle);
      document.head.removeChild(ogDesc);
    });

    it("should handle missing Open Graph tags", () => {
      const result = extractStructuredData(container);
      expect(result.openGraph).toEqual({});
    });
  });

  describe("ARIA attributes extraction", () => {
    it("should extract ARIA attributes from element", () => {
      container.setAttribute("aria-label", "Main content");
      container.setAttribute("aria-live", "polite");

      const result = extractStructuredData(container);
      expect(result.ariaAttributes["aria-label"]).toContain("Main content");
      expect(result.ariaAttributes["aria-live"]).toContain("polite");
    });

    it("should extract ARIA attributes from descendants", () => {
      const button = document.createElement("button");
      button.setAttribute("aria-label", "Close");
      container.appendChild(button);

      const result = extractStructuredData(container);
      expect(result.ariaAttributes["aria-label"]).toContain("Close");
    });

    it("should collect unique ARIA attribute values", () => {
      container.setAttribute("aria-label", "Label 1");
      const child = document.createElement("div");
      child.setAttribute("aria-label", "Label 2");
      container.appendChild(child);

      const result = extractStructuredData(container);
      expect(result.ariaAttributes["aria-label"]).toHaveLength(2);
      expect(result.ariaAttributes["aria-label"]).toContain("Label 1");
      expect(result.ariaAttributes["aria-label"]).toContain("Label 2");
    });

    it("should not duplicate ARIA attribute values", () => {
      container.setAttribute("aria-label", "Same");
      const child = document.createElement("div");
      child.setAttribute("aria-label", "Same");
      container.appendChild(child);

      const result = extractStructuredData(container);
      expect(result.ariaAttributes["aria-label"]).toHaveLength(1);
    });
  });

  describe("Microdata extraction", () => {
    it("should extract microdata from itemscope elements", () => {
      const item = document.createElement("div");
      item.setAttribute("itemscope", "");
      item.setAttribute("itemtype", "https://schema.org/Person");

      const name = document.createElement("span");
      name.setAttribute("itemprop", "name");
      name.textContent = "John Doe";
      item.appendChild(name);

      container.appendChild(item);

      const result = extractStructuredData(container);
      expect(result.microdata).toHaveLength(1);
      expect(result.microdata[0].itemtype).toBe("https://schema.org/Person");
      expect(result.microdata[0].properties.name).toContain("John Doe");
    });

    it("should handle empty microdata", () => {
      const result = extractStructuredData(container);
      expect(result.microdata).toEqual([]);
    });
  });

  describe("Complete extraction", () => {
    it("should extract all data types together", () => {
      // Add JSON-LD
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.textContent = JSON.stringify({ "@type": "Article" });
      document.head.appendChild(script);

      // Add Open Graph
      const ogMeta = document.createElement("meta");
      ogMeta.setAttribute("property", "og:title");
      ogMeta.setAttribute("content", "Title");
      document.head.appendChild(ogMeta);

      // Add ARIA
      container.setAttribute("aria-label", "Main");

      const result = extractStructuredData(container);
      expect(result.jsonLd.length).toBeGreaterThan(0);
      expect(result.openGraph["og:title"]).toBe("Title");
      expect(result.ariaAttributes["aria-label"]).toContain("Main");

      document.head.removeChild(script);
      document.head.removeChild(ogMeta);
    });
  });
});

