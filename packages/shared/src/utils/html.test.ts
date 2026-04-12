import { describe, expect, it } from "vitest";
import { escapeHtml } from "./html.js";

describe("escapeHtml", () => {
  it("escapes angle brackets and ampersands", () => {
    const input = `<script>alert("xss")</script> & <b>bold</b>`;

    expect(escapeHtml(input)).toBe(
      `&lt;script&gt;alert("xss")&lt;/script&gt; &amp; &lt;b&gt;bold&lt;/b&gt;`,
    );
  });

  it("returns unchanged text when no escapable HTML characters are present", () => {
    expect(escapeHtml("plain text 123")).toBe("plain text 123");
  });
});
