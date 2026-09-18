import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockStorage } from "../../test/setup.js";
import { initializeWebsiteLock } from "./website-lock.js";

describe("website lock overlay", () => {
  let dispose: (() => void) | undefined;
  let dialog: HTMLDialogElement | undefined;
  let changed: (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => void;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-18T12:00:00Z"));
    mockStorage.local.get.mockResolvedValue({});
    vi.stubGlobal("chrome", {
      ...chrome,
      storage: {
        ...chrome.storage,
        onChanged: {
          addListener: vi.fn((listener) => {
            changed = listener;
          }),
          removeListener: vi.fn(),
        },
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true;
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false;
      },
    });
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      const element = createElement(tagName);
      if (element instanceof HTMLDialogElement) dialog = element;
      return element;
    });
  });

  afterEach(() => {
    dispose?.();
    dispose = undefined;
    dialog = undefined;
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("blocks interaction, refuses Escape, and restores the page at the deadline", async () => {
    mockStorage.local.get.mockResolvedValue({
      "website-lock:example.com": Date.now() + 2000,
    });
    const button = document.createElement("button");
    document.body.append(button);
    const click = vi.fn();
    button.addEventListener("click", click);
    dispose = await initializeWebsiteLock("example.com");
    expect(dialog?.open).toBe(true);
    button.click();
    expect(click).not.toHaveBeenCalled();
    const cancel = new Event("cancel", { cancelable: true });
    dialog?.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    const key = new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true });
    button.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(true);

    await vi.advanceTimersByTimeAsync(2000);
    expect(document.getElementById("cool-copy-website-lock")).toBeNull();
    expect(dialog?.open).toBe(false);
    button.click();
    expect(click).toHaveBeenCalledOnce();
  });

  it("applies storage changes from other tabs only for this hostname", async () => {
    dispose = await initializeWebsiteLock("example.com");
    changed({ "website-lock:other.com": { newValue: Date.now() + 60_000 } }, "local");
    changed({ "website-lock:example.com": { newValue: Date.now() + 60_000 } }, "sync");
    expect(dialog).toBeUndefined();
    changed({ "website-lock:example.com": { newValue: Date.now() + 60_000 } }, "local");
    expect(dialog?.open).toBe(true);
    changed({ "website-lock:example.com": { newValue: undefined } }, "local");
    expect(dialog?.open).toBe(false);
  });

  it("does not let a stale initial read overwrite a newer lock", async () => {
    let resolveRead: (value: { [key: string]: number }) => void = () => {};
    mockStorage.local.get.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRead = resolve;
        }),
    );
    const initialization = initializeWebsiteLock("example.com");
    changed({ "website-lock:example.com": { newValue: Date.now() + 60_000 } }, "local");
    resolveRead({});
    dispose = await initialization;
    expect(dialog?.open).toBe(true);
  });

  it("unlocks immediately after waking past the deadline", async () => {
    mockStorage.local.get.mockResolvedValue({
      "website-lock:example.com": Date.now() + 60_000,
    });
    dispose = await initializeWebsiteLock("example.com");
    vi.setSystemTime(Date.now() + 120_000);
    window.dispatchEvent(new Event("pageshow"));
    expect(dialog?.open).toBe(false);
  });

  it("supports distant deadlines and restores an overlay removed by a page update", async () => {
    mockStorage.local.get.mockResolvedValue({
      "website-lock:example.com": Date.now() + 90 * 86_400_000,
    });
    dispose = await initializeWebsiteLock("example.com");
    document.getElementById("cool-copy-website-lock")?.remove();
    await vi.advanceTimersByTimeAsync(1000);
    expect(document.getElementById("cool-copy-website-lock")).not.toBeNull();
    expect(dialog?.open).toBe(true);
  });

  it("leaves expired locks alone and cleans up listeners on read failure", async () => {
    mockStorage.local.get.mockResolvedValue({
      "website-lock:example.com": Date.now() - 1,
    });
    dispose = await initializeWebsiteLock("example.com");
    expect(dialog).toBeUndefined();
    dispose();
    dispose = undefined;
    mockStorage.local.get.mockRejectedValue(new Error("Read failed"));
    await expect(initializeWebsiteLock("example.com")).rejects.toThrow("Read failed");
    expect(chrome.storage.onChanged.removeListener).toHaveBeenCalledTimes(2);
  });
});
