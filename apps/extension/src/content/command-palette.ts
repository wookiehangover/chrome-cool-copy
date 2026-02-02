/**
 * Command Palette UI Component
 * Provides a searchable overlay for accessing extension commands
 */

import type { Command } from "./commands.js";
import { showToast } from "./toast.js";
import styles from "./command-palette.css?raw";

let commandPaletteOpen = false;
let selectedCommandIndex = 0;
let filteredCommands: Command[] = [];
let allCommands: Command[] = [];
let styleInjected = false;
let currentSearchQuery = "";

// Storage key for command usage timestamps
const COMMAND_USAGE_TIMESTAMPS_KEY = "command_usage_timestamps";

/**
 * Load command usage timestamps from storage
 */
async function loadCommandUsageTimestamps(): Promise<Record<string, number>> {
  return new Promise((resolve) => {
    chrome.storage.local.get([COMMAND_USAGE_TIMESTAMPS_KEY], (result) => {
      resolve((result[COMMAND_USAGE_TIMESTAMPS_KEY] as Record<string, number>) || {});
    });
  });
}

/**
 * Save command usage timestamps to storage
 */
async function saveCommandUsageTimestamps(timestamps: Record<string, number>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [COMMAND_USAGE_TIMESTAMPS_KEY]: timestamps }, () => {
      resolve();
    });
  });
}

/**
 * Update the timestamp for a command when it's executed
 */
async function recordCommandUsage(commandId: string): Promise<void> {
  const timestamps = await loadCommandUsageTimestamps();
  timestamps[commandId] = Date.now();
  await saveCommandUsageTimestamps(timestamps);
}

/**
 * Inject command palette CSS into the page
 */
function injectStyles(): void {
  if (styleInjected) return;

  const style = document.createElement("style");
  style.id = "command-palette-styles";
  style.textContent = styles;

  document.head.appendChild(style);
  styleInjected = true;
}

/**
 * Simple fuzzy search implementation
 */
function fuzzyMatch(query: string, text: string): boolean {
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  let queryIndex = 0;

  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      queryIndex++;
    }
  }

  return queryIndex === queryLower.length;
}

/**
 * Highlight matching characters in text based on fuzzy match query
 * Returns HTML string with matched characters wrapped in <span class="command-palette-match">
 */
function highlightMatches(text: string, query: string): string {
  if (!query.trim()) {
    return text;
  }

  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  const matchIndices: number[] = [];
  let queryIndex = 0;

  // Find all matching character indices
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      matchIndices.push(i);
      queryIndex++;
    }
  }

  // If no matches found, return original text
  if (matchIndices.length === 0) {
    return text;
  }

  // Build HTML with highlighted matches
  let result = "";
  const matchSet = new Set(matchIndices);

  for (let i = 0; i < text.length; i++) {
    if (matchSet.has(i)) {
      result += `<span class="command-palette-match">${text[i]}</span>`;
    } else {
      result += text[i];
    }
  }

  return result;
}

/**
 * Get commands that are currently visible based on context, sorted by recency
 */
async function getVisibleCommands(): Promise<Command[]> {
  const visibleCommands = allCommands.filter((cmd) => !cmd.isVisible || cmd.isVisible());
  const timestamps = await loadCommandUsageTimestamps();

  // Separate used and unused commands
  const usedCommands = visibleCommands.filter((cmd) => timestamps[cmd.id] !== undefined);
  const unusedCommands = visibleCommands.filter((cmd) => timestamps[cmd.id] === undefined);

  // Sort used commands by timestamp (most recent first)
  usedCommands.sort((a, b) => (timestamps[b.id] || 0) - (timestamps[a.id] || 0));

  // Return used commands first, then unused commands in their original order
  return [...usedCommands, ...unusedCommands];
}

/**
 * Filter commands based on search query
 */
async function filterCommands(query: string): Promise<Command[]> {
  const visibleCommands = await getVisibleCommands();

  if (!query.trim()) {
    return visibleCommands;
  }

  const results = [];

  const exactMatch = visibleCommands.find((cmd) =>
    cmd.name.toLowerCase().includes(query.toLowerCase()),
  );

  if (exactMatch) {
    results.push(exactMatch);
  }

  const fuzzyMatches = visibleCommands.filter((cmd) => fuzzyMatch(query, cmd.name));

  const descriptionMatches = visibleCommands.filter(
    (cmd) => cmd.description && fuzzyMatch(query, cmd.description),
  );

  return [...new Set([...results, ...fuzzyMatches, ...descriptionMatches])];
}

/**
 * Render the command palette UI
 */
function renderCommandPalette(): void {
  const dialog = document.getElementById("command-palette-dialog");
  if (!dialog) return;

  const commandList = dialog.querySelector("#command-palette-list") as HTMLElement;

  if (!commandList) return;

  // Clear and rebuild command list
  commandList.innerHTML = "";

  filteredCommands.forEach((cmd, index) => {
    const item = document.createElement("div");
    item.className = `command-palette-item ${index === selectedCommandIndex ? "selected" : ""}`;
    item.dataset.index = String(index);

    const nameEl = document.createElement("div");
    nameEl.className = "command-palette-item-name";
    nameEl.innerHTML = highlightMatches(cmd.name, currentSearchQuery);

    const shortcutEl = document.createElement("div");
    shortcutEl.className = "command-palette-item-shortcut";
    shortcutEl.textContent = cmd.shortcut || "";

    item.appendChild(nameEl);
    item.appendChild(shortcutEl);

    item.addEventListener("click", () => {
      selectedCommandIndex = index;
      executeCommand();
    });

    item.addEventListener("mouseenter", () => {
      if (selectedCommandIndex !== index) {
        // Update selection without full re-render
        const previousSelected = commandList.querySelector(".command-palette-item.selected");
        if (previousSelected) {
          previousSelected.classList.remove("selected");
        }
        item.classList.add("selected");
        selectedCommandIndex = index;
      }
    });

    commandList.appendChild(item);
  });
}

/**
 * Execute the selected command
 */
async function executeCommand(): Promise<void> {
  if (selectedCommandIndex >= 0 && selectedCommandIndex < filteredCommands.length) {
    const command = filteredCommands[selectedCommandIndex];
    closeCommandPalette();
    try {
      // Record command usage before executing
      await recordCommandUsage(command.id);
      await command.action();
    } catch (error) {
      console.error("[Command Palette] Error executing command:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      showToast(`× Error: ${errorMessage}`);
    }
  }
}

/**
 * Open the command palette
 */
export async function openCommandPalette(): Promise<void> {
  if (commandPaletteOpen) return;

  commandPaletteOpen = true;
  selectedCommandIndex = 0;

  // Inject styles if not already done
  injectStyles();

  // Create dialog if it doesn't exist
  let dialog = document.getElementById("command-palette-dialog") as HTMLDialogElement | null;
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "command-palette-dialog";
    document.body.appendChild(dialog);
  }

  dialog.innerHTML = `
    <input
      id="command-palette-search"
      type="text"
      class="command-palette-search"
      placeholder="Search commands..."
      autocomplete="off"
    />
    <div id="command-palette-list" class="command-palette-list"></div>
  `;

  const searchInput = dialog.querySelector("#command-palette-search") as HTMLInputElement;

  // Handle search input
  searchInput.addEventListener("input", async (e) => {
    const query = (e.target as HTMLInputElement).value;
    currentSearchQuery = query;
    filteredCommands = await filterCommands(query);
    selectedCommandIndex = 0;
    renderCommandPalette();
  });

  // Handle keyboard navigation (arrow keys and enter only, escape handled by dialog)
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedCommandIndex = Math.min(selectedCommandIndex + 1, filteredCommands.length - 1);
      renderCommandPalette();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedCommandIndex = Math.max(selectedCommandIndex - 1, 0);
      renderCommandPalette();
    } else if (e.key === "Enter") {
      e.preventDefault();
      executeCommand();
    }
  });

  // Close on backdrop click
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      closeCommandPalette();
    }
  });

  // Handle cancel event (Escape key)
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeCommandPalette();
  });

  // Initial render with visible commands only
  filteredCommands = await getVisibleCommands();
  renderCommandPalette();

  // Open as modal and focus search input
  dialog.showModal();
  searchInput.focus();
}

/**
 * Close the command palette
 */
export function closeCommandPalette(): void {
  commandPaletteOpen = false;
  const dialog = document.getElementById("command-palette-dialog") as HTMLDialogElement | null;
  if (dialog) {
    dialog.close();
    dialog.remove();
  }
}

/**
 * Register commands for the palette
 */
export function registerCommands(commands: Command[]): void {
  allCommands = commands;
}
