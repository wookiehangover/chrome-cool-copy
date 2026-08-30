/**
 * Shared Model Constants
 * Defines supported AI models with provider groupings and display names
 */

/**
 * Unique identifier for a model
 */
export type ModelId =
  // Anthropic models
  | "anthropic/claude-fable-5"
  | "anthropic/claude-opus-4.8"
  | "anthropic/claude-sonnet-4.6"
  | "anthropic/claude-haiku-4.5"
  // OpenAI models
  | "openai/gpt-5.6-sol"
  | "openai/gpt-5.6-terra"
  | "openai/gpt-5.6-luna"
  // Google models
  | "google/gemini-3.5-flash"
  | "google/gemini-3.1-pro-preview"
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

export const DEFAULT_MODEL: ModelId = "openai/gpt-5.6-sol";

/**
 * All supported models
 */
export const SUPPORTED_MODELS: ModelDefinition[] = [
  // Anthropic models
  {
    id: "anthropic/claude-fable-5",
    displayName: "Claude Fable 5",
    provider: "Anthropic",
  },
  {
    id: "anthropic/claude-opus-4.8",
    displayName: "Claude Opus 4.8",
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
    id: "openai/gpt-5.6-sol",
    displayName: "GPT-5.6 Sol",
    provider: "OpenAI",
  },
  {
    id: "openai/gpt-5.6-terra",
    displayName: "GPT-5.6 Terra",
    provider: "OpenAI",
  },
  {
    id: "openai/gpt-5.6-luna",
    displayName: "GPT-5.6 Luna",
    provider: "OpenAI",
  },
  // Google models
  {
    id: "google/gemini-3.5-flash",
    displayName: "Gemini 3.5 Flash",
    provider: "Google",
  },
  {
    id: "google/gemini-3.1-pro-preview",
    displayName: "Gemini 3.1 Pro Preview",
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
export const MODELS_BY_PROVIDER = {
  Anthropic: SUPPORTED_MODELS.filter((m) => m.provider === "Anthropic"),
  OpenAI: SUPPORTED_MODELS.filter((m) => m.provider === "OpenAI"),
  Google: SUPPORTED_MODELS.filter((m) => m.provider === "Google"),
  "X.AI": SUPPORTED_MODELS.filter((m) => m.provider === "X.AI"),
} satisfies Record<ModelProvider, ModelDefinition[]>;
