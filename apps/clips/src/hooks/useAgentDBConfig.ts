import { useState, useEffect, useCallback } from "react";

export interface UseAgentDBConfigReturn {
  isConfigured: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAgentDBConfig(): UseAgentDBConfigReturn {
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if AgentDB is configured
  const checkConfiguration = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await chrome.runtime.sendMessage({
        action: "isAgentDBConfigured",
      });
      setIsConfigured(response?.data ?? false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to check AgentDB configuration";
      console.error("Failed to check AgentDB configuration:", err);
      setError(errorMsg);
      setIsConfigured(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial check on mount
  useEffect(() => {
    checkConfiguration();
  }, [checkConfiguration]);

  const refresh = useCallback(async () => {
    await checkConfiguration();
  }, [checkConfiguration]);

  return {
    isConfigured,
    isLoading,
    error,
    refresh,
  };
}
