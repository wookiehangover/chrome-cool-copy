import { useEffect, useState, useCallback } from "react";
import type { PageContext } from "@repo/shared";

interface UsePageContextReturn {
  pageContext: PageContext | null;
  isLoading: boolean;
  clearContext: () => void;
}

export function usePageContext(): UsePageContextReturn {
  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPageContext = useCallback(async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && tab.url) {
        const response = await chrome.tabs.sendMessage(tab.id, { action: "getPageContext" });
        if (response?.success && response.context) {
          setPageContext({
            url: response.context.url || tab.url,
            title: response.context.title || tab.title || "",
          });
        } else {
          setPageContext({
            url: tab.url,
            title: tab.title || "",
          });
        }
      }
    } catch (err) {
      console.error("Failed to get page context:", err);
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url) {
          setPageContext({
            url: tab.url,
            title: tab.title || "",
          });
        }
      } catch {
        // ignore
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearContext = useCallback(() => {
    setPageContext(null);
  }, []);

  useEffect(() => {
    fetchPageContext();

    // Listen for tab URL changes (navigation)
    const handleTabUpdated = (
      _tabId: number,
      changeInfo: { status?: string },
      tab: { active?: boolean },
    ) => {
      if (changeInfo.status === "complete" && tab.active) {
        fetchPageContext();
      }
    };

    // Listen for tab activation (switching tabs)
    const handleTabActivated = () => {
      fetchPageContext();
    };

    chrome.tabs.onUpdated.addListener(handleTabUpdated);
    chrome.tabs.onActivated.addListener(handleTabActivated);

    return () => {
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
      chrome.tabs.onActivated.removeListener(handleTabActivated);
    };
  }, [fetchPageContext]);

  return {
    pageContext,
    isLoading,
    clearContext,
  };
}
