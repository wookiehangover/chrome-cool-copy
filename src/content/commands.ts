/**
 * Command Registry
 * Centralized definition of all available commands in the extension
 */

import { handleCopyCleanUrl } from './url-cleaner.js';
import { handleCopyMarkdownLink } from './markdown.js';
import { startElementPicker } from './element-picker.js';

/**
 * Command interface defining the structure of a command
 */
export interface Command {
  id: string;
  name: string;
  description?: string;
  shortcut?: string;
  action: () => void | Promise<void>;
}

/**
 * Get platform-specific shortcut display
 */
function getPlatformShortcut(macShortcut: string, otherShortcut: string): string {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  return isMac ? macShortcut : otherShortcut;
}

/**
 * Command registry containing all available commands
 */
export const commandRegistry: Command[] = [
  {
    id: 'copy-clean-url',
    name: 'Copy clean URL',
    description: 'Copy URL without tracking parameters',
    shortcut: getPlatformShortcut('Cmd+Shift+C', 'Ctrl+Shift+C'),
    action: handleCopyCleanUrl
  },
  {
    id: 'copy-markdown-link',
    name: 'Copy markdown link',
    description: 'Copy markdown formatted link',
    shortcut: getPlatformShortcut('Cmd+Shift+X', 'Ctrl+Shift+X'),
    action: handleCopyMarkdownLink
  },
  {
    id: 'copy-element',
    name: 'Copy element',
    description: 'Copy selected element to clipboard',
    shortcut: '',
    action: startElementPicker
  },
  {
    id: 'clip-page',
    name: 'Clip page',
    description: 'Clip current page to AgentDB',
    shortcut: '',
    action: async () => {
      // Send clipPage message to content script (self)
      // This will be handled by the message listener in index.ts
      const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        chrome.runtime.sendMessage({ action: 'clipPage' }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(response || { success: false, error: 'No response' });
          }
        });
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to clip page');
      }
    }
  },
  {
    id: 'view-clipped-pages',
    name: 'View clipped pages',
    description: 'Open the clipped pages viewer',
    shortcut: '',
    action: () => {
      const clippedPagesUrl = chrome.runtime.getURL('pages/clipped-pages.html');
      window.open(clippedPagesUrl, '_blank');
    }
  },
  {
    id: 'settings',
    name: 'Settings',
    description: 'Open extension settings',
    shortcut: '',
    action: () => {
      const settingsUrl = chrome.runtime.getURL('pages/settings.html');
      window.open(settingsUrl, '_blank');
    }
  }
];

/**
 * Get a command by ID
 * @param id - The command ID
 * @returns The command, or undefined if not found
 */
export function getCommand(id: string): Command | undefined {
  return commandRegistry.find(cmd => cmd.id === id);
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
  return commandRegistry.filter(cmd => cmd.shortcut);
}

