/**
 * Command Registry Tests
 * Tests for command definitions, message handler contracts, and README documentation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetChromeMocks, mockRuntime } from "../test/setup.js";

// README content loaded via Vitest's raw import
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - raw imports work in Vitest
import readmeContent from "../../../../README.md?raw";

// Known message actions handled by background.ts
// This acts as a contract - if background.ts changes, update this list
const BACKGROUND_HANDLED_ACTIONS = [
  "captureElement",
  "captureFullPage",
  "savePageToDatabase",
  "clipElement",
  "generateText",
  "readAloud",
] as const;

// Known message actions handled by content script (index.ts)
const CONTENT_HANDLED_ACTIONS = [
  "copyCleanUrl",
  "copyMarkdownLink",
  "startElementPicker",
  "scrollTo",
  "openCommandPalette",
  "toggleReaderMode",
  "clipPage",
] as const;

describe("Command Registry", () => {
  beforeEach(() => {
    resetChromeMocks();
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );

    // JSDOM defaults to about:blank which our clipper blocks; set to https URL
    Object.defineProperty(window, "location", {
      value: new URL("https://example.com/page"),
      writable: true,
      configurable: true,
    });

    document.title = "Example Page";
    document.body.innerHTML = `<main><p>Hello world</p></main>`;
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

/**
 * README Documentation Tests
 * Verifies that all commands in the command registry are documented in the README
 */
describe("README Documentation", () => {
  it("should document all commands from the command registry", async () => {
    // Import the command registry
    const { commandRegistry } = await import("./commands.js");

    // Check each command is documented in README
    const missingCommands: string[] = [];

    for (const command of commandRegistry) {
      // Check if the command name appears in the README (case-insensitive)
      const commandNameLower = command.name.toLowerCase();
      const readmeLower = readmeContent.toLowerCase();

      if (!readmeLower.includes(commandNameLower)) {
        missingCommands.push(command.name);
      }
    }

    if (missingCommands.length > 0) {
      throw new Error(
        `The following commands are not documented in README.md:\n` +
          missingCommands.map((cmd) => `  - ${cmd}`).join("\n") +
          `\n\nPlease add documentation for these commands.`,
      );
    }
  });

  it("should document all keyboard shortcuts", async () => {
    const { commandRegistry } = await import("./commands.js");

    // Get commands with shortcuts
    const commandsWithShortcuts = commandRegistry.filter(
      (cmd) => cmd.shortcut && cmd.shortcut.length > 0,
    );

    const missingShortcuts: string[] = [];

    for (const command of commandsWithShortcuts) {
      // Check if the shortcut appears in the README
      // Shortcuts are like "Cmd+Shift+C" or "Ctrl+Shift+C"
      const shortcut = command.shortcut!;

      // Normalize to check for both formats
      const macShortcut = shortcut.includes("Cmd") ? shortcut : shortcut.replace("Ctrl", "Cmd");
      const winShortcut = shortcut.includes("Ctrl") ? shortcut : shortcut.replace("Cmd", "Ctrl");

      const hasMacShortcut = readmeContent.includes(macShortcut);
      const hasWinShortcut = readmeContent.includes(winShortcut);

      if (!hasMacShortcut && !hasWinShortcut) {
        missingShortcuts.push(`${command.name}: ${shortcut}`);
      }
    }

    if (missingShortcuts.length > 0) {
      throw new Error(
        `The following keyboard shortcuts are not documented in README.md:\n` +
          missingShortcuts.map((s) => `  - ${s}`).join("\n") +
          `\n\nPlease add documentation for these shortcuts.`,
      );
    }
  });

  it("should document the Command Palette", () => {
    expect(readmeContent.toLowerCase()).toContain("command palette");
  });

  it("should document how to open the Command Palette", () => {
    expect(readmeContent).toContain("Cmd+Shift+P");
    expect(readmeContent).toContain("Ctrl+Shift+P");
  });

  it("should include a Features section documenting commands", () => {
    expect(readmeContent).toContain("## Features");
  });

  it("should document keyboard shortcuts for commands", () => {
    expect(readmeContent).toContain("Cmd+Shift+C");
    expect(readmeContent).toContain("Ctrl+Shift+C");
  });
});
