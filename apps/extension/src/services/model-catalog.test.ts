import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SUPPORTED_MODELS } from "@repo/shared";
import { mockStorage } from "../test/setup";
import {
  createModelCatalogService,
  MODEL_CATALOG_CACHE_KEY,
  MODEL_CATALOG_TIMEOUT,
  MODEL_CATALOG_TTL,
} from "./model-catalog";

const payload = {
  data: [
    {
      id: "openai/test-chat",
      name: "Test chat",
      owned_by: "openai",
      type: "language",
      tags: ["tool-use"],
      modalities: { input: ["text"], output: ["text"] },
      supported_specifications: ["v4"],
    },
  ],
};

describe("model catalog discovery", () => {
  const originalFetch = globalThis.fetch;
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-25T12:00:00Z"));
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    mockStorage.local.get.mockReset().mockResolvedValue({});
    mockStorage.local.set.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.stubGlobal("fetch", originalFetch);
  });

  it("fetches the public catalog once for concurrent requests and persists normalized models", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(payload)));
    const getCatalog = createModelCatalogService();
    const [first, second] = await Promise.all([getCatalog(), getCatalog(true)]);
    expect(first).toEqual(second);
    expect(first.source).toBe("live");
    expect(first.models[0]?.id).toBe("openai/test-chat");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("https://ai-gateway.vercel.sh/v1/models", {
      signal: expect.any(AbortSignal),
      credentials: "omit",
      cache: "no-store",
    });
    expect(mockStorage.local.set).toHaveBeenCalledWith({
      [MODEL_CATALOG_CACHE_KEY]: {
        models: first.models,
        fetchedAt: Date.now(),
      },
    });
  });

  it("uses a fresh persisted cache without a network request", async () => {
    mockStorage.local.get.mockResolvedValue({
      [MODEL_CATALOG_CACHE_KEY]: {
        models: SUPPORTED_MODELS,
        fetchedAt: Date.now(),
      },
    });
    expect((await createModelCatalogService()()).source).toBe("cache");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns stale models immediately and refreshes them in the background", async () => {
    mockStorage.local.get.mockResolvedValue({
      [MODEL_CATALOG_CACHE_KEY]: {
        models: SUPPORTED_MODELS,
        fetchedAt: Date.now() - MODEL_CATALOG_TTL,
      },
    });
    let resolveFetch: (response: Response) => void = () => {
      throw new Error("Fetch has not started");
    };
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const getCatalog = createModelCatalogService();
    const stale = await getCatalog();
    expect(stale.source).toBe("cache");
    expect(stale.models).toEqual(SUPPORTED_MODELS);
    const refresh = getCatalog(true);
    resolveFetch(new Response(JSON.stringify(payload)));
    expect((await refresh).source).toBe("live");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await getCatalog()).models[0]?.id).toBe("openai/test-chat");
  });

  it.each(["empty", "invalid", "http", "offline"])(
    "preserves a valid cache on %s failure",
    async (failure) => {
      mockStorage.local.get.mockResolvedValue({
        [MODEL_CATALOG_CACHE_KEY]: {
          models: SUPPORTED_MODELS,
          fetchedAt: Date.now(),
        },
      });
      if (failure === "offline") fetchMock.mockRejectedValue(new Error("offline"));
      else
        fetchMock.mockResolvedValue(
          new Response(failure === "invalid" ? "not json" : JSON.stringify({ data: [] }), {
            status: failure === "http" ? 503 : 200,
          }),
        );
      const result = await createModelCatalogService()(true);
      expect(result).toMatchObject({
        source: "cache",
        models: SUPPORTED_MODELS,
        error: expect.any(String),
      });
      expect(mockStorage.local.set).not.toHaveBeenCalled();
    },
  );

  it("ignores malformed caches and uses bundled models on first-use failure", async () => {
    mockStorage.local.get.mockResolvedValue({
      [MODEL_CATALOG_CACHE_KEY]: { models: [{}], fetchedAt: "bad" },
    });
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await createModelCatalogService()()).toMatchObject({
      source: "fallback",
      models: SUPPORTED_MODELS,
      error: expect.any(String),
    });
  });

  it("aborts timed-out requests and allows a later retry", async () => {
    fetchMock.mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () => reject(new Error("aborted")), {
            once: true,
          });
        }),
    );
    const getCatalog = createModelCatalogService();
    const pending = getCatalog();
    await vi.advanceTimersByTimeAsync(MODEL_CATALOG_TIMEOUT);
    expect((await pending).source).toBe("fallback");
    fetchMock.mockResolvedValue(new Response(JSON.stringify(payload)));
    expect((await getCatalog(true)).source).toBe("live");
  });

  it("keeps live models usable when cache persistence fails", async () => {
    mockStorage.local.set.mockRejectedValue(new Error("quota"));
    fetchMock.mockResolvedValue(new Response(JSON.stringify(payload)));
    const getCatalog = createModelCatalogService();
    expect(await getCatalog()).toMatchObject({ source: "live", error: expect.any(String) });
    expect((await getCatalog()).models[0]?.id).toBe("openai/test-chat");
  });
});
