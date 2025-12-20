/**
 * Command Palette UI Component
 * Provides a searchable overlay for accessing extension commands
 */

import type { Command } from './commands.js';
import { showToast } from './toast.js';

let commandPaletteOpen = false;
let selectedCommandIndex = 0;
let filteredCommands: Command[] = [];
let allCommands: Command[] = [];
let styleInjected = false;

/**
 * Inject command palette CSS into the page
 */
function injectStyles(): void {
  if (styleInjected) return;

  const style = document.createElement('style');
  style.id = 'command-palette-styles';
  style.textContent = `
    #command-palette-container {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 999999;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 20vh;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .command-palette-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      cursor: pointer;
    }

    .command-palette-panel {
      position: relative;
      z-index: 1;
      width: 90%;
      max-width: 500px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      overflow: hidden;
      animation: slideDown 0.2s ease-out;
    }

    @media (prefers-color-scheme: dark) {
      .command-palette-panel {
        background: #1a1a1a;
        color: #f0f0f0;
      }
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .command-palette-search {
      width: 100%;
      padding: 12px 16px;
      border: none;
      border-bottom: 1px solid #e5e5e5;
      font-size: 14px;
      outline: none;
      background: white;
      color: #000;
    }

    @media (prefers-color-scheme: dark) {
      .command-palette-search {
        background: #1a1a1a;
        color: #f0f0f0;
        border-bottom-color: #333;
      }
    }

    .command-palette-search::placeholder {
      color: #999;
    }

    @media (prefers-color-scheme: dark) {
      .command-palette-search::placeholder {
        color: #707070;
      }
    }

    .command-palette-list {
      max-height: 400px;
      overflow-y: auto;
    }

    .command-palette-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 16px;
      cursor: pointer;
      border-bottom: 1px solid #f0f0f0;
      transition: background-color 0.15s ease;
    }

    @media (prefers-color-scheme: dark) {
      .command-palette-item {
        border-bottom-color: #2a2a2a;
      }
    }

    .command-palette-item:last-child {
      border-bottom: none;
    }

    .command-palette-item:hover,
    .command-palette-item.selected {
      background-color: #f5f5f5;
    }

    @media (prefers-color-scheme: dark) {
      .command-palette-item:hover,
      .command-palette-item.selected {
        background-color: #252525;
      }
    }

    .command-palette-item-name {
      flex: 1;
      font-size: 13px;
      font-weight: 400;
      color: #000;
    }

    @media (prefers-color-scheme: dark) {
      .command-palette-item-name {
        color: #f0f0f0;
      }
    }

    .command-palette-item-shortcut {
      font-size: 11px;
      color: #999;
      margin-left: 16px;
      text-align: right;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    }

    @media (prefers-color-scheme: dark) {
      .command-palette-item-shortcut {
        color: #707070;
      }
    }

    .command-palette-list::-webkit-scrollbar {
      width: 6px;
    }

    .command-palette-list::-webkit-scrollbar-track {
      background: transparent;
    }

    .command-palette-list::-webkit-scrollbar-thumb {
      background: #ccc;
      border-radius: 3px;
    }

    .command-palette-list::-webkit-scrollbar-thumb:hover {
      background: #999;
    }

    @media (prefers-color-scheme: dark) {
      .command-palette-list::-webkit-scrollbar-thumb {
        background: #555;
      }

      .command-palette-list::-webkit-scrollbar-thumb:hover {
        background: #777;
      }
    }
  `;

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
 * Filter commands based on search query
 */
function filterCommands(query: string): Command[] {
  if (!query.trim()) {
    return allCommands;
  }

  return allCommands.filter(cmd =>
    fuzzyMatch(query, cmd.name) || (cmd.description && fuzzyMatch(query, cmd.description))
  );
}

/**
 * Render the command palette UI
 */
function renderCommandPalette(): void {
  const container = document.getElementById('command-palette-container');
  if (!container) return;

  const searchInput = container.querySelector('#command-palette-search') as HTMLInputElement;
  const commandList = container.querySelector('#command-palette-list') as HTMLElement;

  if (!searchInput || !commandList) return;

  // Clear and rebuild command list
  commandList.innerHTML = '';

  filteredCommands.forEach((cmd, index) => {
    const item = document.createElement('div');
    item.className = `command-palette-item ${index === selectedCommandIndex ? 'selected' : ''}`;
    item.dataset.index = String(index);

    const nameEl = document.createElement('div');
    nameEl.className = 'command-palette-item-name';
    nameEl.textContent = cmd.name;

    const shortcutEl = document.createElement('div');
    shortcutEl.className = 'command-palette-item-shortcut';
    shortcutEl.textContent = cmd.shortcut || '';

    item.appendChild(nameEl);
    item.appendChild(shortcutEl);

    item.addEventListener('click', () => {
      selectedCommandIndex = index;
      executeCommand();
    });

    item.addEventListener('mouseenter', () => {
      selectedCommandIndex = index;
      renderCommandPalette();
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
      await command.action();
    } catch (error) {
      console.error('[Command Palette] Error executing command:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      showToast(`× Error: ${errorMessage}`);
    }
  }
}

/**
 * Open the command palette
 */
export function openCommandPalette(): void {
  if (commandPaletteOpen) return;

  commandPaletteOpen = true;
  selectedCommandIndex = 0;

  // Inject styles if not already done
  injectStyles();

  // Create container if it doesn't exist
  let container = document.getElementById('command-palette-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'command-palette-container';
    document.body.appendChild(container);
  }

  container.innerHTML = `
    <div class="command-palette-overlay"></div>
    <div class="command-palette-panel">
      <input
        id="command-palette-search"
        type="text"
        class="command-palette-search"
        placeholder="Search commands..."
        autocomplete="off"
      />
      <div id="command-palette-list" class="command-palette-list"></div>
    </div>
  `;

  const searchInput = container.querySelector('#command-palette-search') as HTMLInputElement;
  const overlay = container.querySelector('.command-palette-overlay') as HTMLElement;

  // Focus search input
  searchInput.focus();

  // Handle search input
  searchInput.addEventListener('input', (e) => {
    const query = (e.target as HTMLInputElement).value;
    filteredCommands = filterCommands(query);
    selectedCommandIndex = 0;
    renderCommandPalette();
  });

  // Handle keyboard navigation
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedCommandIndex = Math.min(selectedCommandIndex + 1, filteredCommands.length - 1);
      renderCommandPalette();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedCommandIndex = Math.max(selectedCommandIndex - 1, 0);
      renderCommandPalette();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeCommandPalette();
    }
  });

  // Close on overlay click
  overlay.addEventListener('click', closeCommandPalette);

  // Initial render
  filteredCommands = allCommands;
  renderCommandPalette();
}

/**
 * Close the command palette
 */
export function closeCommandPalette(): void {
  commandPaletteOpen = false;
  const container = document.getElementById('command-palette-container');
  if (container) {
    container.remove();
  }
}

/**
 * Register commands for the palette
 */
export function registerCommands(commands: Command[]): void {
  allCommands = commands;
}

