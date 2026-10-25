import { act, renderHook, waitFor } from "@testing-library/react";
import {
  DEFAULT_MODEL,
  MODEL_MIGRATION_MAP,
  SUPPORTED_MODELS,
  type ModelCatalogResult,
} from "@repo/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockStorage } from "../test/setup";
import { useModelSelection } from "./useModelSelection";

const mockSendMessage = vi.fn();
const live: ModelCatalogResult = { source: "live", models: SUPPORTED_MODELS };

function storeModel(model: string) {
  mockStorage.sync.get.mockImplementation((_keys, callback) =>
    callback({ aiGatewayConfig: { model } }),
  );
}

describe("useModelSelection", () => {
  beforeEach(() => {
    mockSendMessage.mockReset();
    mockSendMessage.mockResolvedValue(live);
  });

  it("loads a saved model and persists a new dynamic choice", async () => {
    storeModel("anthropic/claude-fable-5");
    const { result } = renderHook(() => useModelSelection(mockSendMessage));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.selectedModel).toBe("anthropic/claude-fable-5");
    act(() => result.current.setSelectedModel("new-lab/new-model"));
    expect(result.current.selectedModel).toBe("new-lab/new-model");
    expect(mockSendMessage).toHaveBeenCalledWith({
      action: "updateAIGatewayConfig",
      config: { model: "new-lab/new-model" },
    });
  });

  it.each(Object.entries(MODEL_MIGRATION_MAP))(
    "migrates retired alias %s to %s with a live catalog",
    async (legacy, replacement) => {
      storeModel(legacy);
      const { result } = renderHook(() => useModelSelection(mockSendMessage));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.selectedModel).toBe(replacement);
      expect(mockSendMessage).toHaveBeenCalledWith({
        action: "updateAIGatewayConfig",
        config: { model: replacement },
      });
    },
  );

  it("preserves an exact catalog match before considering an alias", async () => {
    storeModel("openai/gpt-4o");
    mockSendMessage.mockResolvedValue({
      source: "live",
      models: [{ id: "openai/gpt-4o", displayName: "GPT-4o", provider: "OpenAI" }],
    });
    const { result } = renderHook(() => useModelSelection(mockSendMessage));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.selectedModel).toBe("openai/gpt-4o");
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  it("preserves unknown saved IDs without persisting a fallback", async () => {
    storeModel("acme/new-model");
    const { result } = renderHook(() => useModelSelection(mockSendMessage));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.selectedModel).toBe("acme/new-model");
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  it.each(["cache", "fallback"])(
    "does not migrate legacy choices using a %s catalog",
    async (source) => {
      storeModel("openai/gpt-4o");
      mockSendMessage.mockResolvedValue({ ...live, source });
      const { result } = renderHook(() => useModelSelection(mockSendMessage));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.selectedModel).toBe("openai/gpt-4o");
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    },
  );

  it("preserves the saved model when discovery fails", async () => {
    storeModel("openai/gpt-4o");
    mockSendMessage.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useModelSelection(mockSendMessage));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.selectedModel).toBe("openai/gpt-4o");
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  it("uses the default for an invalid saved ID even when discovery fails without persisting it", async () => {
    storeModel("invalid-unqualified-model");
    mockSendMessage.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useModelSelection(mockSendMessage));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.selectedModel).toBe(DEFAULT_MODEL);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  it("does not overwrite a user choice when catalog discovery finishes later", async () => {
    storeModel("openai/gpt-4o");
    let finish = (_catalog: ModelCatalogResult) => {};
    mockSendMessage.mockImplementationOnce(
      () =>
        new Promise<ModelCatalogResult>((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(() => useModelSelection(mockSendMessage));
    await waitFor(() => expect(result.current.selectedModel).toBe("openai/gpt-4o"));
    act(() => result.current.setSelectedModel("acme/new-model"));
    await act(async () => finish(live));
    expect(result.current.selectedModel).toBe("acme/new-model");
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
  });
});
