/**
 * Clips Sync Service
 * Handles optional synchronization of local clips to AgentDB
 */

import { nanoid } from "nanoid";
import type { LocalClip } from "@repo/shared";
import { generateClipId } from "@repo/shared/utils";
import {
  getPendingClips,
  updateClipSyncStatus,
  getLocalClip,
  deleteLocalClip,
  getLocalClips,
  saveLocalClip,
} from "./local-clips";
import {
  initializeDatabase,
  saveWebpage,
  deleteWebpage,
  updateWebpageByShareId,
  getWebpageByShareId,
  getWebpagesBatch,
  getWebpagesCount,
} from "./database";
import { deleteClipAssets } from "./asset-store";

/**
 * AgentDB configuration interface
 */
export interface AgentDBConfig {
  baseUrl: string;
  apiKey: string;
  token: string;
  dbName: string;
  dbType?: "sqlite" | "duckdb";
}

/**
 * Check if AgentDB is configured
 */
export async function isAgentDBConfigured(): Promise<boolean> {
  const config = await getAgentDBConfig();
  return config !== null;
}

/**
 * Get AgentDB configuration from chrome.storage.sync
 */
export async function getAgentDBConfig(): Promise<AgentDBConfig | null> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["agentdbConfig"], (result) => {
      const config = result.agentdbConfig as AgentDBConfig | undefined;
      if (config?.baseUrl && config?.apiKey && config?.token && config?.dbName) {
        resolve(config);
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Sync a single clip to AgentDB
 * @param clip - The clip to sync
 * @param generateShare - If true, generate a share_id for new clips (default: false)
 */
export async function syncClipToAgentDB(
  clip: LocalClip,
  generateShare: boolean = false,
): Promise<void> {
  const config = await getAgentDBConfig();
  if (!config) {
    // Mark as local-only if no config
    await updateClipSyncStatus(clip.id, "local-only");
    return;
  }

  try {
    await initializeDatabase(config);

    // Check if clip already has a share_id and if a record exists
    let shareId = clip.share_id;
    let existingWebpage = null;

    if (shareId) {
      existingWebpage = await getWebpageByShareId(shareId);
    }

    if (existingWebpage && shareId) {
      // Update existing record with latest highlights and content
      await updateWebpageByShareId(shareId, {
        url: clip.url,
        title: clip.title,
        dom_content: clip.dom_content,
        text_content: clip.text_content,
        metadata: clip.metadata,
        highlights: clip.highlights,
      });

      console.log(
        "[Clips Sync] Updated existing clip in AgentDB:",
        clip.id,
        "with share_id:",
        shareId,
      );
    } else {
      // Only generate share_id if explicitly requested (for sharing purposes)
      // Regular sync for backup doesn't need a share_id
      if (generateShare && !shareId) {
        shareId = nanoid(10);
      }

      const webpage = {
        url: clip.url,
        title: clip.title,
        dom_content: clip.dom_content,
        text_content: clip.text_content,
        metadata: clip.metadata,
        highlights: clip.highlights,
        ...(shareId && { share_id: shareId }),
      };

      await saveWebpage(webpage);

      // Update the local clip with the share_id if we generated one
      if (shareId && shareId !== clip.share_id) {
        const clips = await getLocalClips();
        const clipIndex = clips.findIndex((c) => c.id === clip.id);
        if (clipIndex !== -1) {
          clips[clipIndex] = {
            ...clips[clipIndex],
            share_id: shareId,
            updated_at: new Date().toISOString(),
          };
          await chrome.storage.local.set({ local_clips: clips });
        }
      }

      console.log(
        "[Clips Sync] Synced clip to AgentDB:",
        clip.id,
        shareId ? "with share_id: " + shareId : "(no share_id)",
      );
    }

    // Update sync status
    await updateClipSyncStatus(clip.id, "synced", undefined, undefined);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await updateClipSyncStatus(clip.id, "error", undefined, errorMessage);
    console.error("[Clips Sync] Failed to sync clip:", clip.id, errorMessage);
    throw error;
  }
}

/**
 * Sync all pending clips to AgentDB
 */
export async function syncPendingClips(): Promise<{
  synced: number;
  failed: number;
  skipped: number;
}> {
  const config = await getAgentDBConfig();

  if (!config) {
    console.log("[Clips Sync] AgentDB not configured, skipping sync");
    return { synced: 0, failed: 0, skipped: 0 };
  }

  const pendingClips = await getPendingClips();
  let synced = 0;
  let failed = 0;

  for (const clip of pendingClips) {
    try {
      await syncClipToAgentDB(clip);
      synced++;
    } catch {
      failed++;
    }
  }

  console.log(`[Clips Sync] Sync complete: ${synced} synced, ${failed} failed`);
  return { synced, failed, skipped: 0 };
}

/**
 * Delete a clip from AgentDB
 */
export async function deleteFromAgentDB(agentdbId: string): Promise<void> {
  const config = await getAgentDBConfig();
  if (!config) {
    return;
  }

  try {
    await initializeDatabase(config);
    await deleteWebpage(agentdbId);
    console.log("[Clips Sync] Deleted from AgentDB:", agentdbId);
  } catch (error) {
    console.error("[Clips Sync] Failed to delete from AgentDB:", agentdbId, error);
    throw error;
  }
}

/**
 * Delete a clip both locally and from AgentDB if synced
 */
export async function deleteClipWithSync(
  localId: string,
): Promise<{ localDeleted: boolean; agentdbDeleted: boolean }> {
  const clip = await getLocalClip(localId);

  let agentdbDeleted = false;

  if (clip?.agentdb_id && clip.sync_status === "synced") {
    try {
      await deleteFromAgentDB(clip.agentdb_id);
      agentdbDeleted = true;
    } catch {
      // Continue with local deletion even if AgentDB delete fails
    }
  }

  // Clean up IndexedDB assets if this is an element clip
  // The clip could be an ElementClip which has a 'type' property
  const clipAsAny = clip as unknown as Record<string, unknown>;
  if (clip && clipAsAny.type === "element") {
    try {
      await deleteClipAssets(localId);
      console.log("[Clips Sync] Deleted assets for clip:", localId);
    } catch (error) {
      console.warn("[Clips Sync] Failed to delete assets for clip:", localId, error);
      // Continue with local deletion even if asset deletion fails
    }
  }

  const localDeleted = await deleteLocalClip(localId);
  return { localDeleted, agentdbDeleted };
}

/**
 * Sync all webpages from AgentDB to local storage
 * Fetches webpages in batches and upserts them as LocalClip entries
 */
export async function syncFromAgentDB(): Promise<{
  imported: number;
  skipped: number;
  failed: number;
  total: number;
}> {
  const config = await getAgentDBConfig();

  if (!config) {
    console.log("[Clips Sync] AgentDB not configured, skipping pull-sync");
    return { imported: 0, skipped: 0, failed: 0, total: 0 };
  }

  try {
    await initializeDatabase(config);

    // Get total count of webpages
    const totalCount = await getWebpagesCount();
    console.log("[Clips Sync] Starting pull-sync from AgentDB, total webpages:", totalCount);

    // Get existing local clips for deduplication
    const existingClips = await getLocalClips();
    const existingUrls = new Set(existingClips.map((c) => c.url));

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const batchSize = 50;

    // Fetch webpages in batches
    for (let offset = 0; offset < totalCount; offset += batchSize) {
      try {
        const webpages = await getWebpagesBatch(offset, batchSize);

        if (webpages.length === 0) {
          break;
        }

        for (const webpage of webpages) {
          try {
            // Skip if URL already exists locally
            if (existingUrls.has(webpage.url)) {
              skipped++;
              continue;
            }

            // Parse metadata if it's a JSON string
            let metadata: Record<string, unknown> | undefined;
            if (webpage.metadata) {
              if (typeof webpage.metadata === "string") {
                try {
                  metadata = JSON.parse(webpage.metadata);
                } catch {
                  metadata = undefined;
                }
              } else {
                metadata = webpage.metadata;
              }
            }

            // Parse highlights if it's a JSON string
            let highlights: unknown[] | undefined;
            if (webpage.highlights) {
              if (typeof webpage.highlights === "string") {
                try {
                  highlights = JSON.parse(webpage.highlights);
                } catch {
                  highlights = undefined;
                }
              } else {
                highlights = webpage.highlights;
              }
            }

            // Create LocalClip from webpage
            const localClip: LocalClip = {
              id: generateClipId(),
              url: webpage.url,
              title: webpage.title,
              dom_content: "",
              text_content: webpage.text_content,
              metadata,
              highlights: highlights as any,
              sync_status: "synced",
              share_id: webpage.share_id,
              created_at: webpage.created_at || webpage.captured_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            // Save to local storage
            const clips = await getLocalClips();
            clips.push(localClip);
            await chrome.storage.local.set({ local_clips: clips });

            imported++;
            existingUrls.add(webpage.url);
          } catch (error) {
            failed++;
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("[Clips Sync] Failed to import webpage:", webpage.url, errorMessage);
          }
        }

        console.log(
          `[Clips Sync] Batch complete (offset: ${offset}, size: ${webpages.length}): imported ${imported}, skipped ${skipped}, failed ${failed}`,
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("[Clips Sync] Failed to fetch batch at offset:", offset, errorMessage);
        // Continue with next batch even if one fails
      }
    }

    console.log(
      `[Clips Sync] Pull-sync complete: ${imported} imported, ${skipped} skipped, ${failed} failed, ${totalCount} total`,
    );
    return { imported, skipped, failed, total: totalCount };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Clips Sync] Failed to sync from AgentDB:", errorMessage);
    throw error;
  }
}
