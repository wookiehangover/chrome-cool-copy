import { useState, useEffect, useCallback } from "react";

/**
 * Media clip type matching the server's media_clips table schema
 */
export interface MediaClip {
  id: string;
  blob_url: string;
  original_filename: string | null;
  mimetype: string;
  file_size: number | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  page_url: string;
  page_title: string | null;
  ai_description: string | null;
  ai_description_status: string;
  created_at: string;
}

interface ClipsServerConfig {
  baseUrl: string;
  apiToken: string;
}

function readField<Value>(value: Value, key: string) {
  return Object.getOwnPropertyDescriptor(Object(value), key)?.value;
}

function readString<Value>(value: Value): string | undefined {
  return Object.prototype.toString.call(value) === "[object String]" ? String(value) : undefined;
}

function readNullableString<Value>(value: Value): string | null | undefined {
  return value === null ? null : readString(value);
}

function readNullableNumber<Value>(value: Value): number | null | undefined {
  if (value === null) return null;
  return Object.prototype.toString.call(value) === "[object Number]" ? Number(value) : undefined;
}

function parseServerConfig<Value>(value: Value): ClipsServerConfig | null {
  const baseUrl = readString(readField(value, "baseUrl"));
  const apiToken = readString(readField(value, "apiToken"));
  return baseUrl && apiToken !== undefined ? { baseUrl, apiToken } : null;
}

function parseMediaClip<Value>(value: Value): MediaClip | null {
  const id = readString(readField(value, "id"));
  const blobUrl = readString(readField(value, "blob_url"));
  const originalFilename = readNullableString(readField(value, "original_filename"));
  const mimetype = readString(readField(value, "mimetype"));
  const fileSize = readNullableNumber(readField(value, "file_size"));
  const width = readNullableNumber(readField(value, "width"));
  const height = readNullableNumber(readField(value, "height"));
  const altText = readNullableString(readField(value, "alt_text"));
  const pageUrl = readString(readField(value, "page_url"));
  const pageTitle = readNullableString(readField(value, "page_title"));
  const aiDescription = readNullableString(readField(value, "ai_description"));
  const aiDescriptionStatus = readString(readField(value, "ai_description_status"));
  const createdAt = readString(readField(value, "created_at"));

  if (
    !id ||
    !blobUrl ||
    originalFilename === undefined ||
    !mimetype ||
    fileSize === undefined ||
    width === undefined ||
    height === undefined ||
    altText === undefined ||
    !pageUrl ||
    pageTitle === undefined ||
    aiDescription === undefined ||
    !aiDescriptionStatus ||
    !createdAt
  ) {
    return null;
  }

  return {
    id,
    blob_url: blobUrl,
    original_filename: originalFilename,
    mimetype,
    file_size: fileSize,
    width,
    height,
    alt_text: altText,
    page_url: pageUrl,
    page_title: pageTitle,
    ai_description: aiDescription,
    ai_description_status: aiDescriptionStatus,
    created_at: createdAt,
  };
}

function parseMediaClips<Value>(value: Value): MediaClip[] {
  const clips = readField(value, "clips");
  return Array.isArray(clips) ? clips.map(parseMediaClip).filter((clip) => clip !== null) : [];
}

export interface UseMediaClipsReturn {
  mediaClips: MediaClip[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  deleteMediaClip: (id: string) => Promise<void>;
}

/**
 * Hook to fetch media clips from the clips server.
 * Reads server URL and auth token from chrome.storage.sync.
 */
export function useMediaClips(): UseMediaClipsReturn {
  const [mediaClips, setMediaClips] = useState<MediaClip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMediaClips = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get server config from chrome.storage.sync (matches settings page storage format)
      const result = await chrome.storage.sync.get(["clipsServerConfig"]);
      const clipsServerConfig = parseServerConfig(result.clipsServerConfig);

      if (!clipsServerConfig?.baseUrl) {
        // Server not configured - this is not an error, just means no media clips
        setMediaClips([]);
        return;
      }

      // Fetch media clips from server
      const headers = new Headers();
      if (clipsServerConfig.apiToken) {
        headers.set("Authorization", `Bearer ${clipsServerConfig.apiToken}`);
      }

      const response = await fetch(`${clipsServerConfig.baseUrl}/api/media/list?limit=50`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch media clips: ${response.statusText}`);
      }

      const data = parseMediaClips(await response.json());
      setMediaClips(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to load media clips";
      console.error("Failed to load media clips:", err);
      setError(errorMsg);
      setMediaClips([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadMediaClips();
  }, [loadMediaClips]);

  const refresh = useCallback(async () => {
    await loadMediaClips();
  }, [loadMediaClips]);

  const deleteMediaClip = useCallback(
    async (id: string) => {
      const result = await chrome.storage.sync.get(["clipsServerConfig"]);
      const clipsServerConfig = parseServerConfig(result.clipsServerConfig);

      if (!clipsServerConfig?.baseUrl) {
        throw new Error("Server not configured");
      }

      const headers = new Headers({ "Content-Type": "application/json" });
      if (clipsServerConfig.apiToken) {
        headers.set("Authorization", `Bearer ${clipsServerConfig.apiToken}`);
      }

      const response = await fetch(`${clipsServerConfig.baseUrl}/api/media/delete`, {
        method: "DELETE",
        headers,
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete media clip: ${response.statusText}`);
      }

      await loadMediaClips();
    },
    [loadMediaClips],
  );

  return {
    mediaClips,
    isLoading,
    error,
    refresh,
    deleteMediaClip,
  };
}
