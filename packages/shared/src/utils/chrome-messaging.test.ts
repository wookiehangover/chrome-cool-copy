import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendMessage } from "./chrome-messaging.js";

describe("sendMessage", () => {
  type RuntimeMessage = Parameters<typeof sendMessage>[0];
  type RuntimeResponse = {
    success: boolean;
    error?: string;
    data?: { id: string };
  };
  interface RuntimeMock {
    sendMessage: ReturnType<
      typeof vi.fn<(message: RuntimeMessage, callback: (result: RuntimeResponse) => void) => void>
    >;
    lastError: { message: string } | null;
  }

  const runtime: RuntimeMock = {
    sendMessage:
      vi.fn<(message: RuntimeMessage, callback: (result: RuntimeResponse) => void) => void>(),
    lastError: null,
  };

  beforeEach(() => {
    runtime.sendMessage.mockReset();
    runtime.lastError = null;
    vi.stubGlobal("chrome", { runtime });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves with the full response on success", async () => {
    const response = { success: true, data: { id: "clip-1" } };
    runtime.sendMessage.mockImplementation(
      (_message: RuntimeMessage, callback: (result: RuntimeResponse) => void) => {
        callback(response);
      },
    );

    await expect(sendMessage({ action: "getClip" })).resolves.toEqual(response);
  });

  it("rejects when response.success is false with explicit error", async () => {
    runtime.sendMessage.mockImplementation(
      (_message: RuntimeMessage, callback: (result: RuntimeResponse) => void) => {
        callback({ success: false, error: "Bad request" });
      },
    );

    await expect(sendMessage({ action: "getClip" })).rejects.toThrow("Bad request");
  });

  it("rejects with fallback message when response.success is false without error", async () => {
    runtime.sendMessage.mockImplementation(
      (_message: RuntimeMessage, callback: (result: RuntimeResponse) => void) => {
        callback({ success: false });
      },
    );

    await expect(sendMessage({ action: "getClip" })).rejects.toThrow(
      "Chrome runtime message failed",
    );
  });

  it("rejects when chrome.runtime.lastError is set", async () => {
    runtime.sendMessage.mockImplementation(
      (_message: RuntimeMessage, callback: (result: RuntimeResponse) => void) => {
        runtime.lastError = { message: "The message port closed before a response was received." };
        callback({ success: true });
      },
    );

    await expect(sendMessage({ action: "getClip" })).rejects.toThrow(
      "The message port closed before a response was received.",
    );
  });

  it("extracts response data using responseKey", async () => {
    runtime.sendMessage.mockImplementation(
      (_message: RuntimeMessage, callback: (result: RuntimeResponse) => void) => {
        callback({ success: true, data: { id: "clip-2" } });
      },
    );

    await expect(
      sendMessage<{ id: string }>({ action: "getClip" }, { responseKey: "data" }),
    ).resolves.toEqual({ id: "clip-2" });
  });
});
