import { describe, expect, it, vi } from "vitest";
import type { LanguageModel, streamText } from "ai";
import { getBoostSystemPrompt } from "@repo/shared";
import { startStreamingRequest } from "./streaming-request.js";

function createHarness() {
  const stream = vi.fn((_options: Parameters<typeof streamText>[0]) => ({ result: "started" }));
  // SAFETY: startStreamingRequest passes this opaque value through without accessing model fields.
  const model = { modelId: "test-model" } as LanguageModel;
  return { stream, model };
}

describe("startStreamingRequest", () => {
  it("calls streamText with ordinary messages unchanged and no instructions", () => {
    const { stream, model } = createHarness();
    startStreamingRequest({
      stream,
      model,
      request: {
        messages: [
          { role: "user", content: "one" },
          { role: "assistant", content: "two" },
        ],
      },
      tools: {},
      defaultProviderOptions: {},
    });

    const call = stream.mock.calls[0]?.[0];
    expect(call).not.toHaveProperty("instructions");
    expect(call?.messages).toEqual([
      { role: "user", content: "one" },
      { role: "assistant", content: "two" },
    ]);
  });

  it("calls the normal streamText boundary with page instructions outside messages", () => {
    const { stream, model } = createHarness();
    const pageInstructions = `You are a helpful assistant. The user is currently viewing a webpage:

Title: Page
URL: https://example.com

If the user asks about this page, use the browse tool to fetch and analyze its content.`;
    startStreamingRequest({
      stream,
      model,
      request: {
        instructions: pageInstructions,
        messages: [{ role: "user", content: "Explain this page" }],
      },
      tools: {},
      defaultProviderOptions: {},
    });

    expect(stream).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: pageInstructions,
        messages: [{ role: "user", content: "Explain this page" }],
      }),
    );
  });

  it("calls the boost streamText boundary with contextual, explicit, and legacy instructions once", () => {
    const { stream, model } = createHarness();
    const boostInstructions = getBoostSystemPrompt({
      url: "https://example.com/page",
      title: "Example",
    });
    startStreamingRequest({
      stream,
      model,
      instructionPrefix: boostInstructions,
      request: {
        instructions: "explicit",
        messages: [
          { role: "system", content: "legacy one" },
          { role: "user", content: "one" },
          { role: "system", content: "legacy two" },
          { role: "assistant", content: "two" },
        ],
      },
      tools: {},
      defaultProviderOptions: {},
    });

    const call = stream.mock.calls[0]?.[0];
    expect(call?.instructions).toBe(`${boostInstructions}\n\nexplicit\n\nlegacy one\n\nlegacy two`);
    expect(call?.messages).toEqual([
      { role: "user", content: "one" },
      { role: "assistant", content: "two" },
    ]);
    expect(call?.messages).not.toContainEqual(expect.objectContaining({ role: "system" }));
  });
});
