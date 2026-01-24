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

interface MediaClipsResponse {
  clips: MediaClip[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UseMediaClipsReturn {
  mediaClips: MediaClip[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
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
      const clipsServerConfig = result.clipsServerConfig as
        | { baseUrl: string; apiToken: string }
        | undefined;

      if (!clipsServerConfig?.baseUrl) {
        // Server not configured - this is not an error, just means no media clips
        setMediaClips([]);
        return;
      }

      // Fetch media clips from server
      const headers: Record<string, string> = {};
      if (clipsServerConfig.apiToken) {
        headers["Authorization"] = `Bearer ${clipsServerConfig.apiToken}`;
      }

      const response = await fetch(`${clipsServerConfig.baseUrl}/api/media/list?limit=50`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch media clips: ${response.statusText}`);
      }

      const data = (await response.json()) as MediaClipsResponse;
      setMediaClips(data.clips || []);
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

  return {
    mediaClips,
    isLoading,
    error,
    refresh,
  };
}
