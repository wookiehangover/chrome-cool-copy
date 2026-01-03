/**
 * Wikipedia Detector Tests
 * Tests for Wikipedia page detection and article title extraction
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getWikipediaArticleTitle,
  isWikipediaSpecialPage,
  getWikipediaArticle,
} from "./wikipedia-detector.js";

describe("Wikipedia Detector", () => {
  describe("getWikipediaArticleTitle()", () => {
    it("should extract title from English Wikipedia article", () => {
      const url = "https://en.wikipedia.org/wiki/Python_(programming_language)";
      const result = getWikipediaArticleTitle(url);
      expect(result).toBe("Python_(programming_language)");
    });

    it("should extract title from French Wikipedia article", () => {
      const url = "https://fr.wikipedia.org/wiki/Python_(langage)";
      const result = getWikipediaArticleTitle(url);
      expect(result).toBe("Python_(langage)");
    });

    it("should extract title from German Wikipedia article", () => {
      const url = "https://de.wikipedia.org/wiki/Albert_Einstein";
      const result = getWikipediaArticleTitle(url);
      expect(result).toBe("Albert_Einstein");
    });

    it("should handle URL encoded article titles", () => {
      const url = "https://en.wikipedia.org/wiki/Albert_Einstein";
      const result = getWikipediaArticleTitle(url);
      expect(result).toBe("Albert_Einstein");
    });

    it("should extract title from old-style Wikipedia URLs with title parameter", () => {
      const url = "https://en.wikipedia.org/w/index.php?title=Python_(programming_language)";
      const result = getWikipediaArticleTitle(url);
      expect(result).toBe("Python_(programming_language)");
    });

    it("should return null for non-Wikipedia URLs", () => {
      const url = "https://example.com/wiki/Article";
      const result = getWikipediaArticleTitle(url);
      expect(result).toBeNull();
    });

    it("should return null for Wikipedia URLs without article path", () => {
      const url = "https://en.wikipedia.org/";
      const result = getWikipediaArticleTitle(url);
      expect(result).toBeNull();
    });

    it("should return null for invalid URLs", () => {
      const url = "not a valid url";
      const result = getWikipediaArticleTitle(url);
      expect(result).toBeNull();
    });

    it("should handle Wikipedia URLs with special characters", () => {
      const url = "https://en.wikipedia.org/wiki/C%2B%2B";
      const result = getWikipediaArticleTitle(url);
      expect(result).toBe("C++");
    });
  });

  describe("isWikipediaSpecialPage()", () => {
    it("should identify Main_Page as special", () => {
      expect(isWikipediaSpecialPage("Main_Page")).toBe(true);
    });

    it("should identify Special: pages as special", () => {
      expect(isWikipediaSpecialPage("Special:RecentChanges")).toBe(true);
      expect(isWikipediaSpecialPage("Special:AllPages")).toBe(true);
    });

    it("should identify Template: pages as special", () => {
      expect(isWikipediaSpecialPage("Template:Cite_web")).toBe(true);
    });

    it("should identify Category: pages as special", () => {
      expect(isWikipediaSpecialPage("Category:Programming_languages")).toBe(true);
    });

    it("should identify File: pages as special", () => {
      expect(isWikipediaSpecialPage("File:Example.jpg")).toBe(true);
    });

    it("should identify Wikipedia: pages as special", () => {
      expect(isWikipediaSpecialPage("Wikipedia:About")).toBe(true);
    });

    it("should identify Help: pages as special", () => {
      expect(isWikipediaSpecialPage("Help:Contents")).toBe(true);
    });

    it("should identify User: pages as special", () => {
      expect(isWikipediaSpecialPage("User:Example")).toBe(true);
    });

    it("should identify talk pages as special", () => {
      expect(isWikipediaSpecialPage("User_talk:Example")).toBe(true);
      expect(isWikipediaSpecialPage("Wikipedia_talk:About")).toBe(true);
      expect(isWikipediaSpecialPage("Template_talk:Cite")).toBe(true);
    });

    it("should identify null as special", () => {
      expect(isWikipediaSpecialPage(null)).toBe(true);
    });

    it("should identify regular articles as not special", () => {
      expect(isWikipediaSpecialPage("Python_(programming_language)")).toBe(false);
      expect(isWikipediaSpecialPage("Albert_Einstein")).toBe(false);
      expect(isWikipediaSpecialPage("JavaScript")).toBe(false);
    });
  });

  describe("getWikipediaArticle()", () => {
    it("should return article title for valid Wikipedia articles", () => {
      const url = "https://en.wikipedia.org/wiki/Python_(programming_language)";
      const result = getWikipediaArticle(url);
      expect(result).toBe("Python_(programming_language)");
    });

    it("should return null for Wikipedia Main Page", () => {
      const url = "https://en.wikipedia.org/wiki/Main_Page";
      const result = getWikipediaArticle(url);
      expect(result).toBeNull();
    });

    it("should return null for Wikipedia Special pages", () => {
      const url = "https://en.wikipedia.org/wiki/Special:RecentChanges";
      const result = getWikipediaArticle(url);
      expect(result).toBeNull();
    });

    it("should return null for Wikipedia Template pages", () => {
      const url = "https://en.wikipedia.org/wiki/Template:Cite_web";
      const result = getWikipediaArticle(url);
      expect(result).toBeNull();
    });

    it("should return null for Wikipedia Category pages", () => {
      const url = "https://en.wikipedia.org/wiki/Category:Programming_languages";
      const result = getWikipediaArticle(url);
      expect(result).toBeNull();
    });

    it("should return null for non-Wikipedia URLs", () => {
      const url = "https://example.com/wiki/Article";
      const result = getWikipediaArticle(url);
      expect(result).toBeNull();
    });

    it("should work with different language Wikipedia sites", () => {
      const frUrl = "https://fr.wikipedia.org/wiki/Python_(langage)";
      const result = getWikipediaArticle(frUrl);
      expect(result).toBe("Python_(langage)");
    });

    it("should handle URL encoded titles", () => {
      const url = "https://en.wikipedia.org/wiki/C%2B%2B";
      const result = getWikipediaArticle(url);
      expect(result).toBe("C++");
    });
  });

  describe("Integration tests", () => {
    it("should correctly identify and extract from a real Wikipedia article URL", () => {
      const url = "https://en.wikipedia.org/wiki/JavaScript";
      const title = getWikipediaArticleTitle(url);
      const article = getWikipediaArticle(url);

      expect(title).toBe("JavaScript");
      expect(article).toBe("JavaScript");
      expect(isWikipediaSpecialPage(title)).toBe(false);
    });

    it("should correctly handle a Wikipedia special page URL", () => {
      const url = "https://en.wikipedia.org/wiki/Special:RecentChanges";
      const title = getWikipediaArticleTitle(url);
      const article = getWikipediaArticle(url);

      expect(title).toBe("Special:RecentChanges");
      expect(article).toBeNull();
      expect(isWikipediaSpecialPage(title)).toBe(true);
    });

    it("should correctly handle a non-Wikipedia URL", () => {
      const url = "https://github.com/user/repo";
      const title = getWikipediaArticleTitle(url);
      const article = getWikipediaArticle(url);

      expect(title).toBeNull();
      expect(article).toBeNull();
    });
  });
});
