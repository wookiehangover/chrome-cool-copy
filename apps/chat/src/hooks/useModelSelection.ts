import { useState, useEffect, useCallback } from "react";
import { DEFAULT_MODEL, sendMessage, SUPPORTED_MODELS } from "@repo/shared";
import type { ModelId } from "@repo/shared";

// Migration map for old model IDs to new ones
const MODEL_MIGRATION_MAP = {
  "anthropic/claude-opus-4.7": "anthropic/claude-opus-4.8",
  "anthropic/claude-opus-4.6": "anthropic/claude-opus-4.8",
  "anthropic/claude-opus-4.5": "anthropic/claude-opus-4.8",
  "anthropic/claude-sonnet-4.5": "anthropic/claude-sonnet-4.6",
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
  "google/gemini-3-flash": "google/gemini-3.5-flash",
  "google/gemini-2.5-flash": "google/gemini-3.5-flash",
  "google/gemini-2.0-flash": "google/gemini-3.5-flash",
  "google/gemini-3-pro-preview": "google/gemini-3.1-pro-preview",
  "google/gemini-2.5-pro": "google/gemini-3.1-pro-preview",
  "xai/grok-code-fast-1": "xai/grok-4.3",
  "xai/grok-4.1-fast-non-reasoning": "xai/grok-4.20-non-reasoning",
  "xai/grok-4.1-fast-reasoning": "xai/grok-4.20-reasoning",
} satisfies Record<string, ModelId>;

/**
 * Migrate old model ID to new one if needed
 */
function migrateModelId(modelId: string): ModelId {
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

/**
 * Hook for managing model selection with chrome.storage.sync
 * Loads initial model from storage and syncs changes back
 */
export function useModelSelection(messageSender: typeof sendMessage = sendMessage) {
  const [selectedModel, setSelectedModel] = useState<ModelId>(DEFAULT_MODEL);
  const [isLoading, setIsLoading] = useState(true);

  // Load model from storage on mount
  useEffect(() => {
    const loadModel = async () => {
      try {
        const result = await new Promise<{ aiGatewayConfig?: { model?: string } }>((resolve) => {
          chrome.storage.sync.get(["aiGatewayConfig"], (result) => {
            resolve(result);
          });
        });

        const model = result.aiGatewayConfig?.model;
        if (model) {
          const migratedModel = migrateModelId(model);
          setSelectedModel(migratedModel);

          // If model was migrated, save the new one
          if (migratedModel !== model) {
            console.log(`[useModelSelection] Migrated model from ${model} to ${migratedModel}`);
            messageSender({
              action: "updateAIGatewayConfig",
              config: { model: migratedModel },
            }).catch((err) => {
              console.error("[useModelSelection] Failed to save migrated model:", err);
            });
          }
        }
      } catch (error) {
        console.error("[useModelSelection] Failed to load model from storage:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadModel();
  }, [messageSender]);

  // Save model to storage when it changes
  const handleModelChange = useCallback(
    (model: ModelId) => {
      setSelectedModel(model);

      // Save to chrome.storage.sync
      messageSender({
        action: "updateAIGatewayConfig",
        config: { model },
      })
        .then(() => {
          console.log("[useModelSelection] Model saved successfully:", model);
        })
        .catch((err) => {
          console.error("[useModelSelection] Failed to save model:", err);
        });
    },
    [messageSender],
  );

  return {
    selectedModel,
    setSelectedModel: handleModelChange,
    isLoading,
  };
}
