import { useState, useEffect, useCallback } from "react";
import { DEFAULT_MODEL, sendMessage, migrateModelId } from "@repo/shared";
import type { ModelId } from "@repo/shared";

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
