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
import { createBoostTools } from "./tools/boost-tools";
import { getBoostSystemPrompt } from "./tools/boost-system-prompt";
import {
  saveLocalClip,
  isUrlClipped,
  addHighlight,
  updateHighlightNote,
  deleteHighlight,
  updateLocalClip,
  getLocalClips,
  getLocalClip,
} from "./services/local-clips";
import {
  syncClipToAgentDB,
  isAgentDBConfigured,
  syncPendingClips,
  deleteClipWithSync,
} from "./services/clips-sync";
import {
  getBoosts,
  toggleBoost,
  deleteBoost,
  updateBoost,
  getBoostsForDomain,
  saveBoost,
} from "./services/boosts";
import { generateElementSummary } from "./services/element-ai-summary";
import { generateElementTitleAndDescription } from "./services/element-ai-service";
import { initAssetStore, saveAsset, getAssetAsDataUrl } from "./services/asset-store";
import type {
  GenerateTextRequest,
  StreamTextRequest,
  GenerateTextResponse,
  StreamMessageType,
  ElementClip,
} from "@repo/shared";

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

// =============================================================================

/**
 * Execute boost code in a tab using script tag injection to bypass CSP
 * This works on pages that have 'unsafe-inline' but not 'unsafe-eval'
 */
async function executeBoostCode(
  tabId: number,
  code: string,
): Promise<{ success: boolean; result?: string; error?: string }> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: (codeToExecute: string) => {
      return new Promise<{ success: boolean; result?: string; error?: string }>((resolve) => {
        try {
          // Create a unique ID to capture the result
          const resultId = `__boost_result_${Date.now()}_${Math.random().toString(36).slice(2)}`;

          // Wrap the code to capture the result and handle errors
          const wrappedCode = `
            (function() {
              try {
                const __boostResult = (function() {
                  ${codeToExecute}
                })();
                window["${resultId}"] = { success: true, result: __boostResult !== undefined ? String(__boostResult) : undefined };
              } catch (error) {
                window["${resultId}"] = { success: false, error: error instanceof Error ? error.message : String(error) };
              }
            })();
          `;

          // Create and inject the script tag
          const script = document.createElement("script");
          script.textContent = wrappedCode;
          document.documentElement.appendChild(script);
          script.remove();

          // Retrieve the result from the window object
          const result = (window as unknown as Record<string, unknown>)[resultId] as
            | { success: boolean; result?: string; error?: string }
            | undefined;
          delete (window as unknown as Record<string, unknown>)[resultId];

          if (result) {
            resolve(result);
          } else {
            resolve({ success: true, result: "Boost executed (no return value)" });
          }
        } catch (error) {
          resolve({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    },
    args: [code],
  });

  return (await results[0]?.result) || { success: false, error: "No result from script execution" };
}

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
    } else if (message.action === "clipElement") {
      // Handle element clip request - save element clip locally with screenshot
      (async () => {
        try {
          const clipData = message.data;
          const screenshotDataUrl = message.screenshotDataUrl;
          const imageBlob = message.imageBlob; // Image blob from single-image element

          // Create element clip with metadata
          const now = new Date().toISOString();
          const clipId = `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          let screenshotAssetId = "";

          // Save screenshot to IndexedDB if provided
          if (screenshotDataUrl) {
            try {
              const screenshotBlob = await fetch(screenshotDataUrl).then((r) => r.blob());
              screenshotAssetId = await saveAsset(clipId, "screenshot", screenshotBlob);
              console.log("[Background] Screenshot saved to IndexedDB:", screenshotAssetId);
            } catch (error) {
              console.warn("[Background] Failed to save screenshot to IndexedDB:", error);
              // Continue without screenshot - it's not critical
            }
          }

          // Handle image blob from single-image element
          let mediaAssets = clipData.mediaAssets;
          if (imageBlob && mediaAssets.length > 0) {
            try {
              // Convert imageBlob to Blob if it's a serialized object
              let imageBlobToSave = imageBlob;
              if (!(imageBlob instanceof Blob)) {
                // If it's a serialized object, reconstruct it
                imageBlobToSave = new Blob([imageBlob.data || imageBlob], {
                  type: imageBlob.type || "image/png",
                });
              }

              const imageAssetId = await saveAsset(
                clipId,
                "image",
                imageBlobToSave,
                mediaAssets[0].originalSrc,
              );
              console.log("[Background] Image saved to IndexedDB:", imageAssetId);

              // Update mediaAssets[0] with the saved asset ID
              mediaAssets = [
                {
                  ...mediaAssets[0],
                  assetId: imageAssetId,
                },
                ...mediaAssets.slice(1),
              ];
            } catch (error) {
              console.warn("[Background] Failed to save image to IndexedDB:", error);
              // Continue without image asset - URL is still available
            }
          }

          const elementClip: ElementClip = {
            id: clipId,
            type: "element" as const,
            url: clipData.url,
            pageTitle: clipData.pageTitle,
            selector: clipData.selector,
            screenshotAssetId: screenshotAssetId,
            domStructure: clipData.domStructure,
            scopedStyles: clipData.scopedStyles,
            textContent: clipData.textContent,
            markdownContent: clipData.markdownContent,
            structuredData: clipData.structuredData,
            mediaAssets: mediaAssets,
            elementMeta: clipData.elementMeta,
            aiSummary: undefined,
            aiSummaryStatus: "pending" as const,
            createdAt: now,
            updatedAt: now,
            syncStatus: "pending" as const,
          };

          // Save element clip to storage (getLocalClips returns LocalClip[] but storage can contain both types)
          const clips = await getLocalClips();
          (clips as unknown[]).push(elementClip);
          await chrome.storage.local.set({ local_clips: clips });

          console.log("[Background] Element clip saved:", elementClip.id);

          sendResponse({
            success: true,
            message: "Element clipped successfully",
            clipId: elementClip.id,
          });

          // Generate AI summary asynchronously (don't block the save response)
          generateElementSummary(elementClip)
            .then((summary) => {
              // Update clip with generated summary
              elementClip.aiSummary = summary;
              elementClip.aiSummaryStatus = "complete";
              elementClip.updatedAt = new Date().toISOString();

              // Update the clip in storage
              updateLocalClip(elementClip.id, {
                aiSummary: summary,
                aiSummaryStatus: "complete",
                updatedAt: elementClip.updatedAt,
              }).catch((error) => {
                console.error("[Background] Error updating clip with summary:", error);
              });

              console.log("[Background] AI summary generated for clip:", elementClip.id);
            })
            .catch((error) => {
              console.error("[Background] Error generating AI summary:", error);
              // Mark as error status
              updateLocalClip(elementClip.id, {
                aiSummaryStatus: "error",
                updatedAt: new Date().toISOString(),
              }).catch((updateError) => {
                console.error("[Background] Error updating clip error status:", updateError);
              });
            });

          // Generate AI title and description asynchronously (fire-and-forget)
          generateElementTitleAndDescription(elementClip)
            .then(({ title, description }) => {
              // Update clip with generated title and description
              elementClip.aiTitle = title;
              elementClip.aiDescription = description;
              elementClip.updatedAt = new Date().toISOString();

              // Update the clip in storage
              updateLocalClip(elementClip.id, {
                aiTitle: title,
                aiDescription: description,
                updatedAt: elementClip.updatedAt,
              }).catch((error) => {
                console.error("[Background] Error updating clip with title/description:", error);
              });

              console.log(
                "[Background] AI title and description generated for clip:",
                elementClip.id,
              );
            })
            .catch((error) => {
              console.error("[Background] Error generating AI title and description:", error);
            });
        } catch (error) {
          console.error("[Background] Error saving element clip:", error);
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
      // Open clip viewer in a new tab (using new React-based viewer with hash routing)
      const viewerUrl = chrome.runtime.getURL(
        `viewer/index.html#/viewer/${encodeURIComponent(message.clipId)}`,
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

          // Execute using script tag injection to bypass CSP
          const result = await executeBoostCode(tabId, code);
          sendResponse(result);
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
    } else if (message.action === "updateBoost") {
      // Handle boost update request
      (async () => {
        try {
          const { id, updates } = message;
          if (!id) {
            throw new Error("Boost ID is required");
          }
          const boost = await updateBoost(id, updates);
          if (!boost) {
            throw new Error("Boost not found");
          }
          sendResponse({ success: true, boost });
        } catch (error) {
          console.error("[Boosts] Error in updateBoost handler:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    } else if (message.action === "runBoost") {
      // Handle boost run request - execute boost code on current tab
      (async () => {
        try {
          // Get tabId from sender if available (content script), otherwise query active tab (sidepanel)
          let tabId = sender.tab?.id;
          if (tabId === undefined) {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            tabId = activeTab?.id;
          }

          if (tabId === undefined) {
            sendResponse({ success: false, error: "No tab ID available" });
            return;
          }

          const { boostId, id } = message;
          const boostIdToUse = boostId || id;
          if (!boostIdToUse) {
            throw new Error("Boost ID is required");
          }

          // Get the boost code from storage
          const boosts = await getBoosts();
          const boost = boosts.find((b) => b.id === boostIdToUse);
          if (!boost) {
            throw new Error("Boost not found");
          }

          // Execute using script tag injection to bypass CSP
          const result = await executeBoostCode(tabId, boost.code);
          sendResponse(result);
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

          // Use request.model if provided, otherwise fall back to config.model
          const modelToUse = request.model || config.model;

          const result = await generateText({
            model: gateway(modelToUse),
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
    } else if (message.action === "tidyContent") {
      // Handle HTML content cleaning request
      const { domContent } = message;
      if (!domContent || typeof domContent !== "string") {
        sendResponse({
          success: false,
          error: "domContent is required and must be a string",
        });
        return false;
      }

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

          const gateway = createGateway({
            apiKey: config.apiKey,
          });

          const systemPrompt = `You are an HTML content cleaner. Given HTML content from a web page, return ONLY the cleaned HTML.

Remove these types of elements:
- Advertisements and promotional content
- Navigation menus and sidebars
- Social sharing buttons
- Comment sections
- Related articles sections
- Newsletter signup forms
- Cookie banners
- Floating elements and popups
- Empty or decorative containers

Preserve:
- Main article text and paragraphs
- Headings and subheadings
- Images with their alt text and captions
- Code blocks and pre-formatted text
- Block quotes
- Lists (ordered and unordered)
- Tables with data
- Links within the content

Return ONLY valid HTML, no explanations or markdown.`;

          const result = await generateText({
            model: gateway("google/gemini-3-flash"),
            messages: [
              {
                role: "user",
                content: domContent,
              },
            ],
            system: systemPrompt,
            maxOutputTokens: 20_000,
          });

          sendResponse({
            success: true,
            data: result.text,
          });
        } catch (error) {
          console.error("[Clean Link Copy] Error in tidyContent handler:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();

      return true;
    } else if (message.action === "tidyContentChunked") {
      // Handle chunked HTML content cleaning request
      // Content script splits the HTML into chunks (has DOM access) and sends pre-split chunks here
      const { chunks, concurrency = 4 } = message;
      const tabId = sender.tab?.id;

      if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
        sendResponse({
          success: false,
          error: "chunks array is required",
        });
        return false;
      }

      if (!tabId) {
        sendResponse({
          success: false,
          error: "Could not determine sender tab",
        });
        return false;
      }

      // Send success response immediately - processing happens async
      sendResponse({
        success: true,
        totalChunks: chunks.length,
      });

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

          const gateway = createGateway({
            apiKey: config.apiKey,
          });

          const systemPrompt = `You are an HTML content cleaner. Given HTML content from a web page, return ONLY the cleaned HTML.

Remove these types of elements:
- Advertisements and promotional content
- Navigation menus and sidebars
- Social sharing buttons
- Comment sections
- Related articles sections
- Newsletter signup forms
- Cookie banners
- Floating elements and popups
- Empty or decorative containers

Preserve:
- Main article text and paragraphs
- Headings and subheadings
- Images with their alt text and captions
- Code blocks and pre-formatted text
- Block quotes
- Lists (ordered and unordered)
- Tables with data
- Links within the content

Return ONLY valid HTML, no explanations or markdown.`;

          // Process chunks with concurrency limit
          const processChunk = async (chunk: { id: string; html: string }) => {
            try {
              const result = await generateText({
                model: gateway("google/gemini-3-flash"),
                messages: [
                  {
                    role: "user",
                    content: chunk.html,
                  },
                ],
                system: systemPrompt,
                maxOutputTokens: 20_000,
              });

              // Send result back to the tab
              chrome.tabs.sendMessage(tabId, {
                action: "tidyChunkComplete",
                chunkId: chunk.id,
                html: result.text,
                success: true,
              });
            } catch (error) {
              console.error(`[Clean Link Copy] Error processing chunk ${chunk.id}:`, error);
              chrome.tabs.sendMessage(tabId, {
                action: "tidyChunkComplete",
                chunkId: chunk.id,
                html: "",
                success: false,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          };

          // Process chunks with concurrency limit using a simple pool
          const pool: Promise<void>[] = [];
          for (const chunk of chunks) {
            const task = processChunk(chunk);
            pool.push(task);

            if (pool.length >= concurrency) {
              await Promise.race(pool);
              // Remove completed promises
              for (let i = pool.length - 1; i >= 0; i--) {
                // Create a flag to check if promise is settled
                const isSettled = await Promise.race([
                  pool[i].then(() => true),
                  Promise.resolve(false),
                ]);
                if (isSettled) {
                  pool.splice(i, 1);
                }
              }
            }
          }

          // Wait for remaining tasks
          await Promise.all(pool);
        } catch (error) {
          console.error("[Clean Link Copy] Error in tidyContentChunked handler:", error);
          // Send error as a chunk complete message so caller knows processing failed
          chrome.tabs.sendMessage(tabId, {
            action: "tidyChunkComplete",
            chunkId: "error",
            html: "",
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();

      return true;
    } else if (message.action === "updateAIGatewayConfig") {
      // Handle AI Gateway configuration update (e.g., model selection)
      (async () => {
        try {
          const { config } = message;
          if (!config) {
            throw new Error("Config is required");
          }

          // Get current config
          const storageData = await new Promise<{
            aiGatewayConfig?: VercelAIGatewayConfig;
          }>((resolve) => {
            chrome.storage.sync.get(["aiGatewayConfig"], (result) => {
              resolve(result);
            });
          });

          const currentConfig = storageData.aiGatewayConfig || {};

          // Merge with new config
          const updatedConfig = {
            ...currentConfig,
            ...config,
          };

          // Save to storage
          await new Promise<void>((resolve) => {
            chrome.storage.sync.set({ aiGatewayConfig: updatedConfig }, () => {
              resolve();
            });
          });

          console.log("[AI Gateway] Configuration updated:", updatedConfig);
          sendResponse({ success: true });
        } catch (error) {
          console.error("[AI Gateway] Error updating configuration:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    } else if (message.action === "getLocalClips") {
      // Handle get all clips request from clips app
      (async () => {
        try {
          const clips = await getLocalClips();
          sendResponse({ success: true, data: clips });
        } catch (error) {
          console.error("[Clips] Error in getLocalClips handler:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    } else if (message.action === "getLocalClip") {
      // Handle get single clip request from clips app
      (async () => {
        try {
          const { clipId } = message;
          if (!clipId) {
            throw new Error("Clip ID is required");
          }
          const clip = await getLocalClip(clipId);
          sendResponse({ success: true, data: clip });
        } catch (error) {
          console.error("[Clips] Error in getLocalClip handler:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    } else if (message.action === "deleteClipWithSync") {
      // Handle delete clip request (deletes locally and from AgentDB if synced)
      (async () => {
        try {
          const { clipId } = message;
          if (!clipId) {
            throw new Error("Clip ID is required");
          }
          const result = await deleteClipWithSync(clipId);
          sendResponse({ success: true, data: result });
        } catch (error) {
          console.error("[Clips] Error in deleteClipWithSync handler:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    } else if (message.action === "syncPendingClips") {
      // Handle sync pending clips request
      (async () => {
        try {
          const result = await syncPendingClips();
          sendResponse({ success: true, data: result });
        } catch (error) {
          console.error("[Clips] Error in syncPendingClips handler:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    } else if (message.action === "syncSingleClip") {
      // Handle sync single clip request - syncs a clip to AgentDB and returns the updated clip with share_id
      // Always syncs to ensure highlights and other data are up to date
      (async () => {
        try {
          const { clipId } = message;
          if (!clipId) {
            throw new Error("Clip ID is required");
          }
          const clip = await getLocalClip(clipId);
          if (!clip) {
            throw new Error("Clip not found");
          }
          // Always sync to AgentDB to update highlights and other data
          await syncClipToAgentDB(clip);
          // Get updated clip with share_id
          const updatedClip = await getLocalClip(clipId);
          sendResponse({ success: true, data: updatedClip });
        } catch (error) {
          console.error("[Clips] Error in syncSingleClip handler:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    } else if (message.action === "isAgentDBConfigured") {
      // Handle check if AgentDB is configured request
      (async () => {
        try {
          const configured = await isAgentDBConfigured();
          sendResponse({ success: true, data: configured });
        } catch (error) {
          console.error("[Clips] Error in isAgentDBConfigured handler:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    } else if (message.action === "updateLocalClip") {
      // Handle update clip request from clips app
      (async () => {
        try {
          const { clipId, updates } = message;
          if (!clipId) {
            throw new Error("Clip ID is required");
          }
          const result = await updateLocalClip(clipId, updates);
          sendResponse({ success: true, data: result });
        } catch (error) {
          console.error("[Clips] Error in updateLocalClip handler:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    } else if (message.action === "getClipAsset") {
      // Handle get clip asset request from clips app (for screenshot previews)
      (async () => {
        try {
          const { assetId } = message;
          if (!assetId) {
            throw new Error("Asset ID is required");
          }
          const dataUrl = await getAssetAsDataUrl(assetId);
          sendResponse({ success: true, dataUrl });
        } catch (error) {
          console.error("[Clips] Error in getClipAsset handler:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    } else if (message.action === "readAloud") {
      (async () => {
        try {
          // Store text for TTS player to read
          await chrome.storage.local.set({
            tts_pending_text: {
              text: message.text,
              title: message.title,
              url: message.url,
              timestamp: Date.now(),
            },
          });

          // Open TTS player popup window
          await chrome.windows.create({
            url: chrome.runtime.getURL("tts-player/index.html"),
            type: "popup",
            width: 350,
            height: 175,
          });

          sendResponse({ success: true });
        } catch (error) {
          console.error("[Read Aloud] Error:", error);
          sendResponse({ success: false, error: String(error) });
        }
      })();
      return true; // Will send response asynchronously
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
 * Send navigation message to sidepanel with retry logic
 * The sidepanel may not have loaded and registered its listener yet,
 * so we retry with exponential backoff
 */
async function sendNavigationWithRetry(
  path: string,
  params?: Record<string, string>,
  maxRetries = 5,
  initialDelayMs = 100,
): Promise<boolean> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await new Promise<{ success?: boolean }>((resolve) => {
        chrome.runtime.sendMessage({ action: "navigate", path, params }, (resp) => {
          if (chrome.runtime.lastError) {
            // No listener registered yet - this is expected on first attempts
            resolve({ success: false });
          } else {
            resolve(resp || { success: false });
          }
        });
      });

      if (response?.success) {
        console.log(`[Side Panel] Navigation succeeded on attempt ${attempt + 1}`);
        return true;
      }
    } catch {
      // Continue to retry
    }

    // Wait before retrying with exponential backoff
    const delay = initialDelayMs * Math.pow(2, attempt);
    console.log(`[Side Panel] Navigation attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  console.error("[Side Panel] Navigation failed after all retries");
  return false;
}

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
      chrome.sidePanel.open({ tabId }, async () => {
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
          // Send navigation message with retry to handle race condition
          // where sidepanel hasn't registered its listener yet
          const success = await sendNavigationWithRetry(message.path, message.params);
          sendResponse({ success });
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

      // Use request.model if provided, otherwise fall back to config.model
      const modelToUse = request.model || config.model;

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
        model: gateway(modelToUse),
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
      // Get the active tab to use for boost tool execution
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = activeTab?.id;

      if (!tabId) {
        sendMessage({
          type: "error",
          error: "No active tab found. Please ensure a tab is active.",
        });
        return;
      }

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

      console.log(
        "[Vercel AI Gateway] Starting boost streaming request for model:",
        config.model,
        "on tab:",
        tabId,
      );

      const gateway = createGateway({
        apiKey: config.apiKey,
      });

      // Create boost tools with execution context
      const boostTools = await createBoostTools({
        tabId,
        boostDrafts,
      });

      // Enable tools if requested (default: enabled)
      const enableTools = request.enableTools !== false;

      // Use request.model if provided, otherwise fall back to config.model
      const modelToUse = request.model || config.model;

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
        model: gateway(modelToUse),
        messages: request.messages,
        // Use boost system prompt with page context
        system: getBoostSystemPrompt({
          url: activeTab.url,
          title: activeTab.title,
        }),
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
        // Tool settings - use boost tools with real execution context
        stopWhen: stepCountIs(request.maxSteps ?? 5),
        ...(enableTools && {
          tools: boostTools as Record<string, unknown>,
          toolChoice: request.toolChoice ?? "auto",
        }),
        // Merge provider options
        providerOptions: {
          ...defaultProviderOptions,
          ...request.providerOptions,
        },
      } as Parameters<typeof streamText>[0]);

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

/**
 * Initialize IndexedDB asset store on background script load
 */
initAssetStore()
  .then(() => {
    console.log("[Background] Asset store initialized successfully");
  })
  .catch((error) => {
    console.error("[Background] Failed to initialize asset store:", error);
  });
