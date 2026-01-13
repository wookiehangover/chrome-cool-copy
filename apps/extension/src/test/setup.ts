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

// Mock IndexedDB for testing
const mockIDBStore: Record<string, Record<string, unknown>> = {};

class MockIDBDatabase {
  objectStoreNames = new Set<string>();
  version = 1;

  transaction(storeNames: string | string[], mode: IDBTransactionMode = "readonly") {
    return new MockIDBTransaction(storeNames, mode);
  }
}

class MockIDBObjectStore {
  keyPath: string;
  indexMap = new Map<string, MockIDBIndex>();
  storeName: string;

  constructor(storeName: string, keyPath: string) {
    this.storeName = storeName;
    this.keyPath = keyPath;
    if (!mockIDBStore[storeName]) {
      mockIDBStore[storeName] = {};
    }
  }

  createIndex(name: string, keyPath: string, options?: IDBIndexParameters) {
    const index = new MockIDBIndex(name, keyPath, this.storeName);
    this.indexMap.set(name, index);
    return index;
  }

  index(name: string) {
    return this.indexMap.get(name) || new MockIDBIndex(name, "", this.storeName);
  }

  add(value: unknown) {
    const obj = value as Record<string, unknown>;
    const key = obj[this.keyPath] as string;
    mockIDBStore[this.storeName][key] = obj;
    return new MockIDBRequest(true, key);
  }

  get(key: IDBValidKey) {
    const result = mockIDBStore[this.storeName]?.[key as string] || null;
    return new MockIDBRequest(true, result);
  }

  delete(key: IDBValidKey) {
    const keyStr = key as string;
    if (mockIDBStore[this.storeName] && mockIDBStore[this.storeName][keyStr]) {
      delete mockIDBStore[this.storeName][keyStr];
    }
    return new MockIDBRequest(true, undefined);
  }
}

class MockIDBIndex {
  name: string;
  keyPath: string;
  storeName: string;

  constructor(name: string, keyPath: string, storeName: string) {
    this.name = name;
    this.keyPath = keyPath;
    this.storeName = storeName;
  }

  getAll(query?: IDBValidKey | IDBKeyRange) {
    const store = mockIDBStore[this.storeName] || {};
    const results = Object.values(store).filter((item: unknown) => {
      const obj = item as Record<string, unknown>;
      // If query is provided, filter by the index's keyPath
      if (query !== undefined) {
        return obj[this.keyPath] === query;
      }
      return true;
    });
    return new MockIDBRequest(true, results);
  }
}

class MockIDBTransaction {
  storeNames: string | string[];
  mode: IDBTransactionMode;

  constructor(storeNames: string | string[], mode: IDBTransactionMode) {
    this.storeNames = storeNames;
    this.mode = mode;
  }

  objectStore(name: string) {
    return new MockIDBObjectStore(name, "id");
  }
}

class MockIDBRequest {
  result: unknown;
  error: DOMException | null = null;
  onsuccess: ((this: IDBRequest, ev: Event) => unknown) | null = null;
  onerror: ((this: IDBRequest, ev: Event) => unknown) | null = null;

  constructor(success: boolean, result: unknown) {
    this.result = result;
    // Schedule callback to be called after constructor completes
    if (success) {
      Promise.resolve().then(() => {
        this.onsuccess?.call(this, new Event("success"));
      });
    }
  }
}

const mockIndexedDB = {
  open: vi.fn((name: string, version?: number) => {
    // Clear store for fresh database
    Object.keys(mockIDBStore).forEach((key) => delete mockIDBStore[key]);
    const request = new MockIDBRequest(true, new MockIDBDatabase());
    return request;
  }),
  deleteDatabase: vi.fn(),
  databases: vi.fn(async () => []),
};

vi.stubGlobal("indexedDB", mockIndexedDB);

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
