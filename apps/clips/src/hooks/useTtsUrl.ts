import { useState, useEffect, useCallback } from "react";

const TTS_URL_STORAGE_KEY = "tts_url";
const LEGACY_TTS_URL_STORAGE_KEY = "clips-tts-url";
export const DEFAULT_TTS_URL = "http://localhost:8000";

export interface UseTtsUrlReturn {
  ttsUrl: string;
  setTtsUrl: (url: string) => Promise<void>;
  isLoading: boolean;
}

/**
 * Hook to manage TTS server URL from chrome.storage.sync
 * Auto-saves changes and provides reactive updates
 */
export function useTtsUrl(): UseTtsUrlReturn {
  const [ttsUrl, setTtsUrlState] = useState<string>(DEFAULT_TTS_URL);
  const [isLoading, setIsLoading] = useState(true);

  // Load TTS URL on mount
  useEffect(() => {
    const loadTtsUrl = async () => {
      try {
        const syncResult = await chrome.storage.sync.get([TTS_URL_STORAGE_KEY]);
        let storedUrl = syncResult[TTS_URL_STORAGE_KEY] as string | undefined;

        if (!storedUrl) {
          const localResult = await chrome.storage.local.get([
            TTS_URL_STORAGE_KEY,
            LEGACY_TTS_URL_STORAGE_KEY,
          ]);
          storedUrl =
            (localResult[TTS_URL_STORAGE_KEY] as string | undefined) ||
            (localResult[LEGACY_TTS_URL_STORAGE_KEY] as string | undefined);

          if (storedUrl) {
            await chrome.storage.sync.set({ [TTS_URL_STORAGE_KEY]: storedUrl });
          }
        }

        if (storedUrl) {
          setTtsUrlState(storedUrl);
        }
      } catch (err) {
        console.error("Failed to load TTS URL:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadTtsUrl();
  }, []);

  // Listen for storage changes from other contexts
  useEffect(() => {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName !== "sync" || !changes[TTS_URL_STORAGE_KEY]) {
        return;
      }

      const newValue = changes[TTS_URL_STORAGE_KEY].newValue as string | undefined;
      if (newValue !== undefined) {
        setTtsUrlState(newValue);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);

  const setTtsUrl = useCallback(async (url: string) => {
    try {
      await chrome.storage.sync.set({ [TTS_URL_STORAGE_KEY]: url });
      setTtsUrlState(url);
    } catch (err) {
      console.error("Failed to save TTS URL:", err);
      throw err;
    }
  }, []);

  return {
    ttsUrl,
    setTtsUrl,
    isLoading,
  };
}

/**
 * Get the TTS URL directly from storage (for use outside React components)
 */
export async function getTtsUrl(): Promise<string> {
  try {
    const syncResult = await chrome.storage.sync.get([TTS_URL_STORAGE_KEY]);
    let storedUrl = syncResult[TTS_URL_STORAGE_KEY] as string | undefined;

    if (!storedUrl) {
      const localResult = await chrome.storage.local.get([
        TTS_URL_STORAGE_KEY,
        LEGACY_TTS_URL_STORAGE_KEY,
      ]);
      storedUrl =
        (localResult[TTS_URL_STORAGE_KEY] as string | undefined) ||
        (localResult[LEGACY_TTS_URL_STORAGE_KEY] as string | undefined);
    }

    return storedUrl || DEFAULT_TTS_URL;
  } catch (err) {
    console.error("Failed to get TTS URL:", err);
    return DEFAULT_TTS_URL;
  }
}
