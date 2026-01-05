// Background service worker for handling keyboard shortcuts

// Polyfill process.env for Vercel AI SDK (required in Chrome extension context)
declare const process: { env: Record<string, string | undefined> } | undefined;
if (typeof process === "undefined") {
  (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process = {
    env: {},
  };
}

import { streamText, generateText, createGateway, stepCountIs } from "ai";
import { tools } from "./tools/browse";
import { boostTools } from "./tools/boost-tools";
import { boostSystemPrompt } from "./tools/boost-system-prompt";
import {
  saveLocalClip,
  isUrlClipped,
  addHighlight,
  updateHighlightNote,
  deleteHighlight,
  updateLocalClip,
} from "./services/local-clips";
import { syncClipToAgentDB, isAgentDBConfigured } from "./services/clips-sync";
import {
  getBoosts,
  toggleBoost,
  deleteBoost,
  getBoostsForDomain,
  saveBoost,
} from "./services/boosts";
import type {
  GenerateTextRequest,
  StreamTextRequest,
  GenerateTextResponse,
  StreamMessageType,
} from "@repo/shared";
import type { ConsoleEntry } from "./content/features/console-capture";

/**
 * Vercel AI Gateway configuration
 */
interface VercelAIGatewayConfig {
  apiKey: string;
  model: string;
}

/**
 * In-memory draft state for boost code per tab
 */
const boostDrafts = new Map<number, string>();

/**
 * Send a message to the content script with error handling
 */
function sendMessageToTab(tabId: number, message: { action: string }): void {
  chrome.tabs.sendMessage(tabId, message, (response: { success?: boolean } | undefined) => {
    // Check for errors
    if (chrome.runtime.lastError) {
      console.error("[Clean Link Copy] Failed to send message:", chrome.runtime.lastError.message);
      // Silently fail - the user will see the error in the content script if it's available
      return;
    }

    // Log successful response
    if (response && response.success) {
      console.log("[Clean Link Copy] Message sent successfully:", message.action);
    }
  });
}

interface ElementBounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Capture the visible tab and crop to element bounds
 */
async function captureAndCropImage(bounds: ElementBounds, devicePixelRatio = 1): Promise<string> {
  try {
    // Get the active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tabs || tabs.length === 0) {
      throw new Error("No active tab found");
    }

    const tab = tabs[0];

    // Capture the visible tab as PNG
    const screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
    });

    // Convert data URL to blob, then create ImageBitmap (service workers don't have Image)
    const screenshotResponse = await fetch(screenshotDataUrl);
    const screenshotBlob = await screenshotResponse.blob();
    const image = await createImageBitmap(screenshotBlob);

    // Scale bounds by devicePixelRatio since captureVisibleTab captures at native resolution
    const scaledBounds = {
      left: Math.round(bounds.left * devicePixelRatio),
      top: Math.round(bounds.top * devicePixelRatio),
      width: Math.round(bounds.width * devicePixelRatio),
      height: Math.round(bounds.height * devicePixelRatio),
    };

    console.log(
      "[Clean Link Copy] Screenshot captured (" +
        image.width +
        "x" +
        image.height +
        "), cropping with devicePixelRatio:",
      devicePixelRatio,
      "scaledBounds:",
      scaledBounds,
    );

    // Clamp bounds to image dimensions to avoid drawing outside the image
    const clampedBounds = {
      left: Math.max(0, Math.min(scaledBounds.left, image.width)),
      top: Math.max(0, Math.min(scaledBounds.top, image.height)),
      width: Math.min(scaledBounds.width, image.width - Math.max(0, scaledBounds.left)),
      height: Math.min(scaledBounds.height, image.height - Math.max(0, scaledBounds.top)),
    };

    // Create an offscreen canvas for cropping at the scaled size
    const canvas = new OffscreenCanvas(clampedBounds.width, clampedBounds.height);
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Failed to get canvas context");
    }

    // Draw the cropped region from the screenshot
    ctx.drawImage(
      image,
      clampedBounds.left, // source x
      clampedBounds.top, // source y
      clampedBounds.width, // source width
      clampedBounds.height, // source height
      0, // destination x
      0, // destination y
      clampedBounds.width, // destination width
      clampedBounds.height, // destination height
    );

    // Convert canvas to blob and then to data URL
    const blob = await canvas.convertToBlob({ type: "image/png" });

    // Convert blob to data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read blob"));
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("[Clean Link Copy] Error capturing and cropping image:", error);
    throw error;
  }
}

interface PageInfo {
  scrollWidth: number;
  scrollHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  originalScrollX: number;
  originalScrollY: number;
}

/**
 * Capture the entire page by scrolling and stitching screenshots
 * Uses rate limiting to avoid exceeding MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND
 */
async function captureEntirePage(tabId: number, pageInfo: PageInfo): Promise<string> {
  const { scrollWidth, scrollHeight, viewportWidth, viewportHeight, devicePixelRatio } = pageInfo;

  // Rate limit: Chrome allows ~2 captureVisibleTab calls per second
  // Use 600ms delay to stay safely under the limit
  const CAPTURE_DELAY_MS = 600;

  console.log(
    "[Clean Link Copy] Capturing entire page:",
    scrollWidth + "x" + scrollHeight,
    "viewport:",
    viewportWidth + "x" + viewportHeight,
    "dpr:",
    devicePixelRatio,
  );

  // Get the active tab's window
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || tabs.length === 0) {
    throw new Error("No active tab found");
  }
  const tab = tabs[0];

  // Calculate how many screenshots we need
  const cols = Math.ceil(scrollWidth / viewportWidth);
  const rows = Math.ceil(scrollHeight / viewportHeight);
  const totalCaptures = cols * rows;

  console.log("[Clean Link Copy] Will capture", cols, "x", rows, "=", totalCaptures, "screenshots");

  // Create the final canvas at full page size (scaled by devicePixelRatio)
  const finalWidth = Math.round(scrollWidth * devicePixelRatio);
  const finalHeight = Math.round(scrollHeight * devicePixelRatio);

  const finalCanvas = new OffscreenCanvas(finalWidth, finalHeight);
  const finalCtx = finalCanvas.getContext("2d");

  if (!finalCtx) {
    throw new Error("Failed to get canvas context");
  }

  // Fill with white background
  finalCtx.fillStyle = "#ffffff";
  finalCtx.fillRect(0, 0, finalWidth, finalHeight);

  // Capture each section with rate limiting
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const scrollX = col * viewportWidth;
      const scrollY = row * viewportHeight;

      // Tell content script to scroll to position
      await chrome.tabs.sendMessage(tabId, {
        action: "scrollTo",
        x: scrollX,
        y: scrollY,
      });

      // Wait for scroll and render to complete
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Capture the visible viewport
      const screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: "png",
      });

      // Convert to ImageBitmap
      const response = await fetch(screenshotDataUrl);
      const blob = await response.blob();
      const image = await createImageBitmap(blob);

      // Calculate where to draw this piece
      const destX = Math.round(scrollX * devicePixelRatio);
      const destY = Math.round(scrollY * devicePixelRatio);

      // Calculate how much of this screenshot to use (handle edge cases)
      const remainingWidth = scrollWidth - scrollX;
      const remainingHeight = scrollHeight - scrollY;
      const srcWidth = Math.min(image.width, Math.round(remainingWidth * devicePixelRatio));
      const srcHeight = Math.min(image.height, Math.round(remainingHeight * devicePixelRatio));

      // Draw this piece onto the final canvas
      finalCtx.drawImage(
        image,
        0,
        0, // source x, y
        srcWidth,
        srcHeight, // source width, height
        destX,
        destY, // destination x, y
        srcWidth,
        srcHeight, // destination width, height
      );

      const captureNum = row * cols + col + 1;
      console.log(
        "[Clean Link Copy] Captured section",
        captureNum,
        "/",
        totalCaptures,
        "at scroll",
        scrollX + "," + scrollY,
      );

      // Rate limit: wait before next capture (skip delay on last capture)
      if (captureNum < totalCaptures) {
        await new Promise((resolve) => setTimeout(resolve, CAPTURE_DELAY_MS));
      }
    }
  }

  // Convert final canvas to data URL
  const blob = await finalCanvas.convertToBlob({ type: "image/png" });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

chrome.commands.onCommand.addListener((command) => {
  // Get the active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    // Handle query errors
    if (chrome.runtime.lastError) {
      console.error("[Clean Link Copy] Failed to query tabs:", chrome.runtime.lastError.message);
      return;
    }

    if (tabs.length === 0) {
      console.warn("[Clean Link Copy] No active tab found");
      return;
    }

    const tab = tabs[0];
    if (tab.id === undefined) {
      console.warn("[Clean Link Copy] Tab ID is undefined");
      return;
    }

    // Send message to content script based on the command
    if (command === "copy-clean-url") {
      sendMessageToTab(tab.id, { action: "copyCleanUrl" });
    } else if (command === "copy-markdown-link") {
      sendMessageToTab(tab.id, { action: "copyMarkdownLink" });
    } else if (command === "open-command-palette") {
      sendMessageToTab(tab.id, { action: "openCommandPalette" });
    } else if (command === "reader-mode") {
      sendMessageToTab(tab.id, { action: "toggleReaderMode" });
    } else if (command === "open-chat") {
      // Open the side panel for chat
      chrome.sidePanel.open({ tabId: tab.id }, () => {
        if (chrome.runtime.lastError) {
          console.error("[Side Panel] Error opening side panel:", chrome.runtime.lastError);
        } else {
          console.log("[Side Panel] Side panel opened via keyboard shortcut for tab", tab.id);
        }
      });
    }
  });
});

/**
 * Check if a Grokipedia page exists for an article title
 * @param {string} articleTitle - The Wikipedia article title
 * @returns {Promise<boolean>} - True if the page exists
 */
async function checkGrokipediaExists(articleTitle: string): Promise<boolean> {
  const GROKIPEDIA_BASE_URL = "https://grokipedia.com/page";
  const encodedTitle = encodeURIComponent(articleTitle.trim());
  const url = `${GROKIPEDIA_BASE_URL}/${encodedTitle}`;

  try {
    const response = await fetch(url, {
      method: "HEAD",
      cache: "no-store",
    });
    return response.ok;
  } catch (error) {
    console.error(`[Grokipedia] Error checking page for "${articleTitle}":`, error);
    return false;
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.action === "checkGrokipediaExists") {
      // Handle Grokipedia existence check
      checkGrokipediaExists(message.articleTitle)
        .then((exists) => {
          sendResponse({ success: true, exists });
        })
        .catch((error) => {
          console.error("[Grokipedia] Error in checkGrokipediaExists handler:", error);
          sendResponse({ success: false, exists: false, error: error.message });
        });
      return true;
    } else if (message.action === "captureElement") {
      // Handle element capture request
      captureAndCropImage(message.bounds, message.devicePixelRatio || 1)
        .then((imageData) => {
          sendResponse({
            success: true,
            imageData: imageData,
          });
        })
        .catch((error) => {
          console.error("[Clean Link Copy] Error in captureElement handler:", error);
          sendResponse({
            success: false,
            error: error.message,
          });
        });

      // Return true to indicate we'll send response asynchronously
      return true;
    } else if (message.action === "captureFullPage") {
      // Handle full page capture request by scrolling and stitching with rate limiting
      const tabId = sender.tab?.id;
      if (tabId === undefined) {
        sendResponse({ success: false, error: "No tab ID available" });
        return true;
      }
      captureEntirePage(tabId, message.pageInfo)
        .then((imageData) => {
          // Restore original scroll position
          chrome.tabs.sendMessage(tabId, {
            action: "scrollTo",
            x: message.pageInfo.originalScrollX,
            y: message.pageInfo.originalScrollY,
          });
          sendResponse({
            success: true,
            imageData: imageData,
          });
        })
        .catch((error: unknown) => {
          console.error("[Clean Link Copy] Error in captureFullPage handler:", error);
          // Try to restore scroll position even on error
          chrome.tabs.sendMessage(tabId, {
            action: "scrollTo",
            x: message.pageInfo.originalScrollX,
            y: message.pageInfo.originalScrollY,
          });
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        });

      // Return true to indicate we'll send response asynchronously
      return true;
    } else if (message.action === "savePageToDatabase") {
      // Handle page clip request - local-first storage with optional AgentDB sync
      (async () => {
        try {
          // Save locally first (always works)
          const clipInput = {
            url: message.url,
            title: message.title,
            dom_content: message.domContent,
            text_content: message.textContent,
            metadata: message.metadata || {},
          };

          const savedClip = await saveLocalClip(clipInput);
          console.log("[Clean Link Copy] Clip saved locally:", savedClip.id);

          // Try to sync to AgentDB if configured (non-blocking)
          const agentdbConfigured = await isAgentDBConfigured();
          if (agentdbConfigured) {
            // Sync in background - don't block the response
            syncClipToAgentDB(savedClip).catch((error) => {
              console.warn(
                "[Clean Link Copy] AgentDB sync failed (clip still saved locally):",
                error,
              );
            });
          }

          sendResponse({
            success: true,
            message: agentdbConfigured
              ? "Page clipped successfully (syncing to AgentDB)"
              : "Page clipped successfully (stored locally)",
            clipId: savedClip.id,
          });
        } catch (error) {
          console.error("[Clean Link Copy] Error saving page:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();

      // Return true to indicate we'll send response asynchronously
      return true;
    } else if (message.action === "checkExistingClip") {
      // Check if URL is already clipped
      (async () => {
        try {
          const existingClip = await isUrlClipped(message.url);
          sendResponse({
            success: true,
            clip: existingClip,
          });
        } catch (error) {
          console.error("[Clean Link Copy] Error checking clip:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    } else if (message.action === "addHighlight") {
      // Add highlight to a clip
      (async () => {
        try {
          const highlight = await addHighlight(message.clipId, message.highlight);
          sendResponse({
            success: true,
            highlight,
          });
        } catch (error) {
          console.error("[Clean Link Copy] Error adding highlight:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    } else if (message.action === "updateHighlightNote") {
      // Update highlight note
      (async () => {
        try {
          await updateHighlightNote(message.clipId, message.highlightId, message.note);
          sendResponse({ success: true });
        } catch (error) {
          console.error("[Clean Link Copy] Error updating highlight:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    } else if (message.action === "deleteHighlight") {
      // Delete highlight from a clip
      (async () => {
        try {
          await deleteHighlight(message.clipId, message.highlightId);
          sendResponse({ success: true });
        } catch (error) {
          console.error("[Clean Link Copy] Error deleting highlight:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    } else if (message.action === "updateClipContent") {
      // Update clip content (from reader mode edit)
      (async () => {
        try {
          const result = await updateLocalClip(message.clipId, {
            dom_content: message.domContent,
            text_content: message.textContent,
          });
          if (result) {
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: "Clip not found" });
          }
        } catch (error) {
          console.error("[Clean Link Copy] Error updating clip content:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    } else if (message.action === "openClipViewer") {
      // Open clip viewer in a new tab
      const viewerUrl = chrome.runtime.getURL(
        `pages/clip-viewer.html?id=${encodeURIComponent(message.clipId)}`,
      );
      chrome.tabs.create({ url: viewerUrl });
      return false;
    } else if (message.action === "boostFile") {
      // Handle boost file storage - store code in draft state
      const tabId = sender.tab?.id;
      if (tabId === undefined) {
        sendResponse({ success: false, error: "No tab ID available" });
        return false;
      }

      try {
        const { content } = message;
        if (typeof content !== "string") {
          throw new Error("Content must be a string");
        }

        boostDrafts.set(tabId, content);
        console.log("[Boosts] Stored draft for tab", tabId, `(${content.length} bytes)`);

        sendResponse({
          success: true,
          message: `Boost code updated (${content.length} bytes)`,
        });
      } catch (error) {
        console.error("[Boosts] Error in boostFile handler:", error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return false;
    } else if (message.action === "executeBoost") {
      // Handle boost execution - inject code into page context
      const tabId = sender.tab?.id;
      if (tabId === undefined) {
        sendResponse({ success: false, error: "No tab ID available" });
        return false;
      }

      (async () => {
        try {
          const code = boostDrafts.get(tabId);
          if (!code) {
            throw new Error("No boost code stored for this tab");
          }

          // Execute the code in the page context (MAIN world, not isolated)
          const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: (boostCode: string) => {
              try {
                // eslint-disable-next-line no-eval
                eval(boostCode);
                return { success: true, result: "Boost executed successfully" };
              } catch (error) {
                return {
                  success: false,
                  error: error instanceof Error ? error.message : String(error),
                };
              }
            },
            args: [code],
            world: "MAIN",
          });

          const result = results[0]?.result;
          if (result && typeof result === "object" && "success" in result) {
            sendResponse(result);
          } else {
            sendResponse({ success: true, result: "Boost executed successfully" });
          }
        } catch (error) {
          console.error("[Boosts] Error in executeBoost handler:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    } else if (message.action === "readConsole") {
      // Get active tab and send message to content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id;
        if (!tabId) {
          sendResponse({
            success: false,
            error: "No active tab found",
          });
          return;
        }

        const lines = typeof message.lines === "number" ? message.lines : 20;

        chrome.tabs.sendMessage(tabId, { action: "readConsole", lines }, (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({
              success: false,
              error: chrome.runtime.lastError.message,
            });
            return;
          }
          sendResponse(response);
        });
      });
      return true; // Keep channel open for async response
    } else if (message.action === "getBoosts") {
      // Handle boost list request from chat app
      (async () => {
        try {
          const boosts = await getBoosts();
          sendResponse({ success: true, data: boosts });
        } catch (error) {
          console.error("[Boosts] Error in getBoosts handler:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    } else if (message.action === "toggleBoost") {
      // Handle boost toggle request
      (async () => {
        try {
          const { id } = message;
          if (!id) {
            throw new Error("Boost ID is required");
          }
          const boost = await toggleBoost(id);
          sendResponse({ success: true, data: boost });
        } catch (error) {
          console.error("[Boosts] Error in toggleBoost handler:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    } else if (message.action === "deleteBoost") {
      // Handle boost deletion request
      (async () => {
        try {
          const { id } = message;
          if (!id) {
            throw new Error("Boost ID is required");
          }
          const success = await deleteBoost(id);
          sendResponse({ success, data: success });
        } catch (error) {
          console.error("[Boosts] Error in deleteBoost handler:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    } else if (message.action === "runBoost") {
      // Handle boost run request - execute boost code on current tab
      const tabId = sender.tab?.id;
      if (tabId === undefined) {
        sendResponse({ success: false, error: "No tab ID available" });
        return false;
      }

      (async () => {
        try {
          const { boostId } = message;
          if (!boostId) {
            throw new Error("Boost ID is required");
          }

          // Get the boost code from storage
          const boosts = await getBoosts();
          const boost = boosts.find((b) => b.id === boostId);
          if (!boost) {
            throw new Error("Boost not found");
          }

          // Execute the boost code in the page context
          const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: (boostCode: string) => {
              try {
                // eslint-disable-next-line no-eval
                eval(boostCode);
                return { success: true, result: "Boost executed successfully" };
              } catch (error) {
                return {
                  success: false,
                  error: error instanceof Error ? error.message : String(error),
                };
              }
            },
            args: [boost.code],
            world: "MAIN",
          });

          const result = results[0]?.result;
          if (result && typeof result === "object" && "success" in result) {
            sendResponse(result);
          } else {
            sendResponse({ success: true, result: "Boost executed successfully" });
          }
        } catch (error) {
          console.error("[Boosts] Error in runBoost handler:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    } else if (message.action === "getBoostsForDomain") {
      // Handle boosts for domain request from content script
      (async () => {
        try {
          const { hostname } = message;
          if (!hostname) {
            throw new Error("Hostname is required");
          }

          const boosts = await getBoostsForDomain(hostname);
          sendResponse({ success: true, boosts });
        } catch (error) {
          console.error("[Boosts] Error in getBoostsForDomain handler:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    } else if (message.action === "getAutoBoosts") {
      // Handle auto-boosts request - return enabled auto-mode boosts for domain
      (async () => {
        try {
          const { domain } = message;
          if (!domain) {
            throw new Error("Domain is required");
          }

          const boosts = await getBoostsForDomain(domain);
          const autoBoosts = boosts.filter((b) => b.runMode === "auto");

          sendResponse({ success: true, data: autoBoosts });
        } catch (error) {
          console.error("[Boosts] Error in getAutoBoosts handler:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    } else if (message.action === "generateText") {
      // Handle non-streaming AI request - forward to Vercel AI Gateway
      // Supports tool calling with browse tool
      const request = message as GenerateTextRequest;
      (async () => {
        try {
          const storageData = await new Promise<{
            aiGatewayConfig?: VercelAIGatewayConfig;
          }>((resolve) => {
            chrome.storage.sync.get(["aiGatewayConfig"], (result) => {
              resolve(result);
            });
          });

          const config = storageData.aiGatewayConfig;
          if (!config || !config.apiKey || !config.model) {
            throw new Error(
              "Vercel AI Gateway configuration not found. Please configure settings.",
            );
          }

          if (!request.messages || !Array.isArray(request.messages)) {
            throw new Error("Invalid request: messages array is required");
          }

          const gateway = createGateway({
            apiKey: config.apiKey,
          });

          // Enable tools if requested (default: enabled)
          const enableTools = request.enableTools !== false;

          const result = await generateText({
            model: gateway(config.model),
            messages: request.messages,
            // Apply system message if provided separately
            ...(request.system && { system: request.system }),
            // Call settings with defaults
            temperature: request.temperature ?? 0.7,
            maxOutputTokens: request.maxOutputTokens ?? 2000,
            topP: request.topP,
            topK: request.topK,
            presencePenalty: request.presencePenalty,
            frequencyPenalty: request.frequencyPenalty,
            stopSequences: request.stopSequences,
            seed: request.seed,
            maxRetries: request.maxRetries,
            headers: request.headers,
            // Tool settings
            ...(enableTools && {
              tools,
              toolChoice: request.toolChoice ?? "auto",
              maxSteps: request.maxSteps ?? 3,
            }),
            // Provider options
            ...(request.providerOptions && { providerOptions: request.providerOptions }),
          });

          const response: GenerateTextResponse = {
            success: true,
            content: result.text,
            usage: result.usage
              ? {
                  inputTokens: result.usage.inputTokens ?? 0,
                  outputTokens: result.usage.outputTokens ?? 0,
                  totalTokens: (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
                }
              : undefined,
          };
          sendResponse(response);
        } catch (error) {
          console.error("[Vercel AI Gateway] Error in generateText handler:", error);
          const response: GenerateTextResponse = {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
          sendResponse(response);
        }
      })();

      return true;
    }
  } catch (error: unknown) {
    console.error("[Clean Link Copy] Error in message listener:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Handle side panel open/close
 * Opens the side panel for the current tab
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "openSidePanel") {
    const tabId = sender.tab?.id;
    if (tabId !== undefined) {
      chrome.sidePanel.open({ tabId }, () => {
        if (chrome.runtime.lastError) {
          console.error("[Side Panel] Error opening side panel:", chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log("[Side Panel] Side panel opened for tab", tabId);
          sendResponse({ success: true });
        }
      });
      return true;
    }
  } else if (message.action === "openSidePanelTo") {
    // Open side panel and navigate to a specific path
    const tabId = sender.tab?.id;
    if (tabId !== undefined) {
      chrome.sidePanel.open({ tabId }, () => {
        if (chrome.runtime.lastError) {
          console.error("[Side Panel] Error opening side panel:", chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log(
            "[Side Panel] Side panel opened for tab",
            tabId,
            "navigating to",
            message.path,
          );
          // Send navigation message to the side panel
          chrome.tabs.sendMessage(
            tabId,
            {
              action: "navigate",
              path: message.path,
              params: message.params,
            },
            (response) => {
              if (chrome.runtime.lastError) {
                console.error(
                  "[Side Panel] Error sending navigation message:",
                  chrome.runtime.lastError,
                );
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
              } else {
                sendResponse({ success: true });
              }
            },
          );
        }
      });
      return true;
    }
  }
});

/**
 * Handle saveBoost message from boost authoring UI
 * Saves a boost to chrome.storage.local
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if ((message.action === "saveBoost" || message.type === "saveBoost") && message.payload) {
    saveBoost(message.payload)
      .then((boost) => {
        console.log("[Boosts] Boost saved successfully:", boost.id);
        sendResponse({ success: true, boost });
      })
      .catch((error) => {
        console.error("[Boosts] Error saving boost:", error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return true; // Indicate we'll respond asynchronously
  }
});

/**
 * Listen for tab updates to manage side panel state
 * Ensures side panel is properly isolated per tab
 */
chrome.tabs.onActivated.addListener((activeInfo) => {
  console.log("[Side Panel] Tab activated:", activeInfo.tabId);
  // Side panel automatically switches context when tab changes
});

/**
 * Listen for tab removal to clean up side panel state
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  console.log("[Side Panel] Tab removed:", tabId);
  // Chrome automatically handles side panel cleanup when tab is closed
});

/**
 * Handle streaming AI requests via port-based messaging
 * This allows sending chunks back to the client as they arrive
 * Supports tool calling with the browse tool
 */
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "aiStream") return;

  port.onMessage.addListener(async (message) => {
    if (message.action !== "streamText") return;

    const request = message as StreamTextRequest;

    const sendMessage = (msg: StreamMessageType) => port.postMessage(msg);

    try {
      const storageData = await new Promise<{
        aiGatewayConfig?: VercelAIGatewayConfig;
      }>((resolve) => {
        chrome.storage.sync.get(["aiGatewayConfig"], (result) => {
          resolve(result);
        });
      });

      const config = storageData.aiGatewayConfig;
      if (!config || !config.apiKey || !config.model) {
        sendMessage({
          type: "error",
          error: "Vercel AI Gateway configuration not found. Please configure settings.",
        });
        return;
      }

      if (!request.messages || !Array.isArray(request.messages)) {
        sendMessage({
          type: "error",
          error: "Invalid request: messages array is required",
        });
        return;
      }

      console.log("[Vercel AI Gateway] Starting streaming request for model:", config.model);

      const gateway = createGateway({
        apiKey: config.apiKey,
      });

      // Enable tools if requested (default: enabled)
      const enableTools = request.enableTools !== false;

      // Build provider options, merging user options with defaults
      const defaultProviderOptions = {
        anthropic: {
          thinking: {
            type: "enabled" as const,
            budgetTokens: 10000,
          },
        },
      };

      const result = streamText({
        model: gateway(config.model),
        messages: request.messages,
        // Apply system message if provided separately
        ...(request.system && { system: request.system }),
        // Call settings with defaults
        temperature: request.temperature,
        maxOutputTokens: request.maxOutputTokens,
        topP: request.topP,
        topK: request.topK,
        presencePenalty: request.presencePenalty,
        frequencyPenalty: request.frequencyPenalty,
        stopSequences: request.stopSequences,
        seed: request.seed,
        maxRetries: request.maxRetries,
        headers: request.headers,
        // Tool settings
        stopWhen: stepCountIs(request.maxSteps ?? 5),
        ...(enableTools && {
          tools,
          toolChoice: request.toolChoice ?? "auto",
        }),
        // Merge provider options
        providerOptions: {
          ...defaultProviderOptions,
          ...request.providerOptions,
        },
      });

      // Use fullStream to capture reasoning tokens, tool calls, and text
      for await (const part of result.fullStream) {
        switch (part.type) {
          case "reasoning-start":
            sendMessage({ type: "reasoning-start" });
            break;
          case "reasoning-delta":
            sendMessage({ type: "reasoning", content: part.text });
            break;
          case "reasoning-end":
            sendMessage({ type: "reasoning-end" });
            break;
          case "tool-input-start":
            sendMessage({
              type: "tool-input-start",
              toolCallId: part.id,
              toolName: part.toolName,
            });
            break;
          case "tool-input-delta":
            sendMessage({
              type: "tool-input-delta",
              toolCallId: part.id,
              inputTextDelta: part.delta,
            });
            break;
          case "tool-call":
            sendMessage({
              type: "tool-call",
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              input: part.input,
            });
            break;
          case "tool-result":
            sendMessage({
              type: "tool-result",
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              output: part.output,
            });
            break;
          case "tool-error":
            sendMessage({
              type: "tool-error",
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              errorText: part.error instanceof Error ? part.error.message : String(part.error),
            });
            break;
          case "text-delta":
            sendMessage({ type: "chunk", content: part.text });
            break;
        }
      }

      sendMessage({ type: "done" });
    } catch (error) {
      console.error("[Vercel AI Gateway] Error in streaming handler:", error);
      sendMessage({
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
});

/**
 * Handle streaming AI requests for boost authoring via port-based messaging
 * Similar to aiStream but uses boost-specific tools and system prompt
 * Supports tool calling with boost tools (file, execute_boost, read_console)
 */
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "boostStream") return;

  port.onMessage.addListener(async (message) => {
    if (message.action !== "streamText") return;

    const request = message as StreamTextRequest;

    const sendMessage = (msg: StreamMessageType) => port.postMessage(msg);

    try {
      const storageData = await new Promise<{
        aiGatewayConfig?: VercelAIGatewayConfig;
      }>((resolve) => {
        chrome.storage.sync.get(["aiGatewayConfig"], (result) => {
          resolve(result);
        });
      });

      const config = storageData.aiGatewayConfig;
      if (!config || !config.apiKey || !config.model) {
        sendMessage({
          type: "error",
          error: "Vercel AI Gateway configuration not found. Please configure settings.",
        });
        return;
      }

      if (!request.messages || !Array.isArray(request.messages)) {
        sendMessage({
          type: "error",
          error: "Invalid request: messages array is required",
        });
        return;
      }

      console.log("[Vercel AI Gateway] Starting boost streaming request for model:", config.model);

      const gateway = createGateway({
        apiKey: config.apiKey,
      });

      // Enable tools if requested (default: enabled)
      const enableTools = request.enableTools !== false;

      // Build provider options, merging user options with defaults
      const defaultProviderOptions = {
        anthropic: {
          thinking: {
            type: "enabled" as const,
            budgetTokens: 10000,
          },
        },
      };

      const result = streamText({
        model: gateway(config.model),
        messages: request.messages,
        // Use boost system prompt instead of request.system
        system: boostSystemPrompt,
        // Call settings with defaults
        temperature: request.temperature,
        maxOutputTokens: request.maxOutputTokens,
        topP: request.topP,
        topK: request.topK,
        presencePenalty: request.presencePenalty,
        frequencyPenalty: request.frequencyPenalty,
        stopSequences: request.stopSequences,
        seed: request.seed,
        maxRetries: request.maxRetries,
        headers: request.headers,
        // Tool settings - use boost tools instead of browse tools
        stopWhen: stepCountIs(request.maxSteps ?? 5),
        ...(enableTools && {
          tools: boostTools,
          toolChoice: request.toolChoice ?? "auto",
        }),
        // Merge provider options
        providerOptions: {
          ...defaultProviderOptions,
          ...request.providerOptions,
        },
      });

      // Use fullStream to capture reasoning tokens, tool calls, and text
      for await (const part of result.fullStream) {
        switch (part.type) {
          case "reasoning-start":
            sendMessage({ type: "reasoning-start" });
            break;
          case "reasoning-delta":
            sendMessage({ type: "reasoning", content: part.text });
            break;
          case "reasoning-end":
            sendMessage({ type: "reasoning-end" });
            break;
          case "tool-input-start":
            sendMessage({
              type: "tool-input-start",
              toolCallId: part.id,
              toolName: part.toolName,
            });
            break;
          case "tool-input-delta":
            sendMessage({
              type: "tool-input-delta",
              toolCallId: part.id,
              inputTextDelta: part.delta,
            });
            break;
          case "tool-call":
            sendMessage({
              type: "tool-call",
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              input: part.input,
            });
            break;
          case "tool-result":
            sendMessage({
              type: "tool-result",
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              output: part.output,
            });
            break;
          case "tool-error":
            sendMessage({
              type: "tool-error",
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              errorText: part.error instanceof Error ? part.error.message : String(part.error),
            });
            break;
          case "text-delta":
            sendMessage({ type: "chunk", content: part.text });
            break;
        }
      }

      sendMessage({ type: "done" });
    } catch (error) {
      console.error("[Vercel AI Gateway] Error in boost streaming handler:", error);
      sendMessage({
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
});

/**
 * Clean up boost drafts when tabs are closed
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  boostDrafts.delete(tabId);
  console.log("[Boosts] Cleaned up draft for closed tab", tabId);
});
