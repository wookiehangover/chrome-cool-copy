import { useState, useEffect, useCallback } from "react";
import type { LocalClip, Clip } from "@repo/shared";

export interface SyncResult {
  imported: number;
  skipped: number;
  failed: number;
  total: number;
}

export interface UseClipsReturn {
  clips: Clip[];
  isLoading: boolean;
  error: string | null;
  getClips: () => Promise<Clip[]>;
  getClip: (id: string) => Promise<Clip | null>;
  deleteClip: (id: string) => Promise<void>;
  syncClips: () => Promise<SyncResult>;
  updateClip: (id: string, updates: Partial<LocalClip>) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useClips(): UseClipsReturn {
  const [clips, setClips] = useState<Clip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load clips from extension service
  const loadClips = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await chrome.runtime.sendMessage({
        action: "getLocalClips",
      });
      setClips(response?.data || []);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to load clips";
      console.error("Failed to load clips:", err);
      setError(errorMsg);
      setClips([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadClips();
  }, [loadClips]);

  const getClips = useCallback(async (): Promise<Clip[]> => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "getLocalClips",
      });
      return response?.data || [];
    } catch (err) {
      console.error("Failed to get clips:", err);
      return [];
    }
  }, []);

  const getClip = useCallback(async (id: string): Promise<Clip | null> => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "getLocalClip",
        clipId: id,
      });
      return response?.data || null;
    } catch (err) {
      console.error("Failed to get clip:", err);
      return null;
    }
  }, []);

  const deleteClip = useCallback(
    async (id: string) => {
      try {
        await chrome.runtime.sendMessage({
          action: "deleteClipWithSync",
          clipId: id,
        });
        await loadClips();
      } catch (err) {
        console.error("Failed to delete clip:", err);
        throw err;
      }
    },
    [loadClips],
  );

  const syncClips = useCallback(async (): Promise<SyncResult> => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "syncFromAgentDB",
      });
      // Reload clips after sync completes
      await loadClips();
      return response?.data || { imported: 0, skipped: 0, failed: 0, total: 0 };
    } catch (err) {
      console.error("Failed to sync clips:", err);
      return { imported: 0, skipped: 0, failed: 0, total: 0 };
    }
  }, [loadClips]);

  const updateClip = useCallback(
    async (id: string, updates: Partial<LocalClip>) => {
      try {
        await chrome.runtime.sendMessage({
          action: "updateLocalClip",
          clipId: id,
          updates,
        });
        await loadClips();
      } catch (err) {
        console.error("Failed to update clip:", err);
        throw err;
      }
    },
    [loadClips],
  );

  const refresh = useCallback(async () => {
    await loadClips();
  }, [loadClips]);

  return {
    clips,
    isLoading,
    error,
    getClips,
    getClip,
    deleteClip,
    syncClips,
    updateClip,
    refresh,
  };
}
