import { useState, useEffect, useCallback } from "react";
import { sendMessage } from "@repo/shared";
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
      const data = await sendMessage<Boost[]>({ action: "getBoosts" }, { responseKey: "data" });
      setBoosts(data || []);
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
  const boostsByDomain = boosts.reduce<Record<string, Boost[]>>((acc, boost) => {
    const domain = boost.domain || "Other";
    if (!acc[domain]) {
      acc[domain] = [];
    }
    acc[domain].push(boost);
    return acc;
  }, {});

  // Sort domains alphabetically and boosts by name within each domain
  Object.keys(boostsByDomain).forEach((domain) => {
    boostsByDomain[domain].sort((a, b) => a.name.localeCompare(b.name));
  });

  const toggleBoost = useCallback(
    async (id: string) => {
      try {
        await sendMessage({ action: "toggleBoost", id });
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
        await sendMessage({ action: "deleteBoost", id });
        await loadBoosts();
      } catch (error) {
        console.error("Failed to delete boost:", error);
      }
    },
    [loadBoosts],
  );

  const runBoost = useCallback(async (id: string) => {
    try {
      await sendMessage({ action: "runBoost", id });
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
