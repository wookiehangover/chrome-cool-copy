import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSendMessage = vi.fn();

import { useClips } from "./useClips";

describe("useClips", () => {
  beforeEach(() => {
    mockSendMessage.mockReset();
  });

  it("loads clips on mount", async () => {
    const clips = [
      {
        id: "clip-1",
        url: "https://example.com",
        title: "Example clip",
        dom_content: "",
        text_content: "Example clip",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        sync_status: "local" as const,
      },
    ];
    mockSendMessage.mockResolvedValueOnce(clips);

    const { result } = renderHook(() => useClips(mockSendMessage));

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
