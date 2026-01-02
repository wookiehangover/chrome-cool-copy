/**
 * Content Fetcher Utility
 * Fetches and extracts readable text content from URLs
 * Uses Chrome extension content script for proper DOM access and JS rendering
 */

import type { PageMetadata } from "./types";

interface FetchResult {
  content: string;
  metadata: PageMetadata;
}

interface FetchError {
  error: string;
}

type FetchContentResult = FetchResult | FetchError;

/**
 * Scraped page response from content script
 */
interface ScrapedPage {
  url: string;
  title: string;
  content: string;
  excerpt: string;
  siteName: string;
  byline: string;
  characterCount: number;
}

/**
 * Normalize a URL for comparison (removes trailing slashes, hash fragments, etc.)
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove hash fragment and trailing slash for comparison
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}${parsed.search}`;
  } catch {
    return url;
  }
}

/**
 * Scrape content from the current active tab
 */
async function scrapeCurrentTab(
  tabId: number,
  options?: { signal?: AbortSignal },
): Promise<FetchContentResult> {
  try {
    // Check if aborted
    if (options?.signal?.aborted) {
      return { error: "Request aborted" };
    }

    // Send message to content script to scrape the page
    const response = await new Promise<{
      success: boolean;
      scrapedPage?: ScrapedPage;
      error?: string;
    }>((resolve) => {
      chrome.tabs.sendMessage(tabId, { action: "scrapePage" }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: chrome.runtime.lastError.message || "Failed to communicate with page",
          });
        } else {
          resolve(response || { success: false, error: "No response from content script" });
        }
      });
    });

    if (!response.success || !response.scrapedPage) {
      return { error: response.error || "Failed to scrape page" };
    }

    const scraped = response.scrapedPage;

    return {
      content: scraped.content,
      metadata: {
        title: scraped.title,
        url: scraped.url,
        excerpt: scraped.excerpt,
        siteName: scraped.siteName,
        byline: scraped.byline,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { error: "Request aborted" };
    }
    return { error: error instanceof Error ? error.message : "Failed to fetch content" };
  }
}

/**
 * Wait for a tab to finish loading
 */
function waitForTabLoad(tabId: number, timeoutMs = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Tab load timeout"));
    }, timeoutMs);

    const listener = (updatedTabId: number, changeInfo: { status?: string }) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        // Give the page a moment to settle after load
        setTimeout(resolve, 500);
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}

/**
 * Scrape content from a URL by opening a tab and using the content script
 * This provides access to JavaScript-rendered content and proper DOM parsing
 */
async function scrapeUrlViaTab(
  url: string,
  options?: { signal?: AbortSignal },
): Promise<FetchContentResult> {
  let tab: chrome.tabs.Tab | undefined;

  try {
    // Create a new tab in the background
    tab = await chrome.tabs.create({
      url,
      active: false, // Don't switch to the new tab
    });

    if (!tab.id) {
      return { error: "Failed to create tab" };
    }

    const tabId = tab.id;

    // Check if aborted
    if (options?.signal?.aborted) {
      await chrome.tabs.remove(tabId);
      return { error: "Request aborted" };
    }

    // Wait for the page to load
    await waitForTabLoad(tabId);

    // Check if aborted after load
    if (options?.signal?.aborted) {
      await chrome.tabs.remove(tabId);
      return { error: "Request aborted" };
    }

    // Send message to content script to scrape the page
    const response = await new Promise<{
      success: boolean;
      scrapedPage?: ScrapedPage;
      error?: string;
    }>((resolve) => {
      chrome.tabs.sendMessage(tabId, { action: "scrapePage" }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: chrome.runtime.lastError.message || "Failed to communicate with page",
          });
        } else {
          resolve(response || { success: false, error: "No response from content script" });
        }
      });
    });

    // Close the tab
    await chrome.tabs.remove(tabId);

    if (!response.success || !response.scrapedPage) {
      return { error: response.error || "Failed to scrape page" };
    }

    const scraped = response.scrapedPage;

    return {
      content: scraped.content,
      metadata: {
        title: scraped.title,
        url: scraped.url,
        excerpt: scraped.excerpt,
        siteName: scraped.siteName,
        byline: scraped.byline,
      },
    };
  } catch (error) {
    // Clean up tab if it was created
    if (tab?.id) {
      try {
        await chrome.tabs.remove(tab.id);
      } catch {
        // Tab may already be closed
      }
    }

    if (error instanceof Error && error.name === "AbortError") {
      return { error: "Request aborted" };
    }
    return { error: error instanceof Error ? error.message : "Failed to fetch content" };
  }
}

/**
 * Fetch content from a URL
 * Uses tab-based scraping for full JavaScript rendering and DOM access
 * If the URL matches the current active tab, scrapes that directly instead of opening a new tab
 */
export async function fetchContent(
  url: string,
  options?: { signal?: AbortSignal },
): Promise<FetchContentResult> {
  try {
    // Validate URL
    const parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return { error: "Only HTTP and HTTPS URLs are supported" };
    }

    // Check if the URL matches the current active tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id && activeTab.url) {
      const normalizedRequestUrl = normalizeUrl(url);
      const normalizedActiveUrl = normalizeUrl(activeTab.url);

      if (normalizedRequestUrl === normalizedActiveUrl) {
        console.log("[Content Fetcher] URL matches active tab, scraping directly");
        return await scrapeCurrentTab(activeTab.id, options);
      }
    }

    console.log("[Content Fetcher] Scraping URL via new tab:", url);
    return await scrapeUrlViaTab(url, options);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { error: "Request aborted" };
    }
    return { error: error instanceof Error ? error.message : "Failed to fetch content" };
  }
}

/**
 * Check if a fetch result is an error
 */
export function isFetchError(result: FetchContentResult): result is FetchError {
  return "error" in result;
}
