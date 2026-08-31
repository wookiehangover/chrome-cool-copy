import { beforeEach, describe, expect, it, vi } from "vitest";
import { boostSystemPrompt } from "@repo/shared";
import { BoostTransport } from "./boost-transport";
import { ChromeExtensionTransport } from "./chrome-extension-transport";
import { generateTitle } from "./generate-title";
import { mockRuntime } from "../test/setup";

function captureRequest(transport: ChromeExtensionTransport | BoostTransport) {
  const postMessage = vi.fn();
  const addListener = vi.fn();
  const event = {
    addListener,
    addRules: vi.fn(),
    getRules: vi.fn(),
    hasListener: vi.fn(),
    hasListeners: vi.fn(),
    removeListener: vi.fn(),
    removeRules: vi.fn(),
  };
  const port: chrome.runtime.Port = {
    name: "test",
    postMessage,
    onMessage: event,
    onDisconnect: event,
    disconnect: vi.fn(),
  };
  vi.mocked(chrome.runtime.connect).mockReturnValue(port);

  void transport.sendMessages({
    trigger: "submit-message",
    chatId: "chat",
    messageId: "message",
    messages: [
      { id: "user", role: "user", parts: [{ type: "text", text: "hello" }] },
      { id: "assistant", role: "assistant", parts: [{ type: "text", text: "hi" }] },
    ],
    abortSignal: undefined,
  });

  return postMessage.mock.calls[0]?.[0];
}

describe("AI prompt requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(chrome.runtime, { connect: vi.fn() });
  });

  it("sends ordinary chat without instructions", () => {
    expect(captureRequest(new ChromeExtensionTransport())).toEqual({
      action: "streamText",
      messages: [
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi" },
      ],
    });
  });

  it("sends page context as top-level instructions", () => {
    const request = captureRequest(
      new ChromeExtensionTransport({ pageContext: { title: "Page", url: "https://example.com" } }),
    );
    expect(request.instructions).toContain("Title: Page\nURL: https://example.com");
    expect(request.instructions.match(/https:\/\/example\.com/g)).toHaveLength(1);
    expect(request.instructions).toContain("do not claim you cannot see the current URL");
    expect(request.messages).not.toContainEqual(expect.objectContaining({ role: "system" }));
  });

  it("leaves boost instructions to the contextual background boundary", () => {
    const request = captureRequest(new BoostTransport({ domain: "example.com" }));
    expect(request.instructions).toBeUndefined();
    expect(request.messages).not.toContainEqual(expect.objectContaining({ role: "system" }));
    expect(boostSystemPrompt).toContain("You are an expert JavaScript developer");
  });

  it("sends title instructions separately from the conversation", async () => {
    mockRuntime.sendMessage.mockImplementation((_request, callback) =>
      callback({ success: true, content: "A title" }),
    );
    await generateTitle([{ id: "user", role: "user", parts: [{ type: "text", text: "hello" }] }]);
    const request = mockRuntime.sendMessage.mock.calls[0]?.[0];
    expect(request.instructions).toContain("You are a title generator");
    expect(request.messages).toEqual([{ role: "user", content: "user: hello" }]);
  });
});
