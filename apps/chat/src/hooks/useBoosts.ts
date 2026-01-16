import { useState, useEffect, useCallback } from "react";
import type { Boost } from "@repo/shared";

export interface UseBoostsReturn {
  boosts: Boost[];
  boostsByDomain: Record<string, Boost[]>;
  isLoading: boolean;
  toggleBoost: (id: string) => Promise<void>;
  deleteBoost: (id: string) => Promise<void>;
  runBoost: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useBoosts(): UseBoostsReturn {
  const [boosts, setBoosts] = useState<Boost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load boosts from extension service
  const loadBoosts = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await chrome.runtime.sendMessage({
        action: "getBoosts",
      });
      setBoosts(response?.data || []);
    } catch (error) {
      console.error("Failed to load boosts:", error);
      setBoosts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadBoosts();
  }, [loadBoosts]);

  // Group boosts by domain
  const boostsByDomain = boosts.reduce(
    (acc, boost) => {
      const domain = boost.domain || "Other";
      if (!acc[domain]) {
        acc[domain] = [];
      }
      acc[domain].push(boost);
      return acc;
    },
    {} as Record<string, Boost[]>,
  );

  // Sort domains alphabetically and boosts by name within each domain
  Object.keys(boostsByDomain).forEach((domain) => {
    boostsByDomain[domain].sort((a, b) => a.name.localeCompare(b.name));
  });

  const toggleBoost = useCallback(
    async (id: string) => {
      try {
        await chrome.runtime.sendMessage({
          action: "toggleBoost",
          id,
        });
        await loadBoosts();
      } catch (error) {
        console.error("Failed to toggle boost:", error);
      }
    },
    [loadBoosts],
  );

  const deleteBoost = useCallback(
    async (id: string) => {
      try {
        await chrome.runtime.sendMessage({
          action: "deleteBoost",
          id,
        });
        await loadBoosts();
      } catch (error) {
        console.error("Failed to delete boost:", error);
      }
    },
    [loadBoosts],
  );

  const runBoost = useCallback(async (id: string) => {
    try {
      await chrome.runtime.sendMessage({
        action: "runBoost",
        id,
      });
    } catch (error) {
      console.error("Failed to run boost:", error);
    }
  }, []);

  const refresh = useCallback(async () => {
    await loadBoosts();
  }, [loadBoosts]);

  return {
    boosts,
    boostsByDomain,
    isLoading,
    toggleBoost,
    deleteBoost,
    runBoost,
    refresh,
  };
}
