/**
 * Local Clips Storage Service
 * Manages local storage of clipped pages using chrome.storage.local
 * This is the primary storage mechanism - AgentDB sync is optional
 */

import type { SyncStatus, Highlight, LocalClip, ClipInput } from "@repo/shared";
import { generateClipId } from "@repo/shared/utils";

export type { SyncStatus, Highlight, LocalClip, ClipInput } from "@repo/shared";

const STORAGE_KEY = "local_clips";

/**
 * Get all local clips
 */
export async function getLocalClips(): Promise<LocalClip[]> {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  const clips = (result[STORAGE_KEY] as LocalClip[] | undefined) || [];
  // Sort by created_at descending (newest first)
  return clips.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * Get a single clip by ID
 */
export async function getLocalClip(id: string): Promise<LocalClip | null> {
  const clips = await getLocalClips();
  return clips.find((c) => c.id === id) || null;
}

/**
 * Save a new clip locally
 */
export async function saveLocalClip(input: ClipInput): Promise<LocalClip> {
  const clips = await getLocalClips();
  const now = new Date().toISOString();

  const newClip: LocalClip = {
    id: generateClipId(),
    url: input.url,
    title: input.title,
    dom_content: input.dom_content,
    text_content: input.text_content,
    metadata: input.metadata,
    created_at: now,
    updated_at: now,
    sync_status: "pending",
  };

  clips.push(newClip);
  await chrome.storage.local.set({ [STORAGE_KEY]: clips });

  console.log("[Local Clips] Saved clip:", newClip.id, newClip.url);
  return newClip;
}

/**
 * Update a clip's sync status
 */
export async function updateClipSyncStatus(
  id: string,
  status: SyncStatus,
  agentdbId?: string,
  error?: string,
): Promise<void> {
  const clips = await getLocalClips();
  const index = clips.findIndex((c) => c.id === id);

  if (index === -1) {
    console.warn("[Local Clips] Clip not found for sync update:", id);
    return;
  }

  clips[index] = {
    ...clips[index],
    sync_status: status,
    updated_at: new Date().toISOString(),
    ...(agentdbId && { agentdb_id: agentdbId }),
    ...(error && { sync_error: error }),
  };

  await chrome.storage.local.set({ [STORAGE_KEY]: clips });
  console.log("[Local Clips] Updated sync status:", id, status);
}

/**
 * Delete a clip locally
 */
export async function deleteLocalClip(id: string): Promise<boolean> {
  const clips = await getLocalClips();
  const index = clips.findIndex((c) => c.id === id);

  if (index === -1) {
    console.warn("[Local Clips] Clip not found for deletion:", id);
    return false;
  }

  clips.splice(index, 1);
  await chrome.storage.local.set({ [STORAGE_KEY]: clips });

  console.log("[Local Clips] Deleted clip:", id);
  return true;
}

/**
 * Get clips that need syncing (status is "pending")
 */
export async function getPendingClips(): Promise<LocalClip[]> {
  const clips = await getLocalClips();
  return clips.filter((c) => c.sync_status === "pending");
}

/**
 * Mark a clip as local-only (won't be synced)
 */
export async function markAsLocalOnly(id: string): Promise<void> {
  await updateClipSyncStatus(id, "local-only");
}

/**
 * Add a highlight to a clip
 */
export async function addHighlight(
  clipId: string,
  highlight: Omit<Highlight, "id" | "created_at">,
): Promise<Highlight | null> {
  const clips = await getLocalClips();
  const index = clips.findIndex((c) => c.id === clipId);

  if (index === -1) {
    console.warn("[Local Clips] Clip not found for highlight:", clipId);
    return null;
  }

  const newHighlight: Highlight = {
    id: `hl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...highlight,
    created_at: new Date().toISOString(),
  };

  clips[index] = {
    ...clips[index],
    highlights: [...(clips[index].highlights || []), newHighlight],
    updated_at: new Date().toISOString(),
  };

  await chrome.storage.local.set({ [STORAGE_KEY]: clips });
  console.log("[Local Clips] Added highlight:", newHighlight.id);
  return newHighlight;
}

/**
 * Update a highlight's note
 */
export async function updateHighlightNote(
  clipId: string,
  highlightId: string,
  note: string,
): Promise<boolean> {
  const clips = await getLocalClips();
  const clipIndex = clips.findIndex((c) => c.id === clipId);

  if (clipIndex === -1) return false;

  const highlights = clips[clipIndex].highlights || [];
  const hlIndex = highlights.findIndex((h: Highlight) => h.id === highlightId);

  if (hlIndex === -1) return false;

  highlights[hlIndex] = { ...highlights[hlIndex], note };
  clips[clipIndex] = {
    ...clips[clipIndex],
    highlights,
    updated_at: new Date().toISOString(),
  };

  await chrome.storage.local.set({ [STORAGE_KEY]: clips });
  return true;
}

/**
 * Delete a highlight from a clip
 */
export async function deleteHighlight(clipId: string, highlightId: string): Promise<boolean> {
  const clips = await getLocalClips();
  const clipIndex = clips.findIndex((c) => c.id === clipId);

  if (clipIndex === -1) return false;

  const highlights = clips[clipIndex].highlights || [];
  const hlIndex = highlights.findIndex((h: Highlight) => h.id === highlightId);

  if (hlIndex === -1) return false;

  highlights.splice(hlIndex, 1);
  clips[clipIndex] = {
    ...clips[clipIndex],
    highlights,
    updated_at: new Date().toISOString(),
  };

  await chrome.storage.local.set({ [STORAGE_KEY]: clips });
  return true;
}

/**
 * Check if a URL has already been clipped
 */
export async function isUrlClipped(url: string): Promise<LocalClip | null> {
  const clips = await getLocalClips();
  return clips.find((c) => c.url === url) || null;
}

/**
 * Update an existing clip (for re-clipping or updating content)
 * Supports updating both LocalClip and ElementClip fields
 */
export async function updateLocalClip(
  id: string,
  updates: Record<string, unknown>,
): Promise<LocalClip | null> {
  const clips = await getLocalClips();
  const index = clips.findIndex((c) => c.id === id);

  if (index === -1) return null;

  clips[index] = {
    ...clips[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  await chrome.storage.local.set({ [STORAGE_KEY]: clips });
  return clips[index];
}
