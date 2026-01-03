/**
 * Clips Sync Service
 * Handles optional synchronization of local clips to AgentDB
 */

import type { LocalClip } from "@repo/shared";
import {
  getPendingClips,
  updateClipSyncStatus,
  getLocalClip,
  deleteLocalClip,
} from "./local-clips";
import { initializeDatabase, saveWebpage, deleteWebpage } from "./database";

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
 */
export async function syncClipToAgentDB(clip: LocalClip): Promise<void> {
  const config = await getAgentDBConfig();
  if (!config) {
    // Mark as local-only if no config
    await updateClipSyncStatus(clip.id, "local-only");
    return;
  }

  try {
    await initializeDatabase(config);

    const webpage = {
      url: clip.url,
      title: clip.title,
      dom_content: clip.dom_content,
      text_content: clip.text_content,
      metadata: clip.metadata,
    };

    await saveWebpage(webpage);

    // Mark as synced (we don't have access to the AgentDB ID from the result)
    await updateClipSyncStatus(clip.id, "synced");

    console.log("[Clips Sync] Synced clip to AgentDB:", clip.id);
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

  const localDeleted = await deleteLocalClip(localId);
  return { localDeleted, agentdbDeleted };
}
