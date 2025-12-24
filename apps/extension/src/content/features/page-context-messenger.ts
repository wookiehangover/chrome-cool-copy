/**
 * Page Context Messenger
 * Handles communication between content script and side panel
 */

import type { PageContext } from "./page-context.js";

/**
 * Request page context from the content script
 * Used by side panel to get current page information
 */
export async function requestPageContext(): Promise<PageContext | null> {
  try {
    const response = await new Promise<{
      success: boolean;
      context?: PageContext;
      error?: string;
    }>((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]?.id) {
          resolve({ success: false, error: "No active tab found" });
          return;
        }

        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: "getPageContext" },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(
                "[Page Context] Failed to get context:",
                chrome.runtime.lastError.message,
              );
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              resolve(response || { success: false, error: "No response" });
            }
          },
        );
      });
    });

    if (response.success && response.context) {
      return response.context;
    }

    if (response.error) {
      console.error("[Page Context] Error:", response.error);
    }

    return null;
  } catch (error) {
    console.error("[Page Context] Unexpected error:", error);
    return null;
  }
}

/**
 * Set up a persistent connection to the content script for context updates
 * Returns a port that can be used to listen for context changes
 */
export function connectToContentScript(): chrome.runtime.Port | null {
  try {
    const port = chrome.runtime.connect({ name: "page-context-channel" });
    
    port.onDisconnect.addListener(() => {
      console.log("[Page Context] Connection to content script closed");
    });

    return port;
  } catch (error) {
    console.error("[Page Context] Failed to connect to content script:", error);
    return null;
  }
}

/**
 * Listen for page context updates from content script
 * Used when a persistent connection is established
 */
export function onPageContextUpdate(
  callback: (context: PageContext) => void,
): chrome.runtime.Port | null {
  const port = connectToContentScript();

  if (port) {
    port.onMessage.addListener((message) => {
      if (message.action === "pageContextUpdate" && message.context) {
        callback(message.context);
      }
    });
  }

  return port;
}

/**
 * Send page context update from content script to side panel
 * Used by content script to notify side panel of context changes
 */
export function broadcastPageContextUpdate(context: PageContext): void {
  try {
    chrome.runtime.sendMessage(
      {
        action: "pageContextUpdate",
        context,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "[Page Context] Failed to broadcast update:",
            chrome.runtime.lastError.message,
          );
        }
      },
    );
  } catch (error) {
    console.error("[Page Context] Error broadcasting update:", error);
  }
}

