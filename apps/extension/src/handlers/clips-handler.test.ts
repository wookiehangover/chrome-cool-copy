/**
 * Clips Handler Tests
 * Tests for savePageToDatabase, checkExistingClip, addHighlight handlers
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetChromeMocks } from "../test/setup.js";

const mockSaveLocalClip = vi.fn();
const mockIsUrlClipped = vi.fn();
const mockAddHighlight = vi.fn();
const mockIsAgentDBConfigured = vi.fn();
const mockSyncClipToAgentDB = vi.fn();

vi.mock("../services/local-clips", () => ({
  saveLocalClip: (...args: unknown[]) => mockSaveLocalClip(...args),
  isUrlClipped: (...args: unknown[]) => mockIsUrlClipped(...args),
  addHighlight: (...args: unknown[]) => mockAddHighlight(...args),
  updateHighlightNote: vi.fn(),
  deleteHighlight: vi.fn(),
  updateLocalClip: vi.fn(),
  getLocalClips: vi.fn(),
  getLocalClip: vi.fn(),
}));

vi.mock("../services/clips-sync", () => ({
  syncClipToAgentDB: (...args: unknown[]) => mockSyncClipToAgentDB(...args),
  isAgentDBConfigured: (...args: unknown[]) => mockIsAgentDBConfigured(...args),
  syncPendingClips: vi.fn(),
  deleteClipWithSync: vi.fn(),
  syncFromAgentDB: vi.fn(),
}));

vi.mock("../services/element-ai-summary", () => ({
  generateElementSummary: vi.fn(),
}));

vi.mock("../services/element-ai-service", () => ({
  generateElementTitleAndDescription: vi.fn(),
}));

vi.mock("../services/asset-store", () => ({
  initAssetStore: vi.fn(),
  saveAsset: vi.fn(),
  getAssetAsDataUrl: vi.fn(),
}));

import { clipsHandlers } from "./clips-handler.js";

function callHandler(
  action: string,
  message: Record<string, unknown>,
  sender: Partial<chrome.runtime.MessageSender> = {},
): Promise<unknown> {
  return new Promise((resolve) => {
    const handler = clipsHandlers[action];
    const fullSender: chrome.runtime.MessageSender = { id: "test-ext", ...sender };
    handler(message, fullSender, resolve);
  });
}

describe("Clips Handlers", () => {
  beforeEach(() => {
    resetChromeMocks();
    vi.clearAllMocks();
  });

  describe("savePageToDatabase", () => {
    it("should save clip locally and return success", async () => {
      mockSaveLocalClip.mockResolvedValue({ id: "clip-123" });
      mockIsAgentDBConfigured.mockResolvedValue(false);

      const result = await callHandler("savePageToDatabase", {
        url: "https://example.com",
        title: "Example Page",
        domContent: "<div>content</div>",
        textContent: "content",
        metadata: {},
      });

      expect(result).toEqual({
        success: true,
        message: "Page clipped successfully (stored locally)",
        clipId: "clip-123",
      });
      expect(mockSaveLocalClip).toHaveBeenCalledWith({
        url: "https://example.com",
        title: "Example Page",
        dom_content: "<div>content</div>",
        text_content: "content",
        metadata: {},
      });
    });

    it("should attempt AgentDB sync when configured", async () => {
      mockSaveLocalClip.mockResolvedValue({ id: "clip-456" });
      mockIsAgentDBConfigured.mockResolvedValue(true);
      mockSyncClipToAgentDB.mockResolvedValue(undefined);

      const result = await callHandler("savePageToDatabase", {
        url: "https://example.com",
        title: "Test",
        domContent: "<p>test</p>",
        textContent: "test",
      });

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          message: "Page clipped successfully (syncing to AgentDB)",
          clipId: "clip-456",
        }),
      );
    });

    it("should return error when saveLocalClip fails", async () => {
      mockSaveLocalClip.mockRejectedValue(new Error("Storage full"));

      const result = await callHandler("savePageToDatabase", {
        url: "https://example.com",
        title: "Test",
        domContent: "<p>test</p>",
        textContent: "test",
      });

      expect(result).toEqual({ success: false, error: "Storage full" });
    });
  });

  describe("checkExistingClip", () => {
    it("should return existing clip when found", async () => {
      const clip = { id: "clip-existing", url: "https://example.com" };
      mockIsUrlClipped.mockResolvedValue(clip);

      const result = await callHandler("checkExistingClip", {
        url: "https://example.com",
      });

      expect(result).toEqual({ success: true, clip });
    });

    it("should return null clip when not found", async () => {
      mockIsUrlClipped.mockResolvedValue(null);

      const result = await callHandler("checkExistingClip", {
        url: "https://new-page.com",
      });

      expect(result).toEqual({ success: true, clip: null });
    });

    it("should return error on failure", async () => {
      mockIsUrlClipped.mockRejectedValue(new Error("DB error"));

      const result = await callHandler("checkExistingClip", {
        url: "https://example.com",
      });

      expect(result).toEqual({ success: false, error: "DB error" });
    });
  });

  describe("addHighlight", () => {
    it("should add highlight and return it", async () => {
      const highlightData = { id: "hl-1", text: "highlighted text", color: "yellow" };
      mockAddHighlight.mockResolvedValue(highlightData);

      const result = await callHandler("addHighlight", {
        clipId: "clip-123",
        highlight: { text: "highlighted text", color: "yellow" },
      });

      expect(result).toEqual({ success: true, highlight: highlightData });
      expect(mockAddHighlight).toHaveBeenCalledWith("clip-123", {
        text: "highlighted text",
        color: "yellow",
      });
    });

    it("should return error when addHighlight fails", async () => {
      mockAddHighlight.mockRejectedValue(new Error("Clip not found"));

      const result = await callHandler("addHighlight", {
        clipId: "nonexistent",
        highlight: { text: "test" },
      });

      expect(result).toEqual({ success: false, error: "Clip not found" });
    });
  });
});
