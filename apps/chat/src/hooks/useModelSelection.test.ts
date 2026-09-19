import { act, renderHook, waitFor } from "@testing-library/react";
import { MODEL_MIGRATION_MAP, type ModelId } from "@repo/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockStorage } from "../test/setup";

const mockSendMessage = vi.fn();

import { useModelSelection } from "./useModelSelection";

describe("useModelSelection", () => {
  beforeEach(() => {
    mockSendMessage.mockReset();
    mockSendMessage.mockResolvedValue({ success: true });
  });

  it("loads stored model and sends update message when model changes", async () => {
    const storedModel: ModelId = "anthropic/claude-fable-5";
    const nextModel: ModelId = "openai/gpt-6-astra";

    mockStorage.sync.get.mockImplementation((_keys, callback) => {
      callback({ aiGatewayConfig: { model: storedModel } });
    });

    const { result } = renderHook(() => useModelSelection(mockSendMessage));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.selectedModel).toBe(storedModel);
    expect(mockSendMessage).not.toHaveBeenCalled();

    act(() => {
      result.current.setSelectedModel(nextModel);
    });

    expect(result.current.selectedModel).toBe(nextModel);
    expect(mockSendMessage).toHaveBeenCalledWith({
      action: "updateAIGatewayConfig",
      config: { model: nextModel },
    });
  });

  it.each(Object.entries(MODEL_MIGRATION_MAP))(
    "migrates %s to %s and persists it",
    async (legacyModel, replacement) => {
      mockStorage.sync.get.mockImplementation((_keys, callback) => {
        callback({ aiGatewayConfig: { model: legacyModel } });
      });

      const { result } = renderHook(() => useModelSelection(mockSendMessage));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.selectedModel).toBe(replacement);
      expect(mockSendMessage).toHaveBeenCalledWith({
        action: "updateAIGatewayConfig",
        config: { model: replacement },
      });
    },
  );

  it("falls back to the default model for unknown stored model IDs", async () => {
    mockStorage.sync.get.mockImplementation((_keys, callback) => {
      callback({ aiGatewayConfig: { model: "acme/legacy-model" } });
    });

    const { result } = renderHook(() => useModelSelection(mockSendMessage));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.selectedModel).toBe("openai/gpt-5.6-sol");
    expect(mockSendMessage).toHaveBeenCalledWith({
      action: "updateAIGatewayConfig",
      config: { model: "openai/gpt-5.6-sol" },
    });
  });
});
