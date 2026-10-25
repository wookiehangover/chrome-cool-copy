import {
  MODEL_CATALOG_CACHE_KEY,
  normalizeGatewayModels,
  parseJSONObject,
  SUPPORTED_MODELS,
  type ModelCatalogResult,
} from "@repo/shared";
import { z } from "zod";

export { MODEL_CATALOG_CACHE_KEY } from "@repo/shared";
export const MODEL_CATALOG_TTL = 24 * 60 * 60 * 1000;
export const MODEL_CATALOG_TIMEOUT = 10_000;
const CATALOG_URL = "https://ai-gateway.vercel.sh/v1/models";

const cachedCatalogSchema = z.object({
  fetchedAt: z.number().finite().nonnegative(),
  models: z
    .array(
      z.object({
        id: z.string().min(1),
        displayName: z.string().min(1),
        provider: z.string().min(1),
        creator: z.string().optional(),
        tags: z.array(z.string()).optional(),
        recommended: z.boolean().optional(),
        contextWindow: z.number().finite().nonnegative().optional(),
        maxOutputTokens: z.number().finite().nonnegative().optional(),
        inputPrice: z.number().finite().nonnegative().optional(),
        outputPrice: z.number().finite().nonnegative().optional(),
        variablePricing: z.boolean().optional(),
      }),
    )
    .min(1),
});

export function createModelCatalogService() {
  let cached: z.infer<typeof cachedCatalogSchema> | undefined;
  let loaded: Promise<void> | undefined;
  let inFlight: Promise<ModelCatalogResult> | undefined;
  let lastError: string | undefined;

  async function loadCache(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get(MODEL_CATALOG_CACHE_KEY);
      const parsed = cachedCatalogSchema.safeParse(stored[MODEL_CATALOG_CACHE_KEY]);
      if (parsed.success && parsed.data.fetchedAt <= Date.now()) cached = parsed.data;
    } catch {
      return;
    }
  }

  function available(): ModelCatalogResult {
    return cached
      ? { ...cached, source: "cache", error: lastError }
      : { models: SUPPORTED_MODELS, source: "fallback", error: lastError };
  }

  async function fetchCatalog(): Promise<ModelCatalogResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MODEL_CATALOG_TIMEOUT);
    try {
      const response = await fetch(CATALOG_URL, {
        signal: controller.signal,
        credentials: "omit",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Catalog request failed");
      const payload = parseJSONObject(await response.text());
      if (!payload) throw new Error("Invalid catalog response");
      const models = normalizeGatewayModels(payload);
      if (!models.length) throw new Error("Catalog has no compatible models");
      cached = { models, fetchedAt: Date.now() };
      lastError = undefined;
      try {
        await chrome.storage.local.set({ [MODEL_CATALOG_CACHE_KEY]: cached });
      } catch {
        return { ...cached, source: "live", error: "Models loaded but could not be cached." };
      }
      return { ...cached, source: "live" };
    } catch {
      lastError = "Could not refresh models. Retry when your connection is available.";
      return available();
    } finally {
      clearTimeout(timeout);
    }
  }

  function refreshCatalog(): Promise<ModelCatalogResult> {
    inFlight ??= fetchCatalog().finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  }

  return async function getModelCatalog(refresh = false): Promise<ModelCatalogResult> {
    loaded ??= loadCache();
    await loaded;
    if (refresh || !cached) return refreshCatalog();
    if (Date.now() - cached.fetchedAt >= MODEL_CATALOG_TTL) void refreshCatalog();
    return available();
  };
}

export const getModelCatalog = createModelCatalogService();
