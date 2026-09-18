import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockStorage, mockTabs } from "../../test/setup.js";
import { initializeWebsiteLockForm } from "./website-lock.js";

const html = readFileSync("src/pages/popup/popup.html", "utf8");
const executeScript = vi.fn();
const getTab = vi.fn();

describe("website lock popup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = html;
    vi.stubGlobal("chrome", {
      ...chrome,
      tabs: { ...chrome.tabs, get: getTab },
      scripting: { executeScript },
      storage: { ...chrome.storage, onChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
    });
    mockTabs.query.mockResolvedValue([{ id: 1, url: "https://example.com/page" }]);
    getTab.mockResolvedValue({ id: 1, url: "https://example.com/page" });
    executeScript.mockResolvedValue([]);
    mockStorage.local.get.mockResolvedValue({});
    vi.mocked(chrome.storage.local.set).mockResolvedValue();
  });

  afterEach(() => {
    window.dispatchEvent(new Event("pagehide"));
    vi.restoreAllMocks();
  });

  function submit(timestamp: number): void {
    const input = document.querySelector<HTMLInputElement>("#websiteUnlockAt")!;
    const date = new Date(timestamp);
    input.value = new Date(timestamp - date.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
    document
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  }

  it("saves a deadline and starts the lock in existing tabs on the same hostname", async () => {
    await initializeWebsiteLockForm();
    mockTabs.query.mockResolvedValue([
      { id: 1, url: "https://example.com/page" },
      { id: 2, url: "http://example.com/another" },
      { id: 3, url: "https://other.com" },
    ]);
    submit(Date.now() + 60_000);
    await vi.waitFor(() => expect(executeScript).toHaveBeenCalledTimes(2));
    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 2 },
      files: ["website-lock.js"],
    });
    expect(chrome.storage.local.set).toHaveBeenCalledOnce();
    expect(document.querySelector<HTMLFormElement>("form")?.hidden).toBe(true);
  });

  it("rejects a past time without injecting scripts or storing a lock", async () => {
    await initializeWebsiteLockForm();
    submit(Date.now() - 60_000);
    expect(document.querySelector("#websiteLockStatus")?.textContent).toContain("future");
    expect(executeScript).not.toHaveBeenCalled();
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it.each([30, 60])("locks for exactly %i minutes from the quick button click", async (minutes) => {
    const now = vi.spyOn(Date, "now").mockReturnValue(new Date("2026-09-18T23:50:37Z").getTime());
    await initializeWebsiteLockForm();
    const clickedAt = new Date("2026-09-18T23:55:43Z").getTime();
    now.mockReturnValue(clickedAt);
    document.querySelector<HTMLInputElement>("#websiteUnlockAt")!.value = "";
    const quickButton = document.querySelector<HTMLButtonElement>(
      `[data-lock-minutes="${minutes}"]`,
    )!;
    quickButton.click();
    expect(
      [...document.querySelectorAll<HTMLButtonElement>("#websiteLockForm button")].every(
        (button) => button.disabled,
      ),
    ).toBe(true);
    quickButton.click();

    await vi.waitFor(() =>
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        "website-lock:example.com": clickedAt + minutes * 60_000,
      }),
    );
    expect(chrome.storage.local.set).toHaveBeenCalledOnce();
    expect(document.querySelector<HTMLFormElement>("form")?.hidden).toBe(true);
  });

  it("lets a quick lock retry after a save failure", async () => {
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error("Storage unavailable"));
    await initializeWebsiteLockForm();
    const quickButton = document.querySelector<HTMLButtonElement>('[data-lock-minutes="30"]')!;
    quickButton.click();
    await vi.waitFor(() =>
      expect(document.querySelector("#websiteLockStatus")?.textContent).toContain(
        "Storage unavailable",
      ),
    );
    expect(
      [...document.querySelectorAll<HTMLButtonElement>("#websiteLockForm button")].every(
        (button) => !button.disabled,
      ),
    ).toBe(true);
    quickButton.click();
    await vi.waitFor(() =>
      expect(document.querySelector<HTMLFormElement>("form")?.hidden).toBe(true),
    );
  });

  it("does not save a lock when the browser refuses injection", async () => {
    executeScript.mockRejectedValue(new Error("Cannot access page"));
    await initializeWebsiteLockForm();
    submit(Date.now() + 60_000);
    await vi.waitFor(() =>
      expect(document.querySelector("#websiteLockStatus")?.textContent).toContain("does not allow"),
    );
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLButtonElement>("#lockWebsiteBtn")?.disabled).toBe(false);
  });

  it("reports save failures without showing the website as locked", async () => {
    vi.mocked(chrome.storage.local.set).mockRejectedValue(new Error("Storage unavailable"));
    await initializeWebsiteLockForm();
    submit(Date.now() + 60_000);
    await vi.waitFor(() =>
      expect(document.querySelector("#websiteLockStatus")?.textContent).toContain(
        "Storage unavailable",
      ),
    );
    expect(document.querySelector<HTMLFormElement>("form")?.hidden).toBe(false);
  });

  it("requires reopening the popup if the current tab has changed websites", async () => {
    await initializeWebsiteLockForm();
    getTab.mockResolvedValue({ id: 1, url: "https://other.com" });
    submit(Date.now() + 60_000);
    await vi.waitFor(() =>
      expect(document.querySelector("#websiteLockStatus")?.textContent).toContain(
        "website changed",
      ),
    );
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it("does not offer a lock on browser pages or an existing active lock", async () => {
    mockTabs.query.mockResolvedValue([{ id: 1, url: "chrome://settings" }]);
    await initializeWebsiteLockForm();
    expect(document.querySelector<HTMLFormElement>("form")?.hidden).toBe(true);
    expect(document.querySelector("#websiteLockStatus")?.textContent).toContain("Open a website");

    mockTabs.query.mockResolvedValue([{ id: 1, url: "https://example.com" }]);
    mockStorage.local.get.mockResolvedValue({
      "website-lock:example.com": Date.now() + 60_000,
    });
    await initializeWebsiteLockForm();
    expect(document.querySelector<HTMLFormElement>("form")?.hidden).toBe(true);
    expect(document.querySelector("#websiteLockStatus")?.textContent).toContain("Locked until");
  });
});
