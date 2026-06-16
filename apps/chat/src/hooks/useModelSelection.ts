import { useState, useEffect, useCallback } from "react";
import { sendMessage, SUPPORTED_MODELS } from "@repo/shared";
import type { ModelId } from "@repo/shared";

const DEFAULT_MODEL: ModelId = "anthropic/claude-opus-4.8";

// Migration map for old model IDs to new ones
const MODEL_MIGRATION_MAP: Record<string, ModelId> = {
  "anthropic/claude-opus-4.7": "anthropic/claude-opus-4.8",
  "anthropic/claude-opus-4.6": "anthropic/claude-opus-4.8",
  "anthropic/claude-opus-4.5": "anthropic/claude-opus-4.8",
  "anthropic/claude-sonnet-4.5": "anthropic/claude-sonnet-4.6",
  "openai/gpt-5.2": "openai/gpt-5.5",
  "openai/gpt-4o": "openai/gpt-5.5",
  "openai/gpt-4o-mini": "openai/gpt-5.4-mini",
  "openai/o1": "openai/gpt-5.5",
  "openai/o3": "openai/gpt-5.5",
  "openai/o3-mini": "openai/gpt-5.4-mini",
  "google/gemini-3-flash": "google/gemini-3.5-flash",
  "google/gemini-2.5-flash": "google/gemini-3.5-flash",
  "google/gemini-2.0-flash": "google/gemini-3.5-flash",
  "google/gemini-3-pro-preview": "google/gemini-3.1-pro-preview",
  "google/gemini-2.5-pro": "google/gemini-3.1-pro-preview",
  "xai/grok-code-fast-1": "xai/grok-4.3",
  "xai/grok-4.1-fast-non-reasoning": "xai/grok-4.20-non-reasoning",
  "xai/grok-4.1-fast-reasoning": "xai/grok-4.20-reasoning",
};

/**
 * Migrate old model ID to new one if needed
 */
function migrateModelId(modelId: string): ModelId {
  // Check if model needs migration
  if (modelId in MODEL_MIGRATION_MAP) {
    return MODEL_MIGRATION_MAP[modelId];
  }

  // Check if model is currently supported
  const isSupported = SUPPORTED_MODELS.some((m) => m.id === modelId);
  if (isSupported) {
    return modelId as ModelId;
  }

  // Default to the default model if unknown
  return DEFAULT_MODEL;
}

/**
 * Hook for managing model selection with chrome.storage.sync
 * Loads initial model from storage and syncs changes back
 */
export function useModelSelection() {
  const [selectedModel, setSelectedModel] = useState<ModelId>(DEFAULT_MODEL);
  const [isLoading, setIsLoading] = useState(true);

  // Load model from storage on mount
  useEffect(() => {
    const loadModel = async () => {
      try {
        const result = await new Promise<{ aiGatewayConfig?: { model?: ModelId } }>((resolve) => {
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
            sendMessage({
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
  }, []);

  // Save model to storage when it changes
  const handleModelChange = useCallback((model: ModelId) => {
    setSelectedModel(model);

    // Save to chrome.storage.sync
    sendMessage({
      action: "updateAIGatewayConfig",
      config: { model },
    })
      .then(() => {
        console.log("[useModelSelection] Model saved successfully:", model);
      })
      .catch((err) => {
        console.error("[useModelSelection] Failed to save model:", err);
      });
  }, []);

  return {
    selectedModel,
    setSelectedModel: handleModelChange,
    isLoading,
  };
}
