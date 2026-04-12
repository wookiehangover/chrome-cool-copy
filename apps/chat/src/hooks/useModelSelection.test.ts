import { act, renderHook, waitFor } from "@testing-library/react";
import type { ModelId } from "@repo/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockStorage } from "../test/setup";

const mockSendMessage = vi.fn();

vi.mock("@repo/shared", () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));

import { useModelSelection } from "./useModelSelection";

describe("useModelSelection", () => {
  beforeEach(() => {
    mockSendMessage.mockReset();
    mockSendMessage.mockResolvedValue({ success: true });
  });

  it("loads stored model and sends update message when model changes", async () => {
    const storedModel: ModelId = "openai/gpt-5.2";
    const nextModel: ModelId = "google/gemini-3-flash";

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
});
