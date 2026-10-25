/**
 * Shared Model Constants
 * Defines supported AI models with provider groupings and display names
 */

/**
 * Unique identifier for a model
 */
export type ModelId = string;

/**
 * AI provider identifier
 */
export type ModelProvider = string;

/**
 * Model definition with metadata
 */
export interface ModelDefinition {
  id: ModelId;
  displayName: string;
  provider: ModelProvider;
  creator?: string;
  tags?: string[];
  recommended?: boolean;
  contextWindow?: number;
  maxOutputTokens?: number;
  inputPrice?: number;
  outputPrice?: number;
  variablePricing?: boolean;
}

export interface ModelCatalogRequest {
  action: "getModelCatalog";
  refresh?: boolean;
}

export interface ModelCatalogResult {
  models: ModelDefinition[];
  source: "live" | "cache" | "fallback";
  fetchedAt?: number;
  error?: string;
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
