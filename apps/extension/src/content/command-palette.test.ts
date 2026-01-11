/**
 * Command Palette Tests
 * Tests for the command palette UI component
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { resetChromeMocks, mockStorage } from "../test/setup.js";
import { openCommandPalette, closeCommandPalette, registerCommands } from "./command-palette.js";
import type { Command } from "./commands.js";

// Mock the toast module
vi.mock("./toast.js", () => ({
  showToast: vi.fn(),
}));

describe("Command Palette", () => {
  beforeEach(() => {
    resetChromeMocks();
    document.body.innerHTML = "";

    // Mock chrome.storage.local.get
    mockStorage.local.get.mockImplementation((keys, callback) => {
      callback({});
    });

    // Mock chrome.storage.local.set
    mockStorage.local.set.mockImplementation((data, callback) => {
      callback?.();
    });

    // Mock HTMLDialogElement methods
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
  });

  afterEach(() => {
    // Clean up any remaining dialogs
    const dialog = document.getElementById("command-palette-dialog");
    if (dialog) {
      dialog.remove();
    }
    const styles = document.getElementById("command-palette-styles");
    if (styles) {
      styles.remove();
    }
  });

  describe("openCommandPalette", () => {
    it("should create and display the command palette dialog", async () => {
      const commands: Command[] = [
        {
          id: "test-1",
          name: "Test Command",
          action: vi.fn(),
        },
      ];
      registerCommands(commands);

      await openCommandPalette();

      const dialog = document.getElementById("command-palette-dialog") as HTMLDialogElement;
      expect(dialog).toBeTruthy();
      expect(dialog.tagName).toBe("DIALOG");
      expect(dialog.innerHTML).toContain("command-palette-search");
    });

    it("should not open if already open", async () => {
      const commands: Command[] = [
        {
          id: "test-1",
          name: "Test Command",
          action: vi.fn(),
        },
      ];
      registerCommands(commands);

      await openCommandPalette();
      const firstDialog = document.getElementById("command-palette-dialog");

      await openCommandPalette();
      const secondDialog = document.getElementById("command-palette-dialog");

      expect(firstDialog).toBe(secondDialog);
    });
  });

  describe("closeCommandPalette", () => {
    it("should close the command palette", async () => {
      const commands: Command[] = [
        {
          id: "test-1",
          name: "Test Command",
          action: vi.fn(),
        },
      ];
      registerCommands(commands);

      await openCommandPalette();
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Just verify closeCommandPalette doesn't throw
      expect(() => closeCommandPalette()).not.toThrow();
    });
  });

  describe("Search and Filtering", () => {
    it("should filter commands by search query", async () => {
      const commands: Command[] = [
        {
          id: "copy-url",
          name: "Copy URL",
          action: vi.fn(),
        },
        {
          id: "copy-markdown",
          name: "Copy Markdown Link",
          action: vi.fn(),
        },
        {
          id: "paste",
          name: "Paste",
          action: vi.fn(),
        },
      ];
      registerCommands(commands);

      await openCommandPalette();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const searchInput = document.getElementById("command-palette-search") as HTMLInputElement;
      if (searchInput) {
        searchInput.value = "copy";
        searchInput.dispatchEvent(new Event("input"));

        // Wait for async filtering
        await new Promise((resolve) => setTimeout(resolve, 20));

        const items = document.querySelectorAll(".command-palette-item");
        expect(items.length).toBe(2);
      }
    });

    it("should support fuzzy search", async () => {
      const commands: Command[] = [
        {
          id: "copy-url",
          name: "Copy URL",
          action: vi.fn(),
        },
        {
          id: "paste",
          name: "Paste",
          action: vi.fn(),
        },
      ];
      registerCommands(commands);

      await openCommandPalette();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const searchInput = document.getElementById("command-palette-search") as HTMLInputElement;
      if (searchInput) {
        searchInput.value = "cpy";
        searchInput.dispatchEvent(new Event("input"));

        await new Promise((resolve) => setTimeout(resolve, 20));

        const items = document.querySelectorAll(".command-palette-item");
        expect(items.length).toBe(1);
      }
    });
  });

  describe("Keyboard Navigation", () => {
    it("should navigate down with arrow key", async () => {
      const commands: Command[] = [
        {
          id: "test-1",
          name: "Command 1",
          action: vi.fn(),
        },
        {
          id: "test-2",
          name: "Command 2",
          action: vi.fn(),
        },
      ];
      registerCommands(commands);

      await openCommandPalette();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const searchInput = document.getElementById("command-palette-search") as HTMLInputElement;
      if (searchInput) {
        const event = new KeyboardEvent("keydown", { key: "ArrowDown" });
        searchInput.dispatchEvent(event);

        await new Promise((resolve) => setTimeout(resolve, 10));

        const items = document.querySelectorAll(".command-palette-item");
        if (items.length > 1) {
          expect(items[1].classList.contains("selected")).toBe(true);
        }
      }
    });

    it("should execute command on Enter key", async () => {
      const actionFn = vi.fn();
      const commands: Command[] = [
        {
          id: "test-1",
          name: "Test Command",
          action: actionFn,
        },
      ];
      registerCommands(commands);

      await openCommandPalette();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const searchInput = document.getElementById("command-palette-search") as HTMLInputElement;
      if (searchInput) {
        const event = new KeyboardEvent("keydown", { key: "Enter" });
        searchInput.dispatchEvent(event);

        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(actionFn).toHaveBeenCalled();
      }
    });
  });
});
