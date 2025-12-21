/**
 * Content Script Entry Point
 * Handles message listener for background script communication
 */

import { handleCopyCleanUrl } from "./features/url-cleaner.js";
import { handleCopyMarkdownLink } from "./features/markdown.js";
import { startElementPicker } from "./features/element-picker.js";
import { showToast } from "./toast.js";
import { openCommandPalette, registerCommands } from "./command-palette.js";
import { commandRegistry } from "./commands.js";
import { initializeDarkMode } from "./features/dark-mode-manager.js";

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
    sendResponse: (response: MessageResponse) => void,
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
      } else if (message.action === "openCommandPalette") {
        // Handle command palette open request
        try {
          openCommandPalette();
          sendResponse({ success: true });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error("[Clean Link Copy] Error in openCommandPalette:", error);
          sendResponse({ success: false, error: errorMessage });
        }
      } else if (message.action === "clipPage") {
        // Handle clip page request - collect page data and send to background
        try {
          // Collect page data
          const pageData = {
            url: window.location.href,
            title: document.title,
            domContent: document.documentElement.outerHTML,
            textContent: document.body.innerText || "",
            metadata: {
              description:
                document.querySelector('meta[name="description"]')?.getAttribute("content") || "",
              keywords:
                document.querySelector('meta[name="keywords"]')?.getAttribute("content") || "",
              author: document.querySelector('meta[name="author"]')?.getAttribute("content") || "",
              ogTitle:
                document.querySelector('meta[property="og:title"]')?.getAttribute("content") || "",
              ogDescription:
                document
                  .querySelector('meta[property="og:description"]')
                  ?.getAttribute("content") || "",
              ogImage:
                document.querySelector('meta[property="og:image"]')?.getAttribute("content") || "",
            },
          };

          // Send page data to background script for database storage
          chrome.runtime.sendMessage(
            {
              action: "savePageToDatabase",
              ...pageData,
            },
            (response) => {
              if (chrome.runtime.lastError) {
                console.error(
                  "[Clean Link Copy] Failed to send clipPage message:",
                  chrome.runtime.lastError.message,
                );
                showToast("Error: Failed to clip page");
                return;
              }

              if (response && response.success) {
                console.log("[Clean Link Copy] Page clipped successfully");
                showToast("Page clipped successfully!");
              } else {
                const errorMsg = response?.error || "Unknown error";
                console.error("[Clean Link Copy] Failed to clip page:", errorMsg);
                showToast("Error: " + errorMsg);
              }
            },
          );

          sendResponse({ success: true });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error("[Clean Link Copy] Error in clipPage:", error);
          showToast("Error: " + errorMessage);
          sendResponse({ success: false, error: errorMessage });
        }
      } else {
        console.warn("[Clean Link Copy] Unknown message action:", message.action);
        sendResponse({ success: false, error: "Unknown action" });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[Clean Link Copy] Unexpected error in message listener:", error);
      sendResponse({ success: false, error: errorMessage });
    }
    return true; // Keep the message channel open for async response
  },
);

/**
 * Initialize command palette with available commands from the registry
 */
function initializeCommandPalette(): void {
  registerCommands(commandRegistry);
}

/**
 * Initialize dark mode feature
 */
async function initializeDarkModeFeature(): Promise<void> {
  try {
    await initializeDarkMode();
  } catch (error) {
    console.error("[Dark Mode] Initialization failed:", error);
  }
}

// Initialize command palette when content script loads
initializeCommandPalette();

// Initialize dark mode feature
initializeDarkModeFeature();
