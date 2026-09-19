import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL, MODELS_BY_PROVIDER, SUPPORTED_MODELS } from "./models";

describe("model catalog", () => {
  it("uses GPT-5.6 Sol as the canonical default", () => {
    expect(DEFAULT_MODEL).toBe("openai/gpt-5.6-sol");
    expect(SUPPORTED_MODELS.some(({ id }) => id === DEFAULT_MODEL)).toBe(true);
  });

  it("exposes the requested OpenAI models", () => {
    expect(MODELS_BY_PROVIDER.OpenAI).toEqual([
      { id: "openai/gpt-5.6-sol", displayName: "GPT-5.6 Sol", provider: "OpenAI" },
      { id: "openai/gpt-5.6-terra", displayName: "GPT-5.6 Terra", provider: "OpenAI" },
      { id: "openai/gpt-5.6-luna", displayName: "GPT-5.6 Luna", provider: "OpenAI" },
      { id: "openai/gpt-6-astra", displayName: "GPT-6 Astra", provider: "OpenAI" },
    ]);
  });

  it("exposes only the requested Claude and Grok models alongside OpenAI", () => {
    expect(MODELS_BY_PROVIDER.Anthropic).toEqual([
      { id: "anthropic/claude-fable-5", displayName: "Claude Fable 5", provider: "Anthropic" },
      { id: "anthropic/claude-opus-5", displayName: "Claude Opus 5", provider: "Anthropic" },
    ]);
    expect(MODELS_BY_PROVIDER["X.AI"]).toEqual([
      { id: "spacexai/grok-4.6", displayName: "Grok 4.6", provider: "X.AI" },
    ]);
    expect(Object.keys(MODELS_BY_PROVIDER)).toEqual(["Anthropic", "OpenAI", "X.AI"]);
    expect(SUPPORTED_MODELS).toHaveLength(7);
    expect(new Set(SUPPORTED_MODELS.map(({ id }) => id)).size).toBe(7);
  });
});
