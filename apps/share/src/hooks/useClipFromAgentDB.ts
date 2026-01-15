/**
 * React hook for fetching clips from AgentDB by share_id
 */

import { useEffect, useState } from "react";
import { getClipByShareId, SharedClip } from "../lib/agentdb";

/**
 * Hook state interface
 */
interface UseClipState {
  clip: SharedClip | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for fetching a clip from AgentDB by share_id
 * @param shareId - The share_id to fetch
 * @returns Object containing clip data, loading state, and error
 */
export function useClipFromAgentDB(shareId: string): UseClipState {
  const [state, setState] = useState<UseClipState>({
    clip: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    const fetchClip = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        const clip = await getClipByShareId(shareId);

        if (isMounted) {
          setState({
            clip,
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        if (isMounted) {
          const error = err instanceof Error ? err : new Error(String(err));
          setState({
            clip: null,
            loading: false,
            error,
          });
        }
      }
    };

    fetchClip();

    return () => {
      isMounted = false;
    };
  }, [shareId]);

  return state;
}

