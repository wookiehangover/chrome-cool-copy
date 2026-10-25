import { beforeEach, vi } from "vitest";

type StorageValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | { model?: string }
  | { aiGatewayConfig?: { model?: string } };
type StorageData = Record<string, StorageValue>;

const storageData: StorageData = {};

export const mockRuntime = {
  sendMessage: vi.fn(),
  // SAFETY: Tests mutate this field only with Chrome-compatible last-error values.
  lastError: null as chrome.runtime.LastError | null,
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

export const mockStorage = {
  onChanged: {
    addListener:
      vi.fn<(listener: Parameters<typeof chrome.storage.onChanged.addListener>[0]) => void>(),
    removeListener:
      vi.fn<(listener: Parameters<typeof chrome.storage.onChanged.removeListener>[0]) => void>(),
  },
  sync: {
    get: vi.fn((keys: string[] | string | null, callback: (items: StorageData) => void) => {
      if (!keys) {
        callback({ ...storageData });
        return;
      }

      const keyList = Array.isArray(keys) ? keys : [keys];
      const items: StorageData = {};

      for (const key of keyList) {
        if (key in storageData) {
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

vi.stubGlobal("chrome", mockChrome);

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
