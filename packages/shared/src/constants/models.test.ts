import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL, MODELS_BY_PROVIDER, SUPPORTED_MODELS } from "./models";

describe("model catalog", () => {
  it("uses GPT-5.6 Sol as the canonical default", () => {
    expect(DEFAULT_MODEL).toBe("openai/gpt-5.6-sol");
    expect(SUPPORTED_MODELS.some(({ id }) => id === DEFAULT_MODEL)).toBe(true);
  });

  it("exposes the supported GPT-5.6 family with OpenAI metadata", () => {
    expect(MODELS_BY_PROVIDER.OpenAI).toEqual([
      { id: "openai/gpt-5.6-sol", displayName: "GPT-5.6 Sol", provider: "OpenAI" },
      { id: "openai/gpt-5.6-terra", displayName: "GPT-5.6 Terra", provider: "OpenAI" },
      { id: "openai/gpt-5.6-luna", displayName: "GPT-5.6 Luna", provider: "OpenAI" },
    ]);
  });
});
