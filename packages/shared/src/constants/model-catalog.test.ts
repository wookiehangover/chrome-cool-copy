import { describe, expect, it } from "vitest";
import type { JSONObject } from "../types/index.js";
import { isRecommendedModel, normalizeGatewayModels } from "./model-catalog.js";

const chatModel: JSONObject = {
  id: "google/gemini-3.5-pro",
  name: "Gemini 3.5 Pro",
  owned_by: "google",
  type: "language",
  modalities: { input: ["text", "image"], output: ["text"] },
  supported_specifications: ["v3", "v4"],
  tags: ["tool-use", "reasoning", "vision", "websocket-realtime"],
  context_window: 1000000,
  max_tokens: 64000,
  pricing: { input: "0.000002", output: "0.000012" },
};

describe("Gateway model normalization", () => {
  it("normalizes compatible multimodal models for text chat", () => {
    expect(normalizeGatewayModels({ data: [chatModel] })).toEqual([
      {
        id: "google/gemini-3.5-pro",
        displayName: "Gemini 3.5 Pro",
        provider: "Google",
        creator: "google",
        tags: chatModel.tags,
        recommended: true,
        contextWindow: 1000000,
        maxOutputTokens: 64000,
        inputPrice: 0.000002,
        outputPrice: 0.000012,
        variablePricing: false,
      },
    ]);
  });

  it.each<JSONObject>([
    { type: "image" },
    { type: "embedding" },
    { type: "reranking" },
    { type: "realtime" },
    { tags: ["reasoning"] },
    { supported_specifications: ["v3"] },
    { supported_specifications: null },
    { modalities: { input: ["image"], output: ["text"] } },
    { modalities: { input: ["text"], output: ["audio"] } },
    { modalities: undefined },
    { id: "google/gemini-3.5-pro-batch" },
    { id: "openai/gpt-realtime" },
    { id: "not-a-gateway-id" },
    { name: "  " },
  ])("rejects incompatible or incomplete metadata %j", (overrides) => {
    expect(normalizeGatewayModels({ data: [{ ...chatModel, ...overrides }] })).toEqual([]);
  });

  it("skips malformed entries without rejecting the complete catalog", () => {
    expect(normalizeGatewayModels({ data: [null, 4, "bad", [], {}, chatModel] })).toHaveLength(1);
    expect(normalizeGatewayModels({ data: "bad" })).toEqual([]);
  });

  it("ignores malformed optional metadata and preserves valid free pricing", () => {
    const [model] = normalizeGatewayModels({
      data: [
        {
          ...chatModel,
          context_window: "1000000",
          max_tokens: -1,
          pricing: { input: "0", output: "invalid" },
          tags: ["tool-use", 5, null],
        },
      ],
    });
    expect(model).toMatchObject({ inputPrice: 0, tags: ["tool-use"] });
    expect(model?.contextWindow).toBeUndefined();
    expect(model?.maxOutputTokens).toBeUndefined();
    expect(model?.outputPrice).toBeUndefined();
  });

  it.each<JSONObject>([
    { varies_by_provider: true },
    { input_tiers: [{ cost: "0.01" }] },
    { output_tiers: [{ cost: "0.01" }] },
  ])("marks variable or tiered pricing %j", (pricing) => {
    expect(normalizeGatewayModels({ data: [{ ...chatModel, pricing }] })[0]?.variablePricing).toBe(
      true,
    );
  });

  it("uses the model creator rather than an inference host for grouping", () => {
    const [model] = normalizeGatewayModels({
      data: [{ ...chatModel, id: "new-lab/frontier-chat", owned_by: "inference-host" }],
    });
    expect(model).toMatchObject({ creator: "new-lab", provider: "new-lab", recommended: false });
  });

  it("deduplicates IDs and sorts by provider and name", () => {
    const models = normalizeGatewayModels({
      data: [
        chatModel,
        chatModel,
        { ...chatModel, id: "anthropic/claude-fable-5", name: "Claude" },
      ],
    });
    expect(models.map((model) => model.id)).toEqual([
      "anthropic/claude-fable-5",
      "google/gemini-3.5-pro",
    ]);
  });
});

describe("frontier recommendations", () => {
  it.each([
    "openai/gpt-6-astra",
    "openai/gpt-10",
    "anthropic/claude-opus-5.5",
    "google/gemini-4-pro-preview",
    "spacexai/grok-4.6",
    "deepseek/deepseek-v4",
    "alibaba/qwen3-max",
    "moonshotai/kimi-k2.5",
    "zai/glm-5",
    "minimax/minimax-m3",
    "mistral/mistral-large-3",
    "meta/llama-4-maverick",
  ])("recommends current families without enumerating model versions: %s", (id) => {
    expect(isRecommendedModel(id)).toBe(true);
  });

  it.each([
    "openai/gpt-4o",
    "google/gemini-2.5-pro",
    "openai/gpt-6-astra-batch",
    "alibaba/qwen3-coder",
    "new-lab/chat",
    "invalid",
  ])("does not recommend legacy or specialized families: %s", (id) => {
    expect(isRecommendedModel(id)).toBe(false);
  });
});
