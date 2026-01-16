/**
 * Shared Model Constants
 * Defines supported AI models with provider groupings and display names
 */

/**
 * Unique identifier for a model
 */
export type ModelId =
  | "xai/grok-code-fast-1"
  | "anthropic/claude-sonnet-4.5"
  | "google/gemini-3-flash"
  | "openai/gpt-5.2"
  | "anthropic/claude-opus-4.5"
  | "anthropic/claude-haiku-4.5"
  | "google/gemini-3-pro-preview"
  | "xai/grok-4.1-fast-non-reasoning"
  | "xai/grok-4.1-fast-reasoning";

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
    id: "anthropic/claude-sonnet-4.5",
    displayName: "Claude Sonnet 4.5",
    provider: "Anthropic",
  },
  {
    id: "anthropic/claude-opus-4.5",
    displayName: "Claude Opus 4.5",
    provider: "Anthropic",
  },
  {
    id: "anthropic/claude-haiku-4.5",
    displayName: "Claude Haiku 4.5",
    provider: "Anthropic",
  },
  // OpenAI models
  {
    id: "openai/gpt-5.2",
    displayName: "GPT-5.2",
    provider: "OpenAI",
  },
  // Google models
  {
    id: "google/gemini-3-flash",
    displayName: "Gemini 3 Flash",
    provider: "Google",
  },
  {
    id: "google/gemini-3-pro-preview",
    displayName: "Gemini 3 Pro Preview",
    provider: "Google",
  },
  // X.AI models
  {
    id: "xai/grok-code-fast-1",
    displayName: "Grok Code Fast 1",
    provider: "X.AI",
  },
  {
    id: "xai/grok-4.1-fast-non-reasoning",
    displayName: "Grok 4.1 Fast (Non-Reasoning)",
    provider: "X.AI",
  },
  {
    id: "xai/grok-4.1-fast-reasoning",
    displayName: "Grok 4.1 Fast (Reasoning)",
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
