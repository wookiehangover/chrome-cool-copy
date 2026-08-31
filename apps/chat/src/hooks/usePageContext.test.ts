import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePageContext } from "./usePageContext";

type UpdatedListener = Parameters<typeof chrome.tabs.onUpdated.addListener>[0];
type ActivatedListener = Parameters<typeof chrome.tabs.onActivated.addListener>[0];
interface PageContextRequest {
  action: string;
}
interface PageContextResponse {
  success: boolean;
  context?: { url: string; title: string };
}

const query =
  vi.fn<
    (
      queryInfo: chrome.tabs.QueryInfo,
    ) => Promise<Array<{ id?: number; url?: string; title?: string }>>
  >();
const sendMessage =
  vi.fn<(tabId: number, message: PageContextRequest) => Promise<PageContextResponse>>();
let updatedListener: UpdatedListener;
let activatedListener: ActivatedListener;

beforeEach(() => {
  query.mockReset();
  sendMessage.mockReset();
  Object.assign(chrome, {
    tabs: {
      query,
      sendMessage,
      onUpdated: {
        addListener: vi.fn((listener: UpdatedListener) => (updatedListener = listener)),
        removeListener: vi.fn(),
      },
      onActivated: {
        addListener: vi.fn((listener: ActivatedListener) => (activatedListener = listener)),
        removeListener: vi.fn(),
      },
    },
  });
});

describe("usePageContext", () => {
  it("loads the active page context on mount", async () => {
    query.mockResolvedValue([{ id: 1, url: "https://example.com", title: "Tab title" }]);
    sendMessage.mockResolvedValue({
      success: true,
      context: { url: "https://example.com/page", title: "Document title" },
    });

    const { result } = renderHook(() => usePageContext());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(query).toHaveBeenCalledWith({ active: true, lastFocusedWindow: true });
    expect(result.current.pageContext).toMatchObject({
      url: "https://example.com/page",
      title: "Document title",
    });
  });

  it("uses tab metadata when the page content script is inaccessible", async () => {
    query.mockResolvedValue([{ id: 2, url: "chrome://settings", title: "Settings" }]);
    sendMessage.mockRejectedValue(new Error("Receiving end does not exist"));

    const { result } = renderHook(() => usePageContext());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.pageContext).toEqual({ url: "chrome://settings", title: "Settings" });
    expect(result.current.contextError).toBeNull();
  });

  it("refreshes on navigation and tab activation without leaking stale context", async () => {
    query
      .mockResolvedValueOnce([{ id: 1, url: "https://one.example", title: "One" }])
      .mockResolvedValueOnce([{ id: 1, url: "https://two.example", title: "Two" }])
      .mockResolvedValueOnce([{ id: 3, url: "https://three.example", title: "Three" }]);
    sendMessage.mockRejectedValue(new Error("no content script"));
    const { result } = renderHook(() => usePageContext());
    await waitFor(() => expect(result.current.pageContext?.title).toBe("One"));

    // SAFETY: The hook only reads the event's tab ID and change info; the tab payload is unused.
    act(() => updatedListener(1, { url: "https://two.example" }, {} as chrome.tabs.Tab));
    expect(result.current.pageContext).toBeNull();
    await waitFor(() => expect(result.current.pageContext?.title).toBe("Two"));

    act(() => activatedListener({ tabId: 3, windowId: 1 }));
    expect(result.current.pageContext).toBeNull();
    await waitFor(() => expect(result.current.pageContext?.title).toBe("Three"));
  });

  it("keeps manually cleared context absent until the page changes", async () => {
    query.mockResolvedValue([{ id: 1, url: "https://example.com", title: "Page" }]);
    sendMessage.mockRejectedValue(new Error("no content script"));
    const { result } = renderHook(() => usePageContext());
    await waitFor(() => expect(result.current.pageContext).not.toBeNull());

    act(() => result.current.clearContext());

    expect(result.current.pageContext).toBeNull();
    expect(result.current.contextError).toBeNull();
  });

  it("reports unavailable context without breaking chat", async () => {
    query.mockResolvedValue([]);
    const { result } = renderHook(() => usePageContext());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.pageContext).toBeNull();
    expect(result.current.contextError).toBe("Page context is unavailable for this tab.");
  });
});
