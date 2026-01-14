/**
 * DOM Serializer Tests
 * Tests for DOM serialization with script removal, event handler removal, and URL conversion
 */

import { describe, it, expect, beforeEach } from "vitest";
import { serializeDOM } from "./dom-serializer.js";

describe("DOM Serializer", () => {
  beforeEach(() => {
    // Reset DOM before each test
    document.body.innerHTML = "";
    // Mock window.location.origin
    Object.defineProperty(window, "location", {
      value: new URL("https://example.com/page"),
      writable: true,
      configurable: true,
    });
  });

  describe("serializeDOM()", () => {
    describe("Script and style removal", () => {
      it("should remove script tags", () => {
        const div = document.createElement("div");
        div.innerHTML = '<p>Content</p><script>alert("xss")</script>';
        const result = serializeDOM(div);
        expect(result).not.toContain("<script>");
        expect(result).not.toContain("alert");
        expect(result).toContain("<p>Content</p>");
      });

      it("should remove style tags", () => {
        const div = document.createElement("div");
        div.innerHTML = "<p>Content</p><style>body { color: red; }</style>";
        const result = serializeDOM(div);
        expect(result).not.toContain("<style>");
        expect(result).not.toContain("color: red");
        expect(result).toContain("<p>Content</p>");
      });

      it("should remove multiple script tags", () => {
        const div = document.createElement("div");
        div.innerHTML = "<script>var x = 1;</script><p>Content</p><script>var y = 2;</script>";
        const result = serializeDOM(div);
        expect(result).not.toContain("<script>");
        expect(result).not.toContain("var x");
        expect(result).not.toContain("var y");
      });
    });

    describe("Event handler removal", () => {
      it("should remove onclick attribute", () => {
        const div = document.createElement("div");
        div.innerHTML = "<button onclick=\"alert('click')\">Click me</button>";
        const result = serializeDOM(div);
        expect(result).not.toContain("onclick");
        expect(result).toContain("<button>Click me</button>");
      });

      it("should remove onload attribute", () => {
        const div = document.createElement("div");
        div.innerHTML = '<img src="test.jpg" onload="doSomething()" />';
        const result = serializeDOM(div);
        expect(result).not.toContain("onload");
        expect(result).toContain("src=");
      });

      it("should remove multiple event handlers", () => {
        const div = document.createElement("div");
        div.innerHTML = '<div onmouseover="x()" onmouseout="y()" onclick="z()">Content</div>';
        const result = serializeDOM(div);
        expect(result).not.toContain("onmouseover");
        expect(result).not.toContain("onmouseout");
        expect(result).not.toContain("onclick");
        expect(result).toContain(">Content</div>");
      });

      it("should remove event handlers from nested elements", () => {
        const div = document.createElement("div");
        div.innerHTML = '<div onclick="outer()"><span onmouseover="inner()">Text</span></div>';
        const result = serializeDOM(div);
        expect(result).not.toContain("onclick");
        expect(result).not.toContain("onmouseover");
      });
    });

    describe("Relative URL conversion", () => {
      it("should convert relative href to absolute", () => {
        const div = document.createElement("div");
        div.innerHTML = '<a href="/page">Link</a>';
        const result = serializeDOM(div);
        expect(result).toContain("https://example.com/page");
      });

      it("should convert relative src to absolute", () => {
        const div = document.createElement("div");
        div.innerHTML = '<img src="image.jpg" />';
        const result = serializeDOM(div);
        expect(result).toContain("https://example.com/image.jpg");
      });

      it("should preserve absolute URLs", () => {
        const div = document.createElement("div");
        div.innerHTML = '<a href="https://other.com">Link</a>';
        const result = serializeDOM(div);
        expect(result).toContain("https://other.com");
      });

      it("should convert protocol-relative URLs", () => {
        const div = document.createElement("div");
        div.innerHTML = '<img src="//cdn.example.com/image.jpg" />';
        const result = serializeDOM(div);
        // Protocol-relative URLs should be preserved as-is
        expect(result).toContain("//cdn.example.com/image.jpg");
      });

      it("should preserve data URLs", () => {
        const div = document.createElement("div");
        const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
        div.innerHTML = `<img src="${dataUrl}" />`;
        const result = serializeDOM(div);
        expect(result).toContain(dataUrl);
      });
    });

    describe("Attribute preservation", () => {
      it("should preserve class names", () => {
        const div = document.createElement("div");
        div.innerHTML = '<p class="highlight important">Text</p>';
        const result = serializeDOM(div);
        expect(result).toContain('class="highlight important"');
      });

      it("should preserve data-* attributes", () => {
        const div = document.createElement("div");
        div.innerHTML = '<div data-id="123" data-type="article">Content</div>';
        const result = serializeDOM(div);
        expect(result).toContain('data-id="123"');
        expect(result).toContain('data-type="article"');
      });

      it("should preserve ARIA attributes", () => {
        const div = document.createElement("div");
        div.innerHTML = '<button aria-label="Close" aria-pressed="false">X</button>';
        const result = serializeDOM(div);
        expect(result).toContain('aria-label="Close"');
        expect(result).toContain('aria-pressed="false"');
      });
    });

    describe("Original element preservation", () => {
      it("should not modify the original element", () => {
        const div = document.createElement("div");
        div.innerHTML = '<p onclick="alert()">Text</p>';
        const originalHTML = div.innerHTML;
        serializeDOM(div);
        expect(div.innerHTML).toBe(originalHTML);
      });
    });

    describe("Complex scenarios", () => {
      it("should handle mixed content with scripts, handlers, and relative URLs", () => {
        const div = document.createElement("div");
        div.innerHTML = `
          <script>var x = 1;</script>
          <a href="/page" onclick="navigate()">Link</a>
          <img src="image.jpg" onload="loaded()" />
          <p class="text" data-id="1">Content</p>
        `;
        const result = serializeDOM(div);
        expect(result).not.toContain("<script>");
        expect(result).not.toContain("onclick");
        expect(result).not.toContain("onload");
        expect(result).toContain("https://example.com/page");
        expect(result).toContain("https://example.com/image.jpg");
        expect(result).toContain('class="text"');
        expect(result).toContain('data-id="1"');
      });
    });
  });
});
