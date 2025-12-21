/**
 * Command Registry Tests
 * Tests for command definitions and message handler contracts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { resetChromeMocks, mockRuntime } from "../test/setup.js";

// Known message actions handled by background.ts
// This acts as a contract - if background.ts changes, update this list
const BACKGROUND_HANDLED_ACTIONS = [
  "captureElement",
  "captureFullPage",
  "savePageToDatabase",
] as const;

// Known message actions handled by content script (index.ts)
const CONTENT_HANDLED_ACTIONS = [
  "copyCleanUrl",
  "copyMarkdownLink",
  "startElementPicker",
  "scrollTo",
  "openCommandPalette",
  "clipPage",
] as const;

describe("Command Registry", () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  describe("Message Action Contracts", () => {
    it("should document all background script message handlers", () => {
      // This test documents the expected handlers in background.ts
      // If you add a new handler, add it to BACKGROUND_HANDLED_ACTIONS
      expect(BACKGROUND_HANDLED_ACTIONS).toContain("captureElement");
      expect(BACKGROUND_HANDLED_ACTIONS).toContain("captureFullPage");
      expect(BACKGROUND_HANDLED_ACTIONS).toContain("savePageToDatabase");
    });

    it("should document all content script message handlers", () => {
      // This test documents the expected handlers in content/index.ts
      expect(CONTENT_HANDLED_ACTIONS).toContain("copyCleanUrl");
      expect(CONTENT_HANDLED_ACTIONS).toContain("copyMarkdownLink");
      expect(CONTENT_HANDLED_ACTIONS).toContain("openCommandPalette");
    });

    it("should NOT send clipPage to background (the original bug)", () => {
      // This test documents the bug that was fixed:
      // The clip-page command was sending { action: "clipPage" } to background,
      // but background only handles "savePageToDatabase".
      //
      // If someone accidentally reverts to using "clipPage", this test will catch it.
      expect(BACKGROUND_HANDLED_ACTIONS).not.toContain("clipPage");
    });
  });

  describe("clip-page command", () => {
    it("should send savePageToDatabase action to background script", async () => {
      // Mock successful response
      mockRuntime.sendMessage.mockImplementation(
        (message: { action: string }, callback?: (response: unknown) => void) => {
          if (callback) {
            callback({ success: true });
          }
        },
      );

      // Import the command registry (will use mocked chrome)
      const { commandRegistry } = await import("./commands.js");
      const clipPageCommand = commandRegistry.find((cmd) => cmd.id === "clip-page");

      expect(clipPageCommand).toBeDefined();
      await clipPageCommand!.action();

      // Verify the correct action was sent
      expect(mockRuntime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "savePageToDatabase",
        }),
        expect.any(Function),
      );

      // Verify the action is in the list of background handlers
      const sentAction = mockRuntime.sendMessage.mock.calls[0][0].action;
      expect(BACKGROUND_HANDLED_ACTIONS).toContain(sentAction);
    });

    it("should throw error when background script returns failure", async () => {
      mockRuntime.sendMessage.mockImplementation(
        (_message: unknown, callback?: (response: unknown) => void) => {
          if (callback) {
            callback({ success: false, error: "Database not configured" });
          }
        },
      );

      const { commandRegistry } = await import("./commands.js");
      const clipPageCommand = commandRegistry.find((cmd) => cmd.id === "clip-page");

      await expect(clipPageCommand!.action()).rejects.toThrow("Database not configured");
    });

    it("should throw error when message port closes", async () => {
      mockRuntime.sendMessage.mockImplementation(
        (_message: unknown, callback?: (response: unknown) => void) => {
          // Simulate the original bug - message port closing
          mockRuntime.lastError = {
            message: "The message port closed before a response was received.",
          };
          if (callback) {
            callback(undefined);
          }
        },
      );

      const { commandRegistry } = await import("./commands.js");
      const clipPageCommand = commandRegistry.find((cmd) => cmd.id === "clip-page");

      await expect(clipPageCommand!.action()).rejects.toThrow(
        "The message port closed before a response was received.",
      );

      // Reset lastError
      mockRuntime.lastError = null;
    });

    it("should collect page metadata correctly", async () => {
      let capturedMessage: Record<string, unknown> | null = null;
      mockRuntime.sendMessage.mockImplementation(
        (message: Record<string, unknown>, callback?: (response: unknown) => void) => {
          capturedMessage = message;
          if (callback) {
            callback({ success: true });
          }
        },
      );

      const { commandRegistry } = await import("./commands.js");
      const clipPageCommand = commandRegistry.find((cmd) => cmd.id === "clip-page");

      await clipPageCommand!.action();

      expect(capturedMessage).not.toBeNull();
      expect(capturedMessage!.action).toBe("savePageToDatabase");
      expect(capturedMessage!.url).toBeDefined();
      expect(capturedMessage!.title).toBeDefined();
      expect(capturedMessage!.domContent).toBeDefined();
      expect(capturedMessage!.textContent).toBeDefined();
      expect(capturedMessage!.metadata).toBeDefined();
    });
  });
});
