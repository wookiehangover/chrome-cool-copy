/**
 * Command Registry
 * Centralized definition of all available commands in the extension
 */

import { handleCopyCleanUrl } from "./features/url-cleaner.js";
import { handleCopyMarkdownLink } from "./features/markdown.js";
import { startElementPicker } from "./features/element-picker.js";
import {
  setDarkModePreference,
  getCurrentPreference,
  isDarkModeActive,
} from "./features/dark-mode-manager.js";
import { openDarkModePanel } from "./features/dark-mode-panel.js";
import { toggleBannerState } from "./features/grokipedia-banner.js";
import { isWikipediaPage } from "./features/wikipedia-detector.js";
import { showToast } from "./toast.js";
import { buildPageClipPayload, handleClipError } from "./features/page-clip.js";
import { toggleReaderMode } from "./features/reader-mode.js";
import { getBoostsForDomain } from "../services/boosts.js";
import type { Boost } from "@repo/shared";

/**
 * Command interface defining the structure of a command
 */
export interface Command {
  id: string;
  name: string;
  description?: string;
  shortcut?: string;
  action: () => void | Promise<void>;
  /** Optional function to determine if command should be visible in the palette */
  isVisible?: () => boolean;
}

/**
 * Get platform-specific shortcut display
 */
function getPlatformShortcut(macShortcut: string, otherShortcut: string): string {
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  return isMac ? macShortcut : otherShortcut;
}

/**
 * Command registry containing all available commands
 */
export const commandRegistry: Command[] = [
  {
    id: "copy-clean-url",
    name: "Copy clean URL",
    description: "Copy URL without tracking parameters",
    shortcut: getPlatformShortcut("Cmd+Shift+C", "Ctrl+Shift+C"),
    action: handleCopyCleanUrl,
  },
  {
    id: "copy-markdown-link",
    name: "Copy markdown link",
    description: "Copy markdown formatted link",
    shortcut: getPlatformShortcut("Cmd+Shift+X", "Ctrl+Shift+X"),
    action: handleCopyMarkdownLink,
  },
  {
    id: "copy-element",
    name: "Copy element",
    description: "Copy selected element to clipboard",
    shortcut: "",
    action: startElementPicker,
  },
  {
    id: "reader-mode",
    name: "Reader mode",
    description: "Toggle distraction-free reading mode",
    shortcut: "",
    action: toggleReaderMode,
  },
  {
    id: "clip-page",
    name: "Clip page",
    description: "Save current page locally (syncs to AgentDB if configured)",
    shortcut: "",
    action: async () => {
      try {
        const pageData = buildPageClipPayload();

        // Send page data to background script for database storage
        const response = await new Promise<{
          success: boolean;
          error?: string;
        }>((resolve) => {
          chrome.runtime.sendMessage(
            {
              action: "savePageToDatabase",
              ...pageData,
            },
            (response) => {
              if (chrome.runtime.lastError) {
                resolve({
                  success: false,
                  error: chrome.runtime.lastError.message,
                });
              } else {
                resolve(response || { success: false, error: "No response" });
              }
            },
          );
        });

        if (response.success) {
          showToast("Page clipped successfully!");
        } else {
          throw new Error(response.error || "Failed to clip page");
        }
      } catch (error) {
        handleClipError(error);
        throw error;
      }
    },
  },
  {
    id: "view-clipped-pages",
    name: "View clipped pages",
    description: "Open the clipped pages viewer",
    shortcut: "",
    action: () => {
      const clippedPagesUrl = chrome.runtime.getURL("pages/clipped-pages.html");
      window.open(clippedPagesUrl, "_blank");
    },
  },
  {
    id: "open-side-panel",
    name: "Open side panel",
    description: "Open the clipped pages side panel",
    shortcut: "",
    action: () => {
      chrome.runtime.sendMessage({ action: "openSidePanel" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("[Side Panel] Error opening side panel:", chrome.runtime.lastError);
        } else if (response && response.success) {
          console.log("[Side Panel] Side panel opened successfully");
        }
      });
    },
  },
  {
    id: "settings",
    name: "Settings",
    description: "Open extension settings",
    shortcut: "",
    action: () => {
      const settingsUrl = chrome.runtime.getURL("pages/settings.html");
      window.open(settingsUrl, "_blank");
    },
  },
  {
    id: "dark-mode-toggle",
    name: "Dark Mode: Toggle",
    description: "Toggle dark mode on/off for this domain",
    shortcut: "",
    action: async () => {
      const current = getCurrentPreference();
      const newPref = current === "off" ? "always" : "off";
      await setDarkModePreference(newPref);
      showToast(newPref === "always" ? "Dark mode: On" : "Dark mode: Off");
    },
  },
  {
    id: "dark-mode-system",
    name: "Dark Mode: Follow System",
    description: "Follow system dark mode preference",
    shortcut: "",
    action: async () => {
      await setDarkModePreference("system");
      showToast("Dark mode: Follow System");
    },
  },
  {
    id: "dark-mode-adjust",
    name: "Dark Mode: Adjust",
    description: "Open dark mode adjustment panel",
    shortcut: "",
    action: () => {
      if (!isDarkModeActive()) {
        showToast("Enable dark mode first");
        return;
      }
      openDarkModePanel();
    },
  },
  {
    id: "toggle-grokipedia-banner",
    name: "Toggle Grokipedia Banner",
    description: "Toggle Grokipedia banner on Wikipedia pages",
    shortcut: "",
    isVisible: isWikipediaPage,
    action: async () => {
      const newState = await toggleBannerState();
      const message = newState ? "Grokipedia Banner: Enabled" : "Grokipedia Banner: Disabled";
      showToast(message);
    },
  },
  {
    id: "open-chat",
    name: "Open Chat",
    description: "Open the chat side panel",
    shortcut: "",
    action: () => {
      // Content scripts don't have access to chrome.tabs or chrome.sidePanel
      // Send message to background script which has the required permissions
      chrome.runtime.sendMessage({ action: "openSidePanel" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("[Command Registry] Error opening chat panel:", chrome.runtime.lastError);
          showToast("Failed to open chat panel");
        } else if (response && response.success) {
          showToast("Chat panel opened");
        } else {
          showToast("Failed to open chat panel");
        }
      });
    },
  },
  {
    id: "create-boost",
    name: "Create Boost",
    description: "Create a new boost for this page",
    shortcut: "",
    action: () => {
      chrome.runtime.sendMessage(
        {
          action: "openSidePanelTo",
          path: "/boosts/create",
          params: { domain: window.location.hostname },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "[Command Registry] Error opening boost creator:",
              chrome.runtime.lastError,
            );
            showToast("Failed to open boost creator");
          } else if (response && response.success) {
            showToast("Boost creator opened");
          }
        },
      );
    },
  },
  {
    id: "manage-boosts",
    name: "Manage Boosts",
    description: "View and manage all boosts",
    shortcut: "",
    action: () => {
      chrome.runtime.sendMessage(
        {
          action: "openSidePanelTo",
          path: "/boosts",
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "[Command Registry] Error opening boost manager:",
              chrome.runtime.lastError,
            );
            showToast("Failed to open boost manager");
          } else if (response && response.success) {
            showToast("Boost manager opened");
          }
        },
      );
    },
  },
];

/**
 * Get a command by ID
 * @param id - The command ID
 * @returns The command, or undefined if not found
 */
export function getCommand(id: string): Command | undefined {
  return commandRegistry.find((cmd) => cmd.id === id);
}

/**
 * Execute a command by ID
 * @param id - The command ID
 * @throws Error if command not found
 */
export async function executeCommand(id: string): Promise<void> {
  const command = getCommand(id);
  if (!command) {
    throw new Error(`Command not found: ${id}`);
  }

  try {
    await command.action();
  } catch (error) {
    console.error(`[Command Registry] Error executing command "${id}":`, error);
    throw error;
  }
}

/**
 * Get all commands
 * @returns Array of all available commands
 */
export function getAllCommands(): Command[] {
  return [...commandRegistry];
}

/**
 * Get commands with keyboard shortcuts
 * @returns Array of commands that have keyboard shortcuts
 */
export function getCommandsWithShortcuts(): Command[] {
  return commandRegistry.filter((cmd) => cmd.shortcut);
}

/**
 * Register dynamic boost commands for the current domain
 * Fetches enabled manual-mode boosts matching the current domain
 * and adds them to the command registry
 */
export async function registerDynamicBoostCommands(): Promise<void> {
  try {
    const hostname = window.location.hostname;
    const boosts = await getBoostsForDomain(hostname);

    // Filter for manual-mode boosts only
    const manualBoosts = boosts.filter((b) => b.runMode === "manual");

    // Create commands for each manual boost
    const boostCommands: Command[] = manualBoosts.map((boost: Boost) => ({
      id: `run-boost-${boost.id}`,
      name: `Run Boost: ${boost.name}`,
      description: boost.description || `Run ${boost.name} on this page`,
      shortcut: "",
      action: () => {
        chrome.runtime.sendMessage(
          {
            action: "runBoost",
            boostId: boost.id,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error("[Command Registry] Error running boost:", chrome.runtime.lastError);
              showToast(`Failed to run boost: ${boost.name}`);
            } else if (response && response.success) {
              showToast(`Boost executed: ${boost.name}`);
            } else if (response && response.error) {
              showToast(`Boost error: ${response.error}`);
            }
          },
        );
      },
    }));

    // Add boost commands to the registry
    commandRegistry.push(...boostCommands);

    if (boostCommands.length > 0) {
      console.log(`[Command Registry] Registered ${boostCommands.length} dynamic boost commands`);
    }
  } catch (error) {
    console.error("[Command Registry] Error registering dynamic boost commands:", error);
  }
}
