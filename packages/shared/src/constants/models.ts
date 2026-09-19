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
  | "anthropic/claude-opus-5"
  // OpenAI models
  | "openai/gpt-5.6-sol"
  | "openai/gpt-5.6-terra"
  | "openai/gpt-5.6-luna"
  | "openai/gpt-6-astra"
  // xAI models
  | "spacexai/grok-4.6";

/**
 * AI provider identifier
 */
export type ModelProvider = "Anthropic" | "OpenAI" | "X.AI";

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
    id: "anthropic/claude-opus-5",
    displayName: "Claude Opus 5",
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
  {
    id: "openai/gpt-6-astra",
    displayName: "GPT-6 Astra",
    provider: "OpenAI",
  },
  // xAI models
  {
    id: "spacexai/grok-4.6",
    displayName: "Grok 4.6",
    provider: "X.AI",
  },
];

/**
 * Models grouped by provider for dropdown UI
 */
export const MODELS_BY_PROVIDER = {
  Anthropic: SUPPORTED_MODELS.filter((m) => m.provider === "Anthropic"),
  OpenAI: SUPPORTED_MODELS.filter((m) => m.provider === "OpenAI"),
  "X.AI": SUPPORTED_MODELS.filter((m) => m.provider === "X.AI"),
} satisfies Record<ModelProvider, ModelDefinition[]>;
