import {
  saveLocalClip,
  isUrlClipped,
  addHighlight,
  updateHighlightNote,
  deleteHighlight,
  updateLocalClip,
  getLocalClips,
  getLocalClip,
} from "../services/local-clips";
import {
  syncClipToAgentDB,
  isAgentDBConfigured,
  syncPendingClips,
  deleteClipWithSync,
  syncFromAgentDB,
} from "../services/clips-sync";
import { generateElementSummary } from "../services/element-ai-summary";
import { generateElementTitleAndDescription } from "../services/element-ai-service";
import { initAssetStore, saveAsset, getAssetAsDataUrl } from "../services/asset-store";
import type { ElementClip } from "@repo/shared";
import { parseJSONObject } from "@repo/shared/utils";
import type { HandlerMap } from "./types";
import { z } from "zod";

const requiredString = z.string().min(1);
const clipIdMessageSchema = z.object({ clipId: requiredString });
const mediaAssetSchema = z.object({
  type: z.enum(["image", "video", "background"]),
  assetId: z.string().optional(),
  originalSrc: z.string(),
  alt: z.string().optional(),
});
const elementMetadataSchema = z.object({
  tagName: z.string(),
  role: z.string().optional(),
  boundingBox: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }),
  classNames: z.array(z.string()),
  dataAttributes: z.record(z.string(), z.string()),
});
const elementClipInputSchema = z.object({
  url: requiredString,
  pageTitle: z.string(),
  selector: z.string(),
  domStructure: z.string(),
  scopedStyles: z.string(),
  textContent: z.string(),
  markdownContent: z.string(),
  structuredData: z
    .object({
      jsonLd: z.array(z.record(z.string(), z.json())).optional(),
      microdata: z
        .array(
          z.object({
            itemtype: z.string().optional(),
            properties: z.record(z.string(), z.array(z.string())),
          }),
        )
        .optional(),
      openGraph: z.record(z.string(), z.string()).optional(),
      ariaAttributes: z.record(z.string(), z.array(z.string())).optional(),
    })
    .optional(),
  mediaAssets: z.array(mediaAssetSchema),
  elementMeta: elementMetadataSchema,
});
const structuredBlobSchema = z.object({
  data: z.instanceof(ArrayBuffer),
  type: z.string().optional(),
});
const imageBlobSchema = z.union([z.instanceof(Blob), structuredBlobSchema]).optional();
const clipUpdateSchema = z.object({
  title: z.string().optional(),
  dom_content: z.string().optional(),
  text_content: z.string().optional(),
  metadata: z.record(z.string(), z.json()).optional(),
  sync_status: z.enum(["pending", "synced", "error", "local-only"]).optional(),
  sync_error: z.string().optional(),
  agentdb_id: z.string().optional(),
  share_id: z.string().optional(),
  pageTitle: z.string().optional(),
  selector: z.string().optional(),
  domStructure: z.string().optional(),
  scopedStyles: z.string().optional(),
  textContent: z.string().optional(),
  markdownContent: z.string().optional(),
  screenshotAssetId: z.string().optional(),
  mediaAssets: z.array(mediaAssetSchema).optional(),
  elementMeta: elementMetadataSchema.optional(),
  aiSummary: z.string().optional(),
  aiSummaryStatus: z.enum(["pending", "complete", "error"]).optional(),
  aiTitle: z.string().optional(),
  aiDescription: z.string().optional(),
  syncStatus: z.enum(["pending", "synced", "error", "local-only"]).optional(),
  updatedAt: z.string().optional(),
});

/**
 * Wait for a tab to finish loading with a timeout
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
 * Initialize the asset store (called from background.ts on load)
 */
export { initAssetStore };

export interface ClipsHandlerDependencies {
  saveLocalClip: typeof saveLocalClip;
  isUrlClipped: typeof isUrlClipped;
  addHighlight: typeof addHighlight;
  updateHighlightNote: typeof updateHighlightNote;
  deleteHighlight: typeof deleteHighlight;
  updateLocalClip: typeof updateLocalClip;
  getLocalClips: typeof getLocalClips;
  getLocalClip: typeof getLocalClip;
  syncClipToAgentDB: typeof syncClipToAgentDB;
  isAgentDBConfigured: typeof isAgentDBConfigured;
  syncPendingClips: typeof syncPendingClips;
  deleteClipWithSync: typeof deleteClipWithSync;
  syncFromAgentDB: typeof syncFromAgentDB;
  generateElementSummary: typeof generateElementSummary;
  generateElementTitleAndDescription: typeof generateElementTitleAndDescription;
  saveAsset: typeof saveAsset;
  getAssetAsDataUrl: typeof getAssetAsDataUrl;
}

export function createClipsHandlers(dependencies: ClipsHandlerDependencies): HandlerMap {
  const {
    saveLocalClip,
    isUrlClipped,
    addHighlight,
    updateHighlightNote,
    deleteHighlight,
    updateLocalClip,
    getLocalClips,
    getLocalClip,
    syncClipToAgentDB,
    isAgentDBConfigured,
    syncPendingClips,
    deleteClipWithSync,
    syncFromAgentDB,
    generateElementSummary,
    generateElementTitleAndDescription,
    saveAsset,
    getAssetAsDataUrl,
  } = dependencies;
  return {
    savePageToDatabase: (_message, _sender, sendResponse) => {
      const message = _message;
      (async () => {
        try {
          const page = z
            .object({
              url: requiredString,
              title: z.string(),
              domContent: z.string(),
              textContent: z.string(),
              metadata: z.json().optional(),
            })
            .parse(message);
          const metadataText = JSON.stringify(page.metadata ?? {});
          const clipInput = {
            url: page.url,
            title: page.title,
            dom_content: page.domContent,
            text_content: page.textContent,
            metadata: parseJSONObject(metadataText ?? "{}") ?? {},
          };

          const savedClip = await saveLocalClip(clipInput);
          console.log("[Clean Link Copy] Clip saved locally:", savedClip.id);

          const agentdbConfigured = await isAgentDBConfigured();
          if (agentdbConfigured) {
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
      return true;
    },

    clipElement: (message, _sender, sendResponse) => {
      (async () => {
        try {
          const clipData = elementClipInputSchema.parse(message.data);
          const screenshotDataUrl = z.string().optional().parse(message.screenshotDataUrl);
          const imageBlob = imageBlobSchema.parse(message.imageBlob);

          const now = new Date().toISOString();
          const clipId = `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          let screenshotAssetId = "";

          if (screenshotDataUrl) {
            try {
              const screenshotBlob = await fetch(screenshotDataUrl).then((r) => r.blob());
              screenshotAssetId = await saveAsset(clipId, "screenshot", screenshotBlob);
              console.log("[Background] Screenshot saved to IndexedDB:", screenshotAssetId);
            } catch (error) {
              console.warn("[Background] Failed to save screenshot to IndexedDB:", error);
            }
          }

          let mediaAssets = clipData.mediaAssets;
          if (imageBlob && mediaAssets.length > 0) {
            try {
              const imageBlobToSave =
                imageBlob instanceof Blob
                  ? imageBlob
                  : new Blob([imageBlob.data], { type: imageBlob.type || "image/png" });

              const imageAssetId = await saveAsset(
                clipId,
                "image",
                imageBlobToSave,
                mediaAssets[0].originalSrc,
              );
              console.log("[Background] Image saved to IndexedDB:", imageAssetId);

              mediaAssets = [{ ...mediaAssets[0], assetId: imageAssetId }, ...mediaAssets.slice(1)];
            } catch (error) {
              console.warn("[Background] Failed to save image to IndexedDB:", error);
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
            mediaAssets,
            elementMeta: clipData.elementMeta,
            aiSummary: undefined,
            aiSummaryStatus: "pending" as const,
            createdAt: now,
            updatedAt: now,
            syncStatus: "pending" as const,
          };

          const clips = await getLocalClips();
          clips.push(elementClip);
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
              elementClip.aiSummary = summary;
              elementClip.aiSummaryStatus = "complete";
              elementClip.updatedAt = new Date().toISOString();
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
              elementClip.aiTitle = title;
              elementClip.aiDescription = description;
              elementClip.updatedAt = new Date().toISOString();
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
      return true;
    },

    checkExistingClip: (message, _sender, sendResponse) => {
      (async () => {
        try {
          const url = requiredString.parse(message.url);
          const existingClip = await isUrlClipped(url);
          sendResponse({ success: true, clip: existingClip });
        } catch (error) {
          console.error("[Clean Link Copy] Error checking clip:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    },

    addHighlight: (message, _sender, sendResponse) => {
      (async () => {
        try {
          const input = z
            .object({
              clipId: requiredString,
              highlight: z.object({
                text: z.string(),
                color: z.string().default("yellow"),
                note: z.string().optional(),
                startOffset: z.number().default(0),
                endOffset: z.number().default(0),
              }),
            })
            .parse(message);
          const highlight = await addHighlight(input.clipId, input.highlight);
          sendResponse({ success: true, highlight });
        } catch (error) {
          console.error("[Clean Link Copy] Error adding highlight:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    },

    updateHighlightNote: (message, _sender, sendResponse) => {
      (async () => {
        try {
          const input = z
            .object({ clipId: requiredString, highlightId: requiredString, note: z.string() })
            .parse(message);
          await updateHighlightNote(input.clipId, input.highlightId, input.note);
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
    },

    deleteHighlight: (message, _sender, sendResponse) => {
      (async () => {
        try {
          const input = z
            .object({ clipId: requiredString, highlightId: requiredString })
            .parse(message);
          await deleteHighlight(input.clipId, input.highlightId);
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
    },

    updateClipContent: (message, _sender, sendResponse) => {
      (async () => {
        try {
          const input = z
            .object({ clipId: requiredString, domContent: z.string(), textContent: z.string() })
            .parse(message);
          const result = await updateLocalClip(input.clipId, {
            dom_content: input.domContent,
            text_content: input.textContent,
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
    },

    fetchClipContent: (message, _sender, sendResponse) => {
      (async () => {
        let tabId: number | undefined;
        try {
          const { clipId } = clipIdMessageSchema.parse(message);
          const clip = await getLocalClip(clipId);
          if (!clip) {
            sendResponse({ success: false, error: "Clip not found" });
            return;
          }

          const newTab = await chrome.tabs.create({ url: clip.url, active: false });
          if (!newTab.id) {
            throw new Error("Failed to create tab");
          }
          tabId = newTab.id;

          await waitForTabLoad(tabId, 30000);

          const response = await new Promise<{
            success: boolean;
            title?: string;
            domContent?: string;
            textContent?: string;
            error?: string;
          }>((resolve) => {
            if (!tabId) {
              resolve({ success: false, error: "No tab ID" });
              return;
            }
            chrome.tabs.sendMessage(
              tabId,
              { action: "extractArticleContent" },
              (response: {
                success: boolean;
                title?: string;
                domContent?: string;
                textContent?: string;
                error?: string;
              }) => {
                if (chrome.runtime.lastError) {
                  resolve({ success: false, error: chrome.runtime.lastError.message });
                } else {
                  resolve(response || { success: false, error: "No response from content script" });
                }
              },
            );
          });

          if (!response.success) {
            throw new Error(response.error || "Failed to extract article content");
          }

          await updateLocalClip(clipId, {
            title: response.title,
            dom_content: response.domContent,
            text_content: response.textContent,
          });

          sendResponse({ success: true });
        } catch (error) {
          console.error("[Clean Link Copy] Error in fetchClipContent handler:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        } finally {
          if (tabId !== undefined) {
            await chrome.tabs.remove(tabId).catch((error) => {
              console.warn("[Clean Link Copy] Failed to close background tab:", error);
            });
          }
        }
      })();
      return true;
    },

    openClipViewer: (message, _sender, _sendResponse) => {
      const { clipId } = clipIdMessageSchema.parse(message);
      const viewerUrl = chrome.runtime.getURL(
        `viewer/index.html#/viewer/${encodeURIComponent(clipId)}`,
      );
      chrome.tabs.create({ url: viewerUrl });
      return false;
    },

    getLocalClips: (_message, _sender, sendResponse) => {
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
    },

    getLocalClip: (message, _sender, sendResponse) => {
      (async () => {
        try {
          const { clipId } = clipIdMessageSchema.parse(message);
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
    },

    deleteClipWithSync: (message, _sender, sendResponse) => {
      (async () => {
        try {
          const { clipId } = clipIdMessageSchema.parse(message);
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
    },

    syncPendingClips: (_message, _sender, sendResponse) => {
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
    },

    syncFromAgentDB: (_message, _sender, sendResponse) => {
      (async () => {
        try {
          const result = await syncFromAgentDB();
          sendResponse({ success: true, data: result });
        } catch (error) {
          console.error("[Clips] Error in syncFromAgentDB handler:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    },

    syncSingleClip: (message, _sender, sendResponse) => {
      (async () => {
        try {
          const { clipId, generateShare = false } = z
            .object({ clipId: requiredString, generateShare: z.boolean().optional() })
            .parse(message);
          if (!clipId) {
            throw new Error("Clip ID is required");
          }
          const clip = await getLocalClip(clipId);
          if (!clip) {
            throw new Error("Clip not found");
          }
          if ("type" in clip) {
            throw new Error("Element clips cannot be synced to AgentDB");
          }
          await syncClipToAgentDB(clip, generateShare);
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
    },

    isAgentDBConfigured: (_message, _sender, sendResponse) => {
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
    },

    updateLocalClip: (message, _sender, sendResponse) => {
      (async () => {
        try {
          const { clipId, updates } = z
            .object({ clipId: requiredString, updates: clipUpdateSchema })
            .parse(message);
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
    },

    getClipAsset: (message, _sender, sendResponse) => {
      (async () => {
        try {
          const { assetId } = z.object({ assetId: requiredString }).parse(message);
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
    },
  };
}

export const clipsHandlerDependencies: ClipsHandlerDependencies = {
  saveLocalClip,
  isUrlClipped,
  addHighlight,
  updateHighlightNote,
  deleteHighlight,
  updateLocalClip,
  getLocalClips,
  getLocalClip,
  syncClipToAgentDB,
  isAgentDBConfigured,
  syncPendingClips,
  deleteClipWithSync,
  syncFromAgentDB,
  generateElementSummary,
  generateElementTitleAndDescription,
  saveAsset,
  getAssetAsDataUrl,
};

export const clipsHandlers = createClipsHandlers(clipsHandlerDependencies);
