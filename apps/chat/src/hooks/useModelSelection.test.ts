import { act, renderHook, waitFor } from "@testing-library/react";
import type { ModelId } from "@repo/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockStorage } from "../test/setup";

const mockSendMessage = vi.fn();

vi.mock("@repo/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@repo/shared")>();
  return {
    ...actual,
    sendMessage: (...args: unknown[]) => mockSendMessage(...args),
  };
});

import { useModelSelection } from "./useModelSelection";

describe("useModelSelection", () => {
  beforeEach(() => {
    mockSendMessage.mockReset();
    mockSendMessage.mockResolvedValue({ success: true });
  });

  it("loads stored model and sends update message when model changes", async () => {
    const storedModel: ModelId = "openai/gpt-5.5";
    const nextModel: ModelId = "google/gemini-3.5-flash";

    mockStorage.sync.get.mockImplementation((_keys, callback) => {
      callback({ aiGatewayConfig: { model: storedModel } });
    });

    const { result } = renderHook(() => useModelSelection());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.selectedModel).toBe(storedModel);

    act(() => {
      result.current.setSelectedModel(nextModel);
    });

    expect(result.current.selectedModel).toBe(nextModel);
    expect(mockSendMessage).toHaveBeenCalledWith({
      action: "updateAIGatewayConfig",
      config: { model: nextModel },
    });
  });

  it("migrates a deprecated stored model to its replacement and persists it", async () => {
    mockStorage.sync.get.mockImplementation((_keys, callback) => {
      callback({ aiGatewayConfig: { model: "anthropic/claude-opus-4.7" } });
    });

    const { result } = renderHook(() => useModelSelection());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.selectedModel).toBe("anthropic/claude-opus-4.8");
    expect(mockSendMessage).toHaveBeenCalledWith({
      action: "updateAIGatewayConfig",
      config: { model: "anthropic/claude-opus-4.8" },
    });
  });

  it("falls back to the default model for unknown stored model IDs", async () => {
    mockStorage.sync.get.mockImplementation((_keys, callback) => {
      callback({ aiGatewayConfig: { model: "acme/legacy-model" } });
    });

    const { result } = renderHook(() => useModelSelection());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.selectedModel).toBe("anthropic/claude-opus-4.8");
  });
});
