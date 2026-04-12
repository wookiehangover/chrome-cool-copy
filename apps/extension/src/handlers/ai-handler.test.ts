/**
 * AI Handler Tests
 * Tests for generateText and tidyContent message handlers
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetChromeMocks } from "../test/setup.js";

// Mock dependencies
const mockGetAIGateway = vi.fn();
const mockGenerateText = vi.fn();

vi.mock("./ai-gateway", () => ({
  getAIGateway: (...args: unknown[]) => mockGetAIGateway(...args),
  HTML_CLEANING_SYSTEM_PROMPT: "mock system prompt",
  HTML_CLEANING_SYSTEM_PROMPT_STRICT: "mock strict system prompt",
  stripCodeFences: (text: string) => text.replace(/^```html?\n?/, "").replace(/\n?```$/, ""),
}));

vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

vi.mock("../tools/browse", () => ({
  tools: { mockTool: {} },
}));

import { aiHandlers } from "./ai-handler.js";

function callHandler(
  action: string,
  message: Record<string, unknown>,
  sender: Partial<chrome.runtime.MessageSender> = {},
): Promise<unknown> {
  return new Promise((resolve) => {
    const handler = aiHandlers[action];
    const fullSender: chrome.runtime.MessageSender = { id: "test-ext", ...sender };
    handler(message, fullSender, resolve);
  });
}

describe("AI Handlers", () => {
  beforeEach(() => {
    resetChromeMocks();
    vi.clearAllMocks();
  });

  describe("generateText", () => {
    it("should return generated text on success", async () => {
      const mockGateway = vi.fn((model: string) => ({ model }));
      mockGetAIGateway.mockResolvedValue({
        gateway: mockGateway,
        config: { apiKey: "key", model: "default-model" },
      });
      mockGenerateText.mockResolvedValue({
        text: "Hello world",
        usage: { inputTokens: 10, outputTokens: 5 },
      });

      const result = await callHandler("generateText", {
        action: "generateText",
        messages: [{ role: "user", content: "Hi" }],
      });

      expect(result).toEqual({
        success: true,
        content: "Hello world",
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });
    });

    it("should use request model over config model", async () => {
      const mockGateway = vi.fn((model: string) => ({ model }));
      mockGetAIGateway.mockResolvedValue({
        gateway: mockGateway,
        config: { apiKey: "key", model: "default-model" },
      });
      mockGenerateText.mockResolvedValue({ text: "ok", usage: null });

      await callHandler("generateText", {
        action: "generateText",
        messages: [{ role: "user", content: "Hi" }],
        model: "custom-model",
      });

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({ model: { model: "custom-model" } }),
      );
    });

    it("should return error when messages is missing", async () => {
      mockGetAIGateway.mockResolvedValue({
        gateway: vi.fn(),
        config: { apiKey: "key", model: "m" },
      });

      const result = await callHandler("generateText", {
        action: "generateText",
      });

      expect(result).toEqual({
        success: false,
        error: "Invalid request: messages array is required",
      });
    });

    it("should return error when gateway config is missing", async () => {
      mockGetAIGateway.mockRejectedValue(new Error("Vercel AI Gateway configuration not found"));

      const result = await callHandler("generateText", {
        action: "generateText",
        messages: [{ role: "user", content: "Hi" }],
      });

      expect(result).toEqual({
        success: false,
        error: "Vercel AI Gateway configuration not found",
      });
    });
  });

  describe("tidyContent", () => {
    it("should return cleaned HTML on success", async () => {
      mockGetAIGateway.mockResolvedValue({
        gateway: vi.fn((model: string) => ({ model })),
        config: { apiKey: "key", model: "m" },
      });
      mockGenerateText.mockResolvedValue({ text: "<p>Clean content</p>" });

      const result = await callHandler("tidyContent", {
        action: "tidyContent",
        domContent: "<div><nav>nav</nav><p>Clean content</p></div>",
      });

      expect(result).toEqual({ success: true, data: "<p>Clean content</p>" });
    });

    it("should return error when domContent is missing", async () => {
      const result = await callHandler("tidyContent", {
        action: "tidyContent",
      });

      expect(result).toEqual({
        success: false,
        error: "domContent is required and must be a string",
      });
    });

    it("should return error when domContent is not a string", async () => {
      const result = await callHandler("tidyContent", {
        action: "tidyContent",
        domContent: 123,
      });

      expect(result).toEqual({
        success: false,
        error: "domContent is required and must be a string",
      });
    });

    it("should return error when AI call fails", async () => {
      mockGetAIGateway.mockRejectedValue(new Error("API rate limit exceeded"));

      const result = await callHandler("tidyContent", {
        action: "tidyContent",
        domContent: "<div>some html</div>",
      });

      expect(result).toEqual({
        success: false,
        error: "API rate limit exceeded",
      });
    });
  });
});
