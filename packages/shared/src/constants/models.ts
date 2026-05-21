/**
 * Shared Model Constants
 * Defines supported AI models with provider groupings and display names
 */

/**
 * Unique identifier for a model
 */
export type ModelId =
  | "anthropic/claude-opus-4-7"
  | "anthropic/claude-sonnet-4-6"
  | "anthropic/claude-haiku-4-5"
  | "openai/gpt-4o"
  | "openai/o1"
  | "google/gemini-2.5-pro"
  | "google/gemini-2.5-flash";

/**
 * AI provider identifier
 */
export type ModelProvider = "Anthropic" | "OpenAI" | "Google";

/**
 * Model definition with metadata
 */
export interface ModelDefinition {
  id: ModelId;
  displayName: string;
  provider: ModelProvider;
}

/**
 * All supported models
 */
export const SUPPORTED_MODELS: ModelDefinition[] = [
  // Anthropic models
  {
    id: "anthropic/claude-opus-4-7",
    displayName: "Claude Opus 4.7",
    provider: "Anthropic",
  },
  {
    id: "anthropic/claude-sonnet-4-6",
    displayName: "Claude Sonnet 4.6",
    provider: "Anthropic",
  },
  {
    id: "anthropic/claude-haiku-4-5",
    displayName: "Claude Haiku 4.5",
    provider: "Anthropic",
  },
  // OpenAI models
  {
    id: "openai/gpt-4o",
    displayName: "GPT-4o",
    provider: "OpenAI",
  },
  {
    id: "openai/o1",
    displayName: "o1",
    provider: "OpenAI",
  },
  // Google models
  {
    id: "google/gemini-2.5-pro",
    displayName: "Gemini 2.5 Pro",
    provider: "Google",
  },
  {
    id: "google/gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    provider: "Google",
  },
];

/**
 * Models grouped by provider for dropdown UI
 */
export const MODELS_BY_PROVIDER: Record<ModelProvider, ModelDefinition[]> = {
  Anthropic: SUPPORTED_MODELS.filter((m) => m.provider === "Anthropic"),
  OpenAI: SUPPORTED_MODELS.filter((m) => m.provider === "OpenAI"),
  Google: SUPPORTED_MODELS.filter((m) => m.provider === "Google"),
};
