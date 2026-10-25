import { useState, useEffect, useCallback, useRef } from "react";
import { DEFAULT_MODEL, sendMessage, migrateModelId } from "@repo/shared";
import type { ModelId } from "@repo/shared";
import { loadModelCatalog } from "./useModelCatalog";

export function useModelSelection(messageSender: typeof sendMessage = sendMessage) {
  const [selectedModel, setSelectedModel] = useState<ModelId>(DEFAULT_MODEL);
  const [isLoading, setIsLoading] = useState(true);
  const selectionVersion = useRef(0);

  useEffect(() => {
    let active = true;
    const version = selectionVersion.current;
    const isCurrent = () => active && selectionVersion.current === version;
    const loadModel = async () => {
      try {
        const result = await new Promise<{ aiGatewayConfig?: { model?: string } }>((resolve) => {
          chrome.storage.sync.get(["aiGatewayConfig"], resolve);
        });
        const model = result.aiGatewayConfig?.model;
        if (!model || !isCurrent()) return;
        setSelectedModel(migrateModelId(model));
        const catalog = await loadModelCatalog(false, messageSender);
        if (!isCurrent() || catalog.source !== "live") return;
        const migratedModel = migrateModelId(model, catalog.models);
        if (migratedModel !== model) {
          setSelectedModel(migratedModel);
          await messageSender({
            action: "updateAIGatewayConfig",
            config: { model: migratedModel },
          });
        }
      } catch (error) {
        console.error("[useModelSelection] Could not refresh saved model:", error);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void loadModel();
    return () => {
      active = false;
    };
  }, [messageSender]);

  const handleModelChange = useCallback(
    (model: ModelId) => {
      selectionVersion.current += 1;
      setSelectedModel(model);
      void messageSender({ action: "updateAIGatewayConfig", config: { model } }).catch((error) => {
        console.error("[useModelSelection] Failed to save model:", error);
      });
    },
    [messageSender],
  );

  return { selectedModel, setSelectedModel: handleModelChange, isLoading };
}
