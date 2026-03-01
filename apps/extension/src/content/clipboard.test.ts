/**
 * Clipboard Utility Tests
 * Tests for clipboard copy functions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { copyToClipboard, copyImageToClipboard } from "./clipboard.js";

// Mock ClipboardItem since jsdom doesn't support it
class MockClipboardItem {
  types: string[];
  constructor(public items: Record<string, Blob>) {
    this.types = Object.keys(items);
  }
  getType(type: string): Promise<Blob> {
    return Promise.resolve(this.items[type]);
  }
}

describe("Clipboard Utilities", () => {
  let writeTextMock: ReturnType<typeof vi.fn>;
  let writeMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let originalClipboardItem: typeof ClipboardItem | undefined;

  beforeEach(() => {
    // Save original ClipboardItem if exists
    originalClipboardItem = globalThis.ClipboardItem;

    // Mock ClipboardItem
    globalThis.ClipboardItem = MockClipboardItem as unknown as typeof ClipboardItem;

    // Mock navigator.clipboard API
    writeTextMock = vi.fn();
    writeMock = vi.fn();

    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextMock,
        write: writeMock,
      },
      writable: true,
      configurable: true,
    });

    // Spy on console.error to verify error logging
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore original ClipboardItem
    if (originalClipboardItem) {
      globalThis.ClipboardItem = originalClipboardItem;
    }
  });

  describe("copyToClipboard()", () => {
    it("should return true when text is copied successfully", async () => {
      writeTextMock.mockResolvedValue(undefined);

      const result = await copyToClipboard("test text");

      expect(result).toBe(true);
      expect(writeTextMock).toHaveBeenCalledWith("test text");
      expect(writeTextMock).toHaveBeenCalledTimes(1);
    });

    it("should copy empty string successfully", async () => {
      writeTextMock.mockResolvedValue(undefined);

      const result = await copyToClipboard("");

      expect(result).toBe(true);
      expect(writeTextMock).toHaveBeenCalledWith("");
    });

    it("should copy text with special characters successfully", async () => {
      writeTextMock.mockResolvedValue(undefined);
      const specialText = "Hello\nWorld\t!@#$%^&*()";

      const result = await copyToClipboard(specialText);

      expect(result).toBe(true);
      expect(writeTextMock).toHaveBeenCalledWith(specialText);
    });

    it("should return false and log error when clipboard API fails", async () => {
      const error = new Error("Clipboard access denied");
      writeTextMock.mockRejectedValue(error);

      const result = await copyToClipboard("test text");

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to copy to clipboard:", error);
    });

    it("should return false when clipboard API throws DOMException", async () => {
      const domError = new DOMException("Not allowed", "NotAllowedError");
      writeTextMock.mockRejectedValue(domError);

      const result = await copyToClipboard("test");

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to copy to clipboard:", domError);
    });
  });

  describe("copyImageToClipboard()", () => {
    it("should return true when image blob is copied successfully", async () => {
      writeMock.mockResolvedValue(undefined);
      const blob = new Blob(["fake image data"], { type: "image/png" });

      const result = await copyImageToClipboard(blob);

      expect(result).toBe(true);
      expect(writeMock).toHaveBeenCalledTimes(1);
      // Verify ClipboardItem was created with correct structure
      const call = writeMock.mock.calls[0];
      expect(call[0]).toHaveLength(1);
      expect(call[0][0]).toBeInstanceOf(ClipboardItem);
    });

    it("should return false and log error when clipboard API fails", async () => {
      const error = new Error("Clipboard write failed");
      writeMock.mockRejectedValue(error);
      const blob = new Blob(["fake image data"], { type: "image/png" });

      const result = await copyImageToClipboard(blob);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to copy image to clipboard:", error);
    });

    it("should return false when ClipboardItem construction fails", async () => {
      // Create a throwing class for ClipboardItem
      const constructorError = new Error("Invalid blob type");
      class ThrowingClipboardItem {
        constructor() {
          throw constructorError;
        }
      }

      globalThis.ClipboardItem = ThrowingClipboardItem as unknown as typeof ClipboardItem;

      const blob = new Blob(["data"], { type: "image/png" });
      const result = await copyImageToClipboard(blob);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to copy image to clipboard:",
        constructorError,
      );

      // Restore mock for other tests
      globalThis.ClipboardItem = MockClipboardItem as unknown as typeof ClipboardItem;
    });

    it("should handle DOMException for permission errors", async () => {
      const domError = new DOMException("Not allowed", "NotAllowedError");
      writeMock.mockRejectedValue(domError);
      const blob = new Blob(["image"], { type: "image/png" });

      const result = await copyImageToClipboard(blob);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to copy image to clipboard:", domError);
    });
  });
});
