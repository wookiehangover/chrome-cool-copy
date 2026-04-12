import { renderHook, waitFor } from "@testing-library/react";
import type { Clip } from "@repo/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSendMessage = vi.fn();

vi.mock("@repo/shared", () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));

import { useClips } from "./useClips";

describe("useClips", () => {
  beforeEach(() => {
    mockSendMessage.mockReset();
  });

  it("loads clips on mount", async () => {
    const clips = [{ id: "clip-1", title: "Example clip" }] as unknown as Clip[];
    mockSendMessage.mockResolvedValueOnce(clips);

    const { result } = renderHook(() => useClips());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.clips).toEqual(clips);
    expect(mockSendMessage).toHaveBeenCalledWith(
      { action: "getLocalClips" },
      { responseKey: "data" },
    );
  });
});
