/**
 * AI Gateway Tests
 * Tests for getAIGateway configuration loading and stripCodeFences utility
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetChromeMocks, mockStorage } from "../test/setup.js";

// Mock the "ai" module before importing the module under test
vi.mock("ai", () => ({
  createGateway: vi.fn((opts: { apiKey: string }) => {
    return (model: string) => ({ provider: "gateway", apiKey: opts.apiKey, model });
  }),
}));

import { getAIGateway, stripCodeFences } from "./ai-gateway.js";

describe("AI Gateway", () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  describe("getAIGateway()", () => {
    it("should return gateway and config when valid config exists", async () => {
      const validConfig = { apiKey: "test-key-123", model: "openai/gpt-4" };
      mockStorage.sync.get.mockImplementation(
        (_keys: string[], callback: (result: Record<string, unknown>) => void) => {
          callback({ aiGatewayConfig: validConfig });
        },
      );

      const result = await getAIGateway();

      expect(result.config).toEqual(validConfig);
      expect(result.gateway).toBeDefined();
      expect(typeof result.gateway).toBe("function");
    });

    it("should throw when config is missing entirely", async () => {
      mockStorage.sync.get.mockImplementation(
        (_keys: string[], callback: (result: Record<string, unknown>) => void) => {
          callback({});
        },
      );

      await expect(getAIGateway()).rejects.toThrow("Vercel AI Gateway configuration not found");
    });

    it("should throw when apiKey is missing", async () => {
      mockStorage.sync.get.mockImplementation(
        (_keys: string[], callback: (result: Record<string, unknown>) => void) => {
          callback({ aiGatewayConfig: { apiKey: "", model: "openai/gpt-4" } });
        },
      );

      await expect(getAIGateway()).rejects.toThrow("Vercel AI Gateway configuration not found");
    });

    it("should throw when model is missing", async () => {
      mockStorage.sync.get.mockImplementation(
        (_keys: string[], callback: (result: Record<string, unknown>) => void) => {
          callback({ aiGatewayConfig: { apiKey: "test-key", model: "" } });
        },
      );

      await expect(getAIGateway()).rejects.toThrow("Vercel AI Gateway configuration not found");
    });
  });

  describe("stripCodeFences()", () => {
    it("should strip ```html opening fence", () => {
      expect(stripCodeFences("```html\n<div>hello</div>\n```")).toBe("<div>hello</div>");
    });

    it("should strip plain ``` opening fence", () => {
      expect(stripCodeFences("```\n<p>text</p>\n```")).toBe("<p>text</p>");
    });

    it("should return text unchanged when no fences present", () => {
      expect(stripCodeFences("<div>hello</div>")).toBe("<div>hello</div>");
    });

    it("should handle text with only opening fence", () => {
      expect(stripCodeFences("```html\n<div>hello</div>")).toBe("<div>hello</div>");
    });

    it("should handle text with only closing fence", () => {
      expect(stripCodeFences("<div>hello</div>\n```")).toBe("<div>hello</div>");
    });

    it("should handle whitespace around fences", () => {
      expect(stripCodeFences("  ```html\n<div>hello</div>\n```  ")).toBe("<div>hello</div>");
    });
  });
});
