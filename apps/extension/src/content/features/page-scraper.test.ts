/**
 * Page Scraper Tests
 * Regression tests for comment-preservation and sparse-candidate fallback
 * behavior in scrapePage()
 */

import { describe, it, expect, beforeEach } from "vitest";
import { scrapePage } from "./page-scraper.js";

// Minimal TurndownService stub: returns the text content of the given HTML
class FakeTurndownService {
  turndown(html: string): string {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || "";
  }
}

describe("Page Scraper", () => {
  beforeEach(() => {
    // SAFETY: This test fixture deliberately supplies the asserted boundary shape.
    (globalThis as { TurndownService?: unknown }).TurndownService = FakeTurndownService;
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    document.title = "Test Page";
  });

  describe("scrapePage()", () => {
    it("should preserve comments on a discussion page where comments are the bulk of the content", () => {
      // lobste.rs-style page: small story header, comments make up >90% of text
      const commentItems = Array.from(
        { length: 30 },
        (_, i) =>
          `<li class="comments_subtree">COMMENT_MARKER_${i + 1} ${"This is a thoughtful reply with plenty of discussion text. ".repeat(3)}</li>`,
      ).join("");

      document.title = "An interesting story | Lobsters";
      document.body.innerHTML = `
        <div id="inside">
          <div class="story">
            <h1>An interesting story about software</h1>
            <p>A short story description with a link.</p>
          </div>
          <ol class="comments">${commentItems}</ol>
        </div>
      `;

      const result = scrapePage();

      expect(result.content).toContain("COMMENT_MARKER_1");
      expect(result.content).toContain("COMMENT_MARKER_15");
      expect(result.content).toContain("COMMENT_MARKER_30");
      expect(result.content).toContain("An interesting story about software");
      expect(result.characterCount).toBeGreaterThan(2000);
    });

    it("should strip comments on an article-dominant page where comments are a small fraction", () => {
      const articleText =
        "The quick brown fox jumps over the lazy dog and keeps on running through the field. ".repeat(
          30,
        );

      document.body.innerHTML = `
        <article>
          <h1>A long-form article</h1>
          <p>${articleText}</p>
          <div class="comments">COMMENT_MARKER first reader comment. COMMENT_MARKER second reader comment.</div>
        </article>
      `;

      const result = scrapePage();

      expect(result.content).not.toContain("COMMENT_MARKER");
      expect(result.content).toContain("A long-form article");
      expect(result.content).toContain("The quick brown fox");
    });

    it("should fall back to body content when the main-content candidate is sparse", () => {
      const bodyText =
        "BODY_FALLBACK_TEXT The real page content lives outside the main element entirely. ".repeat(
          20,
        );

      document.body.innerHTML = `
        <main>Tiny main.</main>
        <div class="post">
          <p>${bodyText}</p>
        </div>
      `;

      const result = scrapePage();

      expect(result.content).toContain("BODY_FALLBACK_TEXT");
      expect(result.content).toContain("The real page content lives outside the main element");
      expect(result.characterCount).toBeGreaterThan(500);
    });

    it("should include page metadata in the result", () => {
      document.title = "Metadata Test";
      document.body.innerHTML = `<article><p>${"Some article content here. ".repeat(30)}</p></article>`;

      const result = scrapePage();

      expect(result.title).toBe("Metadata Test");
      expect(result.url).toBe(window.location.href);
      expect(result.siteName).toBe(window.location.hostname);
      expect(result.excerpt.length).toBeGreaterThan(0);
      expect(result.characterCount).toBe(result.content.length);
    });
  });
});
