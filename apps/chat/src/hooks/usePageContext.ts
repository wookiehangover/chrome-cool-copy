import { useCallback, useEffect, useRef, useState } from "react";
import type { PageContext } from "@repo/shared";

interface UsePageContextReturn {
  pageContext: PageContext | null;
  isLoading: boolean;
  contextError: string | null;
  clearContext: () => void;
}

const ACTIVE_TAB_QUERY: chrome.tabs.QueryInfo = { active: true, lastFocusedWindow: true };

export function usePageContext(): UsePageContextReturn {
  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeTabIdRef = useRef<number | null>(null);

  const fetchPageContext = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    try {
      const [tab] = await chrome.tabs.query(ACTIVE_TAB_QUERY);
      if (!tab?.id || !tab.url) {
        if (requestId === requestIdRef.current) {
          activeTabIdRef.current = tab?.id ?? null;
          setPageContext(null);
          setContextError("Page context is unavailable for this tab.");
        }
        return;
      }

      if (requestId !== requestIdRef.current) return;
      activeTabIdRef.current = tab.id;
      let context: PageContext = { url: tab.url, title: tab.title || tab.url };

      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: "getPageContext" });
        if (response?.success && response.context) {
          context = {
            ...response.context,
            url: response.context.url || tab.url,
            title: response.context.title || tab.title || tab.url,
          };
        }
      } catch {
        // Restricted pages have no content script; tab metadata is still useful context.
      }

      if (requestId === requestIdRef.current) {
        setPageContext(context);
        setContextError(null);
      }
    } catch (error) {
      console.error("Failed to get page context:", error);
      if (requestId === requestIdRef.current) {
        setPageContext(null);
        setContextError("Page context is unavailable for this tab.");
      }
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, []);

  const clearContext = useCallback(() => {
    ++requestIdRef.current;
    setPageContext(null);
    setContextError(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void fetchPageContext();

    // Listen for tab URL changes (navigation)
    const handleTabUpdated = (
      tabId: number,
      changeInfo: Parameters<Parameters<typeof chrome.tabs.onUpdated.addListener>[0]>[1],
    ) => {
      if (
        tabId === activeTabIdRef.current &&
        (changeInfo.url || changeInfo.status === "complete")
      ) {
        setPageContext(null);
        void fetchPageContext();
      }
    };

    // Listen for tab activation (switching tabs)
    const handleTabActivated = ({
      tabId,
    }: Parameters<Parameters<typeof chrome.tabs.onActivated.addListener>[0]>[0]) => {
      activeTabIdRef.current = tabId;
      setPageContext(null);
      void fetchPageContext();
    };

    chrome.tabs.onUpdated.addListener(handleTabUpdated);
    chrome.tabs.onActivated.addListener(handleTabActivated);

    return () => {
      ++requestIdRef.current;
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
      chrome.tabs.onActivated.removeListener(handleTabActivated);
    };
  }, [fetchPageContext]);

  return {
    pageContext,
    isLoading,
    contextError,
    clearContext,
  };
}
