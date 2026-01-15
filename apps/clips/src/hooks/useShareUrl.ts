import { useCallback } from "react";
import { showToast } from "@/lib/toast";

/**
 * Hook to get and copy share URL for a clip
 * Handles reading shareServerHostname from chrome.storage.sync
 */
export function useShareUrl() {
  const getShareUrl = useCallback(async (shareId: string): Promise<string> => {
    const { shareServerHostname } = (await chrome.storage.sync.get({
      shareServerHostname: "localhost:5173",
    })) as { shareServerHostname: string };

    // Ensure protocol
    const host = shareServerHostname.startsWith("http")
      ? shareServerHostname
      : `https://${shareServerHostname}`;

    return `${host}/share/${shareId}`;
  }, []);

  const copyShareUrl = useCallback(
    async (shareId: string): Promise<boolean> => {
      try {
        const url = await getShareUrl(shareId);
        await navigator.clipboard.writeText(url);
        showToast("Share URL copied!");
        return true;
      } catch (error) {
        console.error("Failed to copy share URL:", error);
        showToast("Failed to copy share URL");
        return false;
      }
    },
    [getShareUrl],
  );

  return { getShareUrl, copyShareUrl };
}

