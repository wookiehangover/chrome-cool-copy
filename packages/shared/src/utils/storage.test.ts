import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearStorage,
  getStorageItem,
  getStorageItems,
  removeStorageItem,
  setStorageItem,
} from "./storage.js";

describe("storage utilities", () => {
  let store: Record<string, unknown>;
  const local = {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
  };

  beforeEach(() => {
    store = {};
    local.get.mockReset();
    local.set.mockReset();
    local.remove.mockReset();
    local.clear.mockReset();

    local.get.mockImplementation(
      (keys: string[], callback: (result: Record<string, unknown>) => void) => {
        const result: Record<string, unknown> = {};
        keys.forEach((key) => {
          if (key in store) {
            result[key] = store[key];
          }
        });
        callback(result);
      },
    );

    local.set.mockImplementation(
      (items: Record<string, unknown>, callback: () => void) => {
        Object.assign(store, items);
        callback();
      },
    );

    local.remove.mockImplementation((keys: string[], callback: () => void) => {
      keys.forEach((key) => {
        delete store[key];
      });
      callback();
    });

    local.clear.mockImplementation((callback: () => void) => {
      store = {};
      callback();
    });

    vi.stubGlobal("chrome", {
      storage: {
        local,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sets and gets a storage item", async () => {
    await setStorageItem("theme", "dark");
    await expect(getStorageItem("theme")).resolves.toBe("dark");
  });

  it("returns undefined for missing storage item", async () => {
    await expect(getStorageItem("missing")).resolves.toBeUndefined();
  });

  it("removes a storage item", async () => {
    await setStorageItem("token", "abc123");
    await removeStorageItem("token");

    await expect(getStorageItem("token")).resolves.toBeUndefined();
    expect(local.remove).toHaveBeenCalledWith(["token"], expect.any(Function));
  });

  it("returns multiple storage items", async () => {
    await setStorageItem("a", 1);
    await setStorageItem("b", 2);

    await expect(getStorageItems(["a", "b", "c"])).resolves.toEqual({ a: 1, b: 2 });
  });

  it("returns an empty object when chrome storage get returns undefined", async () => {
    local.get.mockImplementationOnce((_keys: string[], callback: (result: unknown) => void) => {
      callback(undefined);
    });

    await expect(getStorageItems(["x"])).resolves.toEqual({});
  });

  it("clears all storage items", async () => {
    await setStorageItem("foo", "bar");
    await setStorageItem("count", 1);

    await clearStorage();

    await expect(getStorageItems(["foo", "count"])).resolves.toEqual({});
    expect(local.clear).toHaveBeenCalledWith(expect.any(Function));
  });
});
