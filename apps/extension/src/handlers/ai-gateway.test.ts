/**
 * AI Gateway Tests
 * Tests for getAIGateway configuration loading and stripCodeFences utility
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createGateway as createRealGateway } from "ai";
import { resetChromeMocks, mockStorage } from "../test/setup.js";
import type { JSONObject } from "@repo/shared/types";

import { getAIGateway, stripCodeFences } from "./ai-gateway.js";

const createGateway = vi.fn(createRealGateway);

describe("AI Gateway", () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  describe("getAIGateway()", () => {
    it("should return gateway and config when valid config exists", async () => {
      const validConfig = { apiKey: "test-key-123", model: "openai/gpt-4" };
      mockStorage.sync.get.mockImplementation(
        (_keys: string[], callback: (result: JSONObject) => void) => {
          callback({ aiGatewayConfig: validConfig });
        },
      );

      const result = await getAIGateway(createGateway);

      expect(result.config).toEqual(validConfig);
      expect(result.gateway).toBeDefined();
      expect(result.gateway).toBeInstanceOf(Function);
    });

    it("should throw when config is missing entirely", async () => {
      mockStorage.sync.get.mockImplementation(
        (_keys: string[], callback: (result: JSONObject) => void) => {
          callback({});
        },
      );

      await expect(getAIGateway(createGateway)).rejects.toThrow(
        "Vercel AI Gateway configuration not found",
      );
    });

    it("should throw when apiKey is missing", async () => {
      mockStorage.sync.get.mockImplementation(
        (_keys: string[], callback: (result: JSONObject) => void) => {
          callback({ aiGatewayConfig: { apiKey: "", model: "openai/gpt-4" } });
        },
      );

      await expect(getAIGateway(createGateway)).rejects.toThrow(
        "Vercel AI Gateway configuration not found",
      );
    });

    it("should throw when model is missing", async () => {
      mockStorage.sync.get.mockImplementation(
        (_keys: string[], callback: (result: JSONObject) => void) => {
          callback({ aiGatewayConfig: { apiKey: "test-key", model: "" } });
        },
      );

      await expect(getAIGateway(createGateway)).rejects.toThrow(
        "Vercel AI Gateway configuration not found",
      );
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
