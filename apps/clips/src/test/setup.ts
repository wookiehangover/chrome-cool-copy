import { beforeEach, vi } from "vitest";

type StorageData = Record<string, unknown>;

const storageData: StorageData = {};

export const mockRuntime = {
  sendMessage: vi.fn(),
  lastError: null as chrome.runtime.LastError | null,
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

export const mockStorage = {
  sync: {
    get: vi.fn((keys: string[] | string | null, callback: (items: StorageData) => void) => {
      if (!keys) {
        callback({ ...storageData });
        return;
      }

      const keyList = Array.isArray(keys) ? keys : [keys];
      const items: StorageData = {};

      for (const key of keyList) {
        if (typeof key === "string" && key in storageData) {
          items[key] = storageData[key];
        }
      }

      callback(items);
    }),
    set: vi.fn((items: StorageData, callback?: () => void) => {
      Object.assign(storageData, items);
      callback?.();
    }),
  },
  local: {
    get: vi.fn(),
    set: vi.fn(),
  },
};

export const mockChrome = {
  runtime: mockRuntime,
  storage: mockStorage,
};

vi.stubGlobal("chrome", mockChrome as unknown as typeof chrome);

export function resetChromeMocks() {
  vi.clearAllMocks();
  mockRuntime.lastError = null;

  for (const key of Object.keys(storageData)) {
    delete storageData[key];
  }
}

beforeEach(() => {
  resetChromeMocks();
});
