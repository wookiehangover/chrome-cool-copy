/**
 * AI Handler Tests
 * Tests for generateText and tidyContent message handlers
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetChromeMocks } from "../test/setup.js";
import type { BrowserMessage, BrowserResponse } from "./types.js";
import { createAIHandlers } from "./ai-handler.js";
import { tools } from "../tools/browse.js";

const mockGetAIGateway = vi.fn();
const mockGenerateText = vi.fn();
const aiHandlers = createAIHandlers({
  getAIGateway: mockGetAIGateway,
  generateText: mockGenerateText,
  tools,
});

function callHandler(
  action: string,
  message: BrowserMessage,
  sender: Partial<chrome.runtime.MessageSender> = {},
): Promise<BrowserResponse | undefined> {
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
