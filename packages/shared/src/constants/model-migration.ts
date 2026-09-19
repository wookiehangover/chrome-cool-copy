import { DEFAULT_MODEL, SUPPORTED_MODELS, type ModelId } from "./models.js";

// Migration map for old model IDs to new ones
export const MODEL_MIGRATION_MAP = {
  "anthropic/claude-opus-4.7": "anthropic/claude-opus-5",
  "anthropic/claude-opus-4.6": "anthropic/claude-opus-5",
  "anthropic/claude-opus-4.5": "anthropic/claude-opus-5",
  "anthropic/claude-sonnet-4.5": "anthropic/claude-fable-5",
  "openai/gpt-5.5": DEFAULT_MODEL,
  "openai/gpt-5.5-pro": DEFAULT_MODEL,
  "openai/gpt-5.4": "openai/gpt-5.6-terra",
  "openai/gpt-5.4-mini": "openai/gpt-5.6-luna",
  "openai/gpt-5.2": DEFAULT_MODEL,
  "openai/gpt-4o": DEFAULT_MODEL,
  "openai/gpt-4o-mini": "openai/gpt-5.6-luna",
  "openai/o1": DEFAULT_MODEL,
  "openai/o3": DEFAULT_MODEL,
  "openai/o3-mini": "openai/gpt-5.6-luna",
  "google/gemini-3-flash": DEFAULT_MODEL,
  "google/gemini-2.5-flash": DEFAULT_MODEL,
  "google/gemini-2.0-flash": DEFAULT_MODEL,
  "google/gemini-3-pro-preview": DEFAULT_MODEL,
  "google/gemini-2.5-pro": DEFAULT_MODEL,
  "xai/grok-code-fast-1": "spacexai/grok-4.6",
  "xai/grok-4.1-fast-non-reasoning": "spacexai/grok-4.6",
  "xai/grok-4.1-fast-reasoning": "spacexai/grok-4.6",
  "anthropic/claude-opus-4.8": "anthropic/claude-opus-5",
  "anthropic/claude-sonnet-4.6": "anthropic/claude-fable-5",
  "anthropic/claude-haiku-4.5": "anthropic/claude-fable-5",
  "xai/grok-4.3": "spacexai/grok-4.6",
  "xai/grok-4.20-reasoning": "spacexai/grok-4.6",
  "xai/grok-4.20-non-reasoning": "spacexai/grok-4.6",
  "google/gemini-3.5-flash": DEFAULT_MODEL,
  "google/gemini-3.1-pro-preview": DEFAULT_MODEL,
} satisfies Record<string, ModelId>;

/**
 * Migrate old model ID to new one if needed
 */
export function migrateModelId(modelId: string): ModelId {
  // Check if model needs migration
  const migratedModel = Object.entries(MODEL_MIGRATION_MAP).find(
    ([legacyModel]) => legacyModel === modelId,
  )?.[1];
  if (migratedModel) return migratedModel;

  // Check if model is currently supported
  const isSupported = SUPPORTED_MODELS.some((m) => m.id === modelId);
  if (isSupported) {
    return SUPPORTED_MODELS.find((model) => model.id === modelId)?.id ?? DEFAULT_MODEL;
  }

  // Default to the default model if unknown
  return DEFAULT_MODEL;
}
