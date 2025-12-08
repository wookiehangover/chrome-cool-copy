/**
 * Content Script Entry Point
 * Handles message listener for background script communication
 */

import { handleCopyCleanUrl } from './url-cleaner.js';
import { handleCopyMarkdownLink } from './markdown.js';
import { startElementPicker } from './element-picker.js';

/**
 * Message type for communication with background script
 */
interface ContentMessage {
  action: string;
  x?: number;
  y?: number;
  [key: string]: unknown;
}

/**
 * Response type for message handlers
 */
interface MessageResponse {
  success: boolean;
  error?: string;
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(
  (
    message: ContentMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ): boolean => {
    try {
      if (message.action === "copyCleanUrl") {
        handleCopyCleanUrl()
          .then(() => {
            sendResponse({ success: true });
          })
          .catch((error: Error) => {
            console.error("[Clean Link Copy] Error in copyCleanUrl:", error);
            sendResponse({ success: false, error: error.message });
          });
      } else if (message.action === "copyMarkdownLink") {
        handleCopyMarkdownLink()
          .then(() => {
            sendResponse({ success: true });
          })
          .catch((error: Error) => {
            console.error("[Clean Link Copy] Error in copyMarkdownLink:", error);
            sendResponse({ success: false, error: error.message });
          });
      } else if (message.action === "startElementPicker") {
        try {
          startElementPicker();
          sendResponse({ success: true });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error("[Clean Link Copy] Error in startElementPicker:", error);
          sendResponse({ success: false, error: errorMessage });
        }
      } else if (message.action === "scrollTo") {
        // Handle scroll request from background script for full page capture
        try {
          const x = message.x ?? 0;
          const y = message.y ?? 0;
          window.scrollTo(x, y);
          sendResponse({ success: true });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error("[Clean Link Copy] Error in scrollTo:", error);
          sendResponse({ success: false, error: errorMessage });
        }
      } else {
        console.warn("[Clean Link Copy] Unknown message action:", message.action);
        sendResponse({ success: false, error: "Unknown action" });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        "[Clean Link Copy] Unexpected error in message listener:",
        error,
      );
      sendResponse({ success: false, error: errorMessage });
    }
    return true; // Keep the message channel open for async response
  }
);

