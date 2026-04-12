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
import type { HandlerMap } from "./types";

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

export const clipsHandlers: HandlerMap = {
  savePageToDatabase: (_message, _sender, sendResponse) => {
    const message = _message;
    (async () => {
      try {
        const clipInput = {
          url: message.url as string,
          title: message.title as string,
          dom_content: message.domContent as string,
          text_content: message.textContent as string,
          metadata: (message.metadata as Record<string, unknown>) || {},
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
        const clipData = message.data as Record<string, unknown>;
        const screenshotDataUrl = message.screenshotDataUrl as string | undefined;
        const imageBlob = message.imageBlob as Blob | { data?: ArrayBuffer; type?: string } | undefined;

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

        let mediaAssets = clipData.mediaAssets as Array<Record<string, unknown>>;
        if (imageBlob && mediaAssets.length > 0) {
          try {
            let imageBlobToSave: Blob = imageBlob as Blob;
            if (!(imageBlob instanceof Blob)) {
              const blobLike = imageBlob as { data?: ArrayBuffer; type?: string };
              imageBlobToSave = new Blob([blobLike.data || imageBlob], {
                type: blobLike.type || "image/png",
              });
            }

            const imageAssetId = await saveAsset(
              clipId,
              "image",
              imageBlobToSave,
              mediaAssets[0].originalSrc as string,
            );
            console.log("[Background] Image saved to IndexedDB:", imageAssetId);

            mediaAssets = [
              { ...mediaAssets[0], assetId: imageAssetId },
              ...mediaAssets.slice(1),
            ];
          } catch (error) {
            console.warn("[Background] Failed to save image to IndexedDB:", error);
          }
        }

        const elementClip: ElementClip = {
          id: clipId,
          type: "element" as const,
          url: clipData.url as string,
          pageTitle: clipData.pageTitle as string,
          selector: clipData.selector as string,
          screenshotAssetId: screenshotAssetId,
          domStructure: clipData.domStructure as string,
          scopedStyles: clipData.scopedStyles as string,
          textContent: clipData.textContent as string,
          markdownContent: clipData.markdownContent as string,
          structuredData: clipData.structuredData as Record<string, unknown>,
          mediaAssets: mediaAssets as ElementClip["mediaAssets"],
          elementMeta: clipData.elementMeta as ElementClip["elementMeta"],
          aiSummary: undefined,
          aiSummaryStatus: "pending" as const,
          createdAt: now,
          updatedAt: now,
          syncStatus: "pending" as const,
        };

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
        const existingClip = await isUrlClipped(message.url as string);
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
        const highlight = await addHighlight(
          message.clipId as string,
          message.highlight as Parameters<typeof addHighlight>[1],
        );
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
        await updateHighlightNote(
          message.clipId as string,
          message.highlightId as string,
          message.note as string,
        );
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
        await deleteHighlight(message.clipId as string, message.highlightId as string);
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
        const result = await updateLocalClip(message.clipId as string, {
          dom_content: message.domContent as string,
          text_content: message.textContent as string,
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
        const { clipId } = message as { clipId: string };
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
    const viewerUrl = chrome.runtime.getURL(
      `viewer/index.html#/viewer/${encodeURIComponent(message.clipId as string)}`,
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
        const { clipId } = message as { clipId: string };
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
        const { clipId } = message as { clipId: string };
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
        const { clipId, generateShare = false } = message as {
          clipId: string;
          generateShare?: boolean;
        };
        if (!clipId) {
          throw new Error("Clip ID is required");
        }
        const clip = await getLocalClip(clipId);
        if (!clip) {
          throw new Error("Clip not found");
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
        const { clipId, updates } = message as {
          clipId: string;
          updates: Record<string, unknown>;
        };
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
        const { assetId } = message as { assetId: string };
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
