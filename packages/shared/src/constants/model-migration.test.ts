import { describe, expect, it } from "vitest";
import { migrateModelId, MODEL_MIGRATION_MAP } from "./model-migration";
import { DEFAULT_MODEL, SUPPORTED_MODELS } from "./models";

describe("model migration", () => {
  it.each(SUPPORTED_MODELS)("preserves supported model $id", ({ id }) => {
    expect(migrateModelId(id)).toBe(id);
  });

  it.each([
    ["anthropic/claude-opus-4.8", "anthropic/claude-opus-5"],
    ["anthropic/claude-opus-4.7", "anthropic/claude-opus-5"],
    ["anthropic/claude-opus-4.6", "anthropic/claude-opus-5"],
    ["anthropic/claude-opus-4.5", "anthropic/claude-opus-5"],
    ["anthropic/claude-sonnet-4.6", "anthropic/claude-fable-5"],
    ["anthropic/claude-sonnet-4.5", "anthropic/claude-fable-5"],
    ["anthropic/claude-haiku-4.5", "anthropic/claude-fable-5"],
    ["google/gemini-3.5-flash", DEFAULT_MODEL],
    ["google/gemini-3.1-pro-preview", DEFAULT_MODEL],
    ["google/gemini-2.5-pro", DEFAULT_MODEL],
    ["xai/grok-4.3", "spacexai/grok-4.6"],
    ["xai/grok-4.20-reasoning", "spacexai/grok-4.6"],
    ["xai/grok-4.20-non-reasoning", "spacexai/grok-4.6"],
    ["xai/grok-code-fast-1", "spacexai/grok-4.6"],
    ["xai/grok-4.1-fast-reasoning", "spacexai/grok-4.6"],
    ["xai/grok-4.1-fast-non-reasoning", "spacexai/grok-4.6"],
    ["openai/gpt-5.5", DEFAULT_MODEL],
    ["openai/gpt-5.4", "openai/gpt-5.6-terra"],
    ["openai/gpt-5.4-mini", "openai/gpt-5.6-luna"],
  ])("migrates %s directly to %s", (legacy, replacement) => {
    expect(migrateModelId(legacy, SUPPORTED_MODELS)).toBe(replacement);
  });

  it("keeps every migration target supported and stable", () => {
    for (const target of Object.values(MODEL_MIGRATION_MAP)) {
      expect(SUPPORTED_MODELS.some(({ id }) => id === target)).toBe(true);
      expect(migrateModelId(target)).toBe(target);
    }
  });

  it.each(["", "toString", "__proto__", "invalid id/model", "provider/../model"])(
    "falls back to the default for unknown ID %s",
    (id) => {
      expect(migrateModelId(id)).toBe(DEFAULT_MODEL);
    },
  );

  it("preserves dynamic IDs while offline or absent from the catalog", () => {
    expect(migrateModelId("acme/new-chat")).toBe("acme/new-chat");
    expect(migrateModelId("acme/new-chat", SUPPORTED_MODELS)).toBe("acme/new-chat");
    expect(migrateModelId("google/gemini-3.5-flash")).toBe("google/gemini-3.5-flash");
  });

  it("prefers an exact catalog match over an old migration alias", () => {
    const id = "google/gemini-3.5-flash";
    expect(
      migrateModelId(id, [...SUPPORTED_MODELS, { id, displayName: "Gemini", provider: "Google" }]),
    ).toBe(id);
  });

  it("does not migrate to an unavailable target", () => {
    expect(migrateModelId("google/gemini-3.5-flash", [])).toBe("google/gemini-3.5-flash");
  });
});
