import { useCallback, useEffect, useRef, useState } from "react";
import {
  MODEL_CATALOG_CACHE_KEY,
  sendMessage,
  SUPPORTED_MODELS,
  type ModelCatalogResult,
} from "@repo/shared";

export async function loadModelCatalog(
  refresh = false,
  messageSender: typeof sendMessage = sendMessage,
): Promise<ModelCatalogResult> {
  const result = await messageSender<ModelCatalogResult | undefined>({
    action: "getModelCatalog",
    refresh,
  });
  if (!result || !Array.isArray(result.models) || result.models.length === 0) {
    throw new Error("The model catalog was empty. Please try again.");
  }
  return result;
}

export function useModelCatalog() {
  const [catalog, setCatalog] = useState<ModelCatalogResult>({
    models: SUPPORTED_MODELS,
    source: "fallback",
  });
  const [isLoading, setIsLoading] = useState(true);
  const request = useRef(0);
  const load = useCallback(async (refresh = false) => {
    const current = ++request.current;
    setIsLoading(true);
    try {
      const result = await loadModelCatalog(refresh);
      if (current === request.current) setCatalog(result);
    } catch (error) {
      if (current === request.current) {
        setCatalog((previous) => ({
          ...previous,
          error: error instanceof Error ? error.message : "Could not load models.",
        }));
      }
    } finally {
      if (current === request.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const onStorageChanged: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      area,
    ) => {
      if (area === "local" && MODEL_CATALOG_CACHE_KEY in changes) void load();
    };
    chrome.storage.onChanged?.addListener(onStorageChanged);
    void load();
    return () => {
      chrome.storage.onChanged?.removeListener(onStorageChanged);
      request.current += 1;
    };
  }, [load]);

  return { ...catalog, isLoading, retry: () => load(true) };
}
