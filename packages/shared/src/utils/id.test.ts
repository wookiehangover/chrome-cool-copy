import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateClipId,
  generateId,
  generateSessionId,
  generateUUID,
} from "./id.js";

describe("ID utilities", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generateUUID returns crypto.randomUUID", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("uuid-1");

    expect(generateUUID()).toBe("uuid-1");
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
  });

  it("generateSessionId returns crypto.randomUUID", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("session-uuid");

    expect(generateSessionId()).toBe("session-uuid");
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
  });

  it("generateClipId returns a clip-prefixed id with timestamp and suffix", () => {
    vi.spyOn(Date, "now").mockReturnValue(1700000000000);
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);

    expect(generateClipId()).toBe("clip_1700000000000_4fzzzxjyl");
  });

  it("generateId returns a prefixed id when prefix is provided", () => {
    vi.spyOn(Date, "now").mockReturnValue(1700000000000);
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);

    expect(generateId("session")).toBe("session_1700000000000_4fzzzxjyl");
  });

  it("generateId returns an id without prefix when no prefix is provided", () => {
    vi.spyOn(Date, "now").mockReturnValue(1700000000000);
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);

    expect(generateId()).toBe("1700000000000_4fzzzxjyl");
  });
});
