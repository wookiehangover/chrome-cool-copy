/**
 * Vitest Setup File
 * Configures global mocks for Chrome extension APIs
 */

import { vi } from "vitest";

export type TestValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | TestValue[]
  | { [key: string]: TestValue };

export interface TestRecord {
  [key: string]: TestValue;
}

// Type for message listener callback
type MessageListener = (
  message: TestValue,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: TestValue) => void,
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
  // SAFETY: The mutable mock starts empty and tests may assign Chrome's LastError shape.
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
const mockIDBStore: Record<string, Record<string, TestRecord>> = {};

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

  createIndex(name: string, keyPath: string, _options?: IDBIndexParameters) {
    const index = new MockIDBIndex(name, keyPath, this.storeName);
    this.indexMap.set(name, index);
    return index;
  }

  index(name: string) {
    return this.indexMap.get(name) || new MockIDBIndex(name, "", this.storeName);
  }

  add(value: TestRecord) {
    const obj = value;
    const key = String(obj[this.keyPath]);
    mockIDBStore[this.storeName][key] = obj;
    return new MockIDBRequest(true, key);
  }

  get(key: IDBValidKey) {
    const result = mockIDBStore[this.storeName]?.[String(key)] || null;
    return new MockIDBRequest(true, result);
  }

  delete(key: IDBValidKey) {
    const keyStr = String(key);
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
    const results = Object.values(store).filter((obj) => {
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
  result: TestValue | TestRecord | TestRecord[] | MockIDBDatabase;
  error: DOMException | null = null;
  onsuccess: ((this: MockIDBRequest, ev: Event) => void) | null = null;
  onerror: ((this: MockIDBRequest, ev: Event) => void) | null = null;

  constructor(success: boolean, result: TestValue | TestRecord | TestRecord[] | MockIDBDatabase) {
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
  open: vi.fn((_name: string, _version?: number) => {
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
  message: TestValue,
  sender: Partial<chrome.runtime.MessageSender> = {},
): Promise<TestValue> {
  return new Promise((resolve) => {
    const fullSender: chrome.runtime.MessageSender = {
      id: "test-extension-id",
      ...sender,
    };

    for (const listener of messageListeners) {
      const sendResponse = (response?: TestValue) => {
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
export function mockSendMessageResponse(response: TestValue): void {
  mockRuntime.sendMessage.mockImplementation(
    (_message: TestValue, callback?: (response: TestValue) => void) => {
      if (callback) {
        callback(response);
      }
    },
  );
}

// Export mock objects for direct manipulation in tests
export { mockChrome, mockRuntime, mockStorage, mockTabs };
