/**
 * Vitest Setup File
 * Configures global mocks for Chrome extension APIs
 */

import { vi } from "vitest";

// Type for message listener callback
type MessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | void;

// Store registered message listeners for testing
export const messageListeners: MessageListener[] = [];

// Mock chrome.runtime API
const mockRuntime = {
  sendMessage: vi.fn(),
  onMessage: {
    addListener: vi.fn((listener: MessageListener) => {
      messageListeners.push(listener);
    }),
    removeListener: vi.fn((listener: MessageListener) => {
      const index = messageListeners.indexOf(listener);
      if (index > -1) {
        messageListeners.splice(index, 1);
      }
    }),
  },
  lastError: null as chrome.runtime.LastError | null,
  getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
};

// Mock chrome.storage API
const mockStorage = {
  sync: {
    get: vi.fn(),
    set: vi.fn(),
  },
  local: {
    get: vi.fn(),
    set: vi.fn(),
  },
};

// Mock chrome.tabs API
const mockTabs = {
  query: vi.fn(),
  sendMessage: vi.fn(),
  captureVisibleTab: vi.fn(),
  create: vi.fn(),
};

// Mock chrome.commands API
const mockCommands = {
  onCommand: {
    addListener: vi.fn(),
  },
};

// Mock chrome.contextMenus API
const mockContextMenus = {
  create: vi.fn(),
  onClicked: {
    addListener: vi.fn(),
  },
};

// Assemble the mock chrome object
const mockChrome = {
  runtime: mockRuntime,
  storage: mockStorage,
  tabs: mockTabs,
  commands: mockCommands,
  contextMenus: mockContextMenus,
};

// Set up global chrome object
vi.stubGlobal("chrome", mockChrome);

// Helper to reset all mocks between tests
export function resetChromeMocks(): void {
  vi.clearAllMocks();
  messageListeners.length = 0;
  mockRuntime.lastError = null;
}

// Helper to simulate a message being sent and get the response
export function simulateMessage(
  message: unknown,
  sender: Partial<chrome.runtime.MessageSender> = {},
): Promise<unknown> {
  return new Promise((resolve) => {
    const fullSender: chrome.runtime.MessageSender = {
      id: "test-extension-id",
      ...sender,
    };

    for (const listener of messageListeners) {
      const sendResponse = (response?: unknown) => {
        resolve(response);
      };
      const result = listener(message, fullSender, sendResponse);
      if (result === true) {
        // Async response expected, wait for sendResponse to be called
        return;
      }
    }
    // No async listener, resolve immediately
    resolve(undefined);
  });
}

// Helper to mock chrome.runtime.sendMessage responses
export function mockSendMessageResponse(response: unknown): void {
  mockRuntime.sendMessage.mockImplementation(
    (message: unknown, callback?: (response: unknown) => void) => {
      if (callback) {
        callback(response);
      }
    },
  );
}

// Export mock objects for direct manipulation in tests
export { mockChrome, mockRuntime, mockStorage, mockTabs };
