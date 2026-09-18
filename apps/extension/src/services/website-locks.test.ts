import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockStorage } from "../test/setup.js";
import {
  activeDeadline,
  getWebsiteHostname,
  getWebsiteLock,
  setWebsiteLock,
  websiteLockKey,
} from "./website-locks.js";

describe("website locks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.local.get.mockResolvedValue({});
    vi.mocked(chrome.storage.local.set).mockResolvedValue();
  });

  it("uses the exact hostname across paths, ports, and HTTP protocols", () => {
    expect(getWebsiteHostname("https://EXAMPLE.com:8080/somewhere")).toBe("example.com");
    expect(getWebsiteHostname("http://example.com/elsewhere")).toBe("example.com");
    expect(getWebsiteHostname("https://www.example.com")).toBe("www.example.com");
    expect(websiteLockKey("example.com")).not.toBe(websiteLockKey("www.example.com"));
  });

  it.each(["chrome://settings", "about:blank", "file:///tmp/page.html", "invalid", ""])(
    "does not offer locks for %s",
    (url) => expect(getWebsiteHostname(url)).toBeNull(),
  );

  it("treats expired and invalid deadlines as unlocked", () => {
    for (const value of [undefined, null, "2000", true, {}, NaN, Infinity, -1, 1000, 8.64e15 + 1]) {
      expect(activeDeadline(value, 1000)).toBeNull();
    }
    expect(activeDeadline(1001, 1000)).toBe(1001);
  });

  it("reads a persistent lock and ignores expired entries", async () => {
    const deadline = Date.now() + 60_000;
    mockStorage.local.get.mockResolvedValue({ "website-lock:example.com": deadline });
    expect(await getWebsiteLock("example.com")).toBe(deadline);
    mockStorage.local.get.mockResolvedValue({ "website-lock:example.com": 1 });
    expect(await getWebsiteLock("example.com")).toBeNull();
  });

  it("stores one website independently without replacing other locks", async () => {
    const deadline = Date.now() + 60_000;
    await setWebsiteLock("example.com", deadline);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ "website-lock:example.com": deadline });
  });

  it("rejects past deadlines and changes to an active lock", async () => {
    await expect(setWebsiteLock("example.com", Date.now() - 1)).rejects.toThrow("future");
    mockStorage.local.get.mockResolvedValue({
      "website-lock:example.com": Date.now() + 60_000,
    });
    await expect(setWebsiteLock("example.com", Date.now() + 30_000)).rejects.toThrow(
      "already locked",
    );
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it("reports storage failures", async () => {
    vi.mocked(chrome.storage.local.set).mockRejectedValue(new Error("Storage unavailable"));
    await expect(setWebsiteLock("example.com", Date.now() + 60_000)).rejects.toThrow(
      "Storage unavailable",
    );
  });
});
