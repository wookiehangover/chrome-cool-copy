/**
 * Shared Model Constants
 * Defines supported AI models with provider groupings and display names
 */

/**
 * Unique identifier for a model
 */
export type ModelId =
  // Anthropic models
  | "anthropic/claude-opus-4.7"
  | "anthropic/claude-sonnet-4.6"
  | "anthropic/claude-haiku-4.5"
  // OpenAI models
  | "openai/gpt-5.5"
  // Google models
  | "google/gemini-2.5-pro"
  | "google/gemini-2.5-flash"
  | "google/gemini-2.0-flash"
  // xAI models
  | "xai/grok-4.20-reasoning"
  | "xai/grok-4.20-non-reasoning"
  | "xai/grok-4.3";

/**
 * AI provider identifier
 */
export type ModelProvider = "Anthropic" | "OpenAI" | "Google" | "X.AI";

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
    id: "anthropic/claude-opus-4.7",
    displayName: "Claude Opus 4.7",
    provider: "Anthropic",
  },
  {
    id: "anthropic/claude-sonnet-4.6",
    displayName: "Claude Sonnet 4.6",
    provider: "Anthropic",
  },
  {
    id: "anthropic/claude-haiku-4.5",
    displayName: "Claude Haiku 4.5",
    provider: "Anthropic",
  },
  // OpenAI models
  {
    id: "openai/gpt-5.5",
    displayName: "GPT-5.5",
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
  {
    id: "google/gemini-2.0-flash",
    displayName: "Gemini 2.0 Flash",
    provider: "Google",
  },
  // xAI models
  {
    id: "xai/grok-4.20-reasoning",
    displayName: "Grok 4.20 Reasoning",
    provider: "X.AI",
  },
  {
    id: "xai/grok-4.20-non-reasoning",
    displayName: "Grok 4.20 Non-Reasoning",
    provider: "X.AI",
  },
  {
    id: "xai/grok-4.3",
    displayName: "Grok 4.3",
    provider: "X.AI",
  },
];

/**
 * Models grouped by provider for dropdown UI
 */
export const MODELS_BY_PROVIDER: Record<ModelProvider, ModelDefinition[]> = {
  Anthropic: SUPPORTED_MODELS.filter((m) => m.provider === "Anthropic"),
  OpenAI: SUPPORTED_MODELS.filter((m) => m.provider === "OpenAI"),
  Google: SUPPORTED_MODELS.filter((m) => m.provider === "Google"),
  "X.AI": SUPPORTED_MODELS.filter((m) => m.provider === "X.AI"),
};
