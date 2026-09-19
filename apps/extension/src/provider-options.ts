import { MODELS_BY_PROVIDER } from "@repo/shared";

/**
 * Models that require adaptive thinking (thinking.type: "adaptive" + output_config.effort)
 * instead of the legacy enabled thinking (thinking.type: "enabled" + budgetTokens).
 */
const ADAPTIVE_THINKING_MODELS = [
  ...MODELS_BY_PROVIDER.Anthropic.map(({ id }) => id),
  "anthropic/claude-opus-4.8",
];

/**
 * Returns default provider options with the correct thinking configuration
 * based on the model being used.
 */
export function getDefaultProviderOptions(modelId: string) {
  const isAdaptive = ADAPTIVE_THINKING_MODELS.some((m) => modelId.includes(m));

  if (isAdaptive) {
    return {
      anthropic: {
        thinking: { type: "adaptive" as const },
        output_config: { effort: "high" as const },
      },
    };
  }

  return {
    anthropic: {
      thinking: { type: "enabled" as const, budgetTokens: 10000 },
    },
  };
}
