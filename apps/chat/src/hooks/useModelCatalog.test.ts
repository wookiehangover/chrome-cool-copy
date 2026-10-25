import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MODEL_CATALOG_CACHE_KEY, type ModelCatalogResult } from "@repo/shared";
import { mockRuntime, mockStorage } from "../test/setup";
import { useModelCatalog } from "./useModelCatalog";

const live: ModelCatalogResult = {
  source: "live",
  fetchedAt: 123,
  models: [{ id: "lab/model", displayName: "Model", provider: "Lab" }],
};

describe("useModelCatalog", () => {
  it("reloads after a local catalog change and removes the listener on unmount", async () => {
    mockRuntime.sendMessage.mockImplementationOnce((_message, callback) =>
      callback({ ...live, source: "cache" }),
    );
    const { result, unmount } = renderHook(() => useModelCatalog());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const listener = mockStorage.onChanged.addListener.mock.calls[0]?.[0];
    expect(listener).toBeDefined();
    act(() => {
      listener?.({ unrelated: { newValue: true } }, "local");
      listener?.({ [MODEL_CATALOG_CACHE_KEY]: { newValue: true } }, "sync");
    });
    expect(mockRuntime.sendMessage).toHaveBeenCalledTimes(1);
    mockRuntime.sendMessage.mockImplementationOnce((_message, callback) => callback(live));
    await act(async () => {
      listener?.({ [MODEL_CATALOG_CACHE_KEY]: { newValue: true } }, "local");
    });
    expect(result.current.source).toBe("live");
    expect(mockRuntime.sendMessage).toHaveBeenLastCalledWith(
      { action: "getModelCatalog", refresh: false },
      expect.any(Function),
    );
    unmount();
    expect(mockStorage.onChanged.removeListener).toHaveBeenCalledWith(listener);
  });

  it.each([undefined, { source: "live", models: [] }, { success: true }])(
    "retains bundled models when discovery returns an unusable response: %j",
    async (response) => {
      mockRuntime.sendMessage.mockImplementationOnce((_message, callback) => callback(response));
      const { result } = renderHook(() => useModelCatalog());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.error).toBe("The model catalog was empty. Please try again.");
      expect(result.current.source).toBe("fallback");
      expect(result.current.models.length).toBeGreaterThan(0);
    },
  );

  it("shows loading until discovery returns the catalog", async () => {
    let finish = (_result: ModelCatalogResult) => {};
    mockRuntime.sendMessage.mockImplementation((_message, callback) => {
      finish = callback;
    });
    const { result } = renderHook(() => useModelCatalog());
    expect(result.current.isLoading).toBe(true);
    await act(async () => finish(live));
    expect(result.current.models).toEqual(live.models);
    expect(result.current.isLoading).toBe(false);
  });

  it("keeps bundled models after failure and retries with refresh", async () => {
    mockRuntime.sendMessage.mockImplementationOnce((_message, callback) =>
      callback({ success: false, error: "Offline" }),
    );
    const { result } = renderHook(() => useModelCatalog());
    await waitFor(() => expect(result.current.error).toBe("Offline"));
    expect(result.current.models.length).toBeGreaterThan(0);
    mockRuntime.sendMessage.mockImplementationOnce((_message, callback) => callback(live));
    await act(async () => {
      await result.current.retry();
    });
    expect(mockRuntime.sendMessage).toHaveBeenLastCalledWith(
      { action: "getModelCatalog", refresh: true },
      expect.any(Function),
    );
    expect(result.current.models).toEqual(live.models);
    expect(result.current.error).toBeUndefined();
  });

  it("retains a loaded catalog when refresh fails", async () => {
    mockRuntime.sendMessage.mockImplementationOnce((_message, callback) => callback(live));
    const { result } = renderHook(() => useModelCatalog());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mockRuntime.sendMessage.mockImplementationOnce((_message, callback) =>
      callback({ success: false, error: "Offline" }),
    );
    await act(async () => {
      await result.current.retry();
    });
    expect(result.current.models).toEqual(live.models);
    expect(result.current.error).toBe("Offline");
  });
});
