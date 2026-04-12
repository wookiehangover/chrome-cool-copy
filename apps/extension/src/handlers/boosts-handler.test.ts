/**
 * Boosts Handler Tests
 * Tests for getBoosts, toggleBoost, deleteBoost, runBoost handlers
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetChromeMocks } from "../test/setup.js";

const mockGetBoosts = vi.fn();
const mockToggleBoost = vi.fn();
const mockDeleteBoost = vi.fn();
const mockUpdateBoost = vi.fn();
const mockGetBoostsForDomain = vi.fn();
const mockExecuteScript = vi.fn();

vi.mock("../services/boosts", () => ({
  getBoosts: (...args: unknown[]) => mockGetBoosts(...args),
  toggleBoost: (...args: unknown[]) => mockToggleBoost(...args),
  deleteBoost: (...args: unknown[]) => mockDeleteBoost(...args),
  updateBoost: (...args: unknown[]) => mockUpdateBoost(...args),
  getBoostsForDomain: (...args: unknown[]) => mockGetBoostsForDomain(...args),
}));

// Mock chrome.scripting for executeBoostCode
vi.stubGlobal("chrome", {
  ...globalThis.chrome,
  scripting: {
    executeScript: (...args: unknown[]) => mockExecuteScript(...args),
  },
  tabs: globalThis.chrome?.tabs,
  storage: globalThis.chrome?.storage,
  runtime: globalThis.chrome?.runtime,
});

import { boostsHandlers, boostDrafts } from "./boosts-handler.js";

function callHandler(
  action: string,
  message: Record<string, unknown>,
  sender: Partial<chrome.runtime.MessageSender> = {},
): Promise<unknown> {
  return new Promise((resolve) => {
    const handler = boostsHandlers[action];
    const fullSender: chrome.runtime.MessageSender = { id: "test-ext", ...sender };
    handler(message, fullSender, resolve);
  });
}

describe("Boosts Handlers", () => {
  beforeEach(() => {
    resetChromeMocks();
    vi.clearAllMocks();
    boostDrafts.clear();
  });

  describe("getBoosts", () => {
    it("should return all boosts on success", async () => {
      const boosts = [
        { id: "b1", name: "Boost 1", enabled: true },
        { id: "b2", name: "Boost 2", enabled: false },
      ];
      mockGetBoosts.mockResolvedValue(boosts);

      const result = await callHandler("getBoosts", {});

      expect(result).toEqual({ success: true, data: boosts });
    });

    it("should return error on failure", async () => {
      mockGetBoosts.mockRejectedValue(new Error("Storage error"));

      const result = await callHandler("getBoosts", {});

      expect(result).toEqual({ success: false, error: "Storage error" });
    });
  });

  describe("toggleBoost", () => {
    it("should toggle boost and return updated boost", async () => {
      const toggled = { id: "b1", name: "Boost", enabled: false };
      mockToggleBoost.mockResolvedValue(toggled);

      const result = await callHandler("toggleBoost", { id: "b1" });

      expect(result).toEqual({ success: true, data: toggled });
      expect(mockToggleBoost).toHaveBeenCalledWith("b1");
    });

    it("should throw when id is missing", async () => {
      const result = await callHandler("toggleBoost", {});

      expect(result).toEqual({ success: false, error: "Boost ID is required" });
    });
  });

  describe("deleteBoost", () => {
    it("should delete boost and return success", async () => {
      mockDeleteBoost.mockResolvedValue(true);

      const result = await callHandler("deleteBoost", { id: "b1" });

      expect(result).toEqual({ success: true, data: true });
      expect(mockDeleteBoost).toHaveBeenCalledWith("b1");
    });

    it("should return false data when boost not found", async () => {
      mockDeleteBoost.mockResolvedValue(false);

      const result = await callHandler("deleteBoost", { id: "nonexistent" });

      expect(result).toEqual({ success: false, data: false });
    });

    it("should throw when id is missing", async () => {
      const result = await callHandler("deleteBoost", {});

      expect(result).toEqual({ success: false, error: "Boost ID is required" });
    });
  });

  describe("runBoost", () => {
    it("should find boost by id and execute its code", async () => {
      const boosts = [{ id: "b1", name: "Test Boost", code: "document.title = 'boosted'" }];
      mockGetBoosts.mockResolvedValue(boosts);
      mockExecuteScript.mockResolvedValue([
        { result: Promise.resolve({ success: true, result: "boosted" }) },
      ]);

      const result = await callHandler(
        "runBoost",
        { boostId: "b1" },
        { tab: { id: 42 } as chrome.tabs.Tab },
      );

      expect(result).toEqual({ success: true, result: "boosted" });
      expect(mockGetBoosts).toHaveBeenCalled();
    });

    it("should return error when boost not found", async () => {
      mockGetBoosts.mockResolvedValue([]);

      const result = await callHandler(
        "runBoost",
        { boostId: "nonexistent" },
        { tab: { id: 42 } as chrome.tabs.Tab },
      );

      expect(result).toEqual({ success: false, error: "Boost not found" });
    });

    it("should return error when no tab ID available", async () => {
      // Mock chrome.tabs.query to return empty
      (globalThis.chrome.tabs.query as ReturnType<typeof vi.fn>).mockImplementation(
        (_query: unknown, callback: (tabs: unknown[]) => void) => {
          callback([]);
        },
      );
      // For the promise-based path
      (globalThis.chrome.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await callHandler("runBoost", { boostId: "b1" });

      expect(result).toEqual({ success: false, error: "No tab ID available" });
    });

    it("should throw when boostId is missing", async () => {
      const result = await callHandler("runBoost", {}, { tab: { id: 42 } as chrome.tabs.Tab });

      expect(result).toEqual({ success: false, error: "Boost ID is required" });
    });
  });

  describe("getBoostsForDomain", () => {
    it("should return boosts for a domain", async () => {
      const boosts = [{ id: "b1", name: "GH Boost", domain: "github.com" }];
      mockGetBoostsForDomain.mockResolvedValue(boosts);

      const result = await callHandler("getBoostsForDomain", {
        hostname: "github.com",
      });

      expect(result).toEqual({ success: true, boosts });
    });

    it("should throw when hostname is missing", async () => {
      const result = await callHandler("getBoostsForDomain", {});

      expect(result).toEqual({ success: false, error: "Hostname is required" });
    });
  });
});
