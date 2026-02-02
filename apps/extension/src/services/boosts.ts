/**
 * Boost Storage Service
 * Manages storage of custom JavaScript boosts using chrome.storage.local
 */

import type { Boost } from "@repo/shared";

export type { Boost } from "@repo/shared";

const STORAGE_KEY = "boosts";

/**
 * Get all boosts
 */
export async function getBoosts(): Promise<Boost[]> {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  const boosts = (result[STORAGE_KEY] as Boost[] | undefined) || [];
  return boosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Get a single boost by ID
 */
export async function getBoost(id: string): Promise<Boost | null> {
  const boosts = await getBoosts();
  return boosts.find((b) => b.id === id) || null;
}

/**
 * Get enabled boosts matching a domain
 */
export async function getBoostsForDomain(hostname: string): Promise<Boost[]> {
  const boosts = await getBoosts();
  return boosts.filter((b) => b.enabled && matchesDomain(b.domain, hostname));
}

/**
 * Save a new boost
 */
export async function saveBoost(
  input: Omit<Boost, "id" | "createdAt" | "updatedAt">,
): Promise<Boost> {
  const boosts = await getBoosts();
  const now = new Date().toISOString();

  const newBoost: Boost = {
    id: `boost_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    ...input,
    createdAt: now,
    updatedAt: now,
  };

  boosts.push(newBoost);
  await chrome.storage.local.set({ [STORAGE_KEY]: boosts });

  console.log("[Boosts] Saved boost:", newBoost.id, newBoost.name);
  return newBoost;
}

/**
 * Update an existing boost
 */
export async function updateBoost(id: string, updates: Partial<Boost>): Promise<Boost | null> {
  const boosts = await getBoosts();
  const index = boosts.findIndex((b) => b.id === id);

  if (index === -1) {
    console.warn("[Boosts] Boost not found for update:", id);
    return null;
  }

  boosts[index] = {
    ...boosts[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await chrome.storage.local.set({ [STORAGE_KEY]: boosts });
  console.log("[Boosts] Updated boost:", id);
  return boosts[index];
}

/**
 * Delete a boost
 */
export async function deleteBoost(id: string): Promise<boolean> {
  const boosts = await getBoosts();
  const index = boosts.findIndex((b) => b.id === id);

  if (index === -1) {
    console.warn("[Boosts] Boost not found for deletion:", id);
    return false;
  }

  boosts.splice(index, 1);
  await chrome.storage.local.set({ [STORAGE_KEY]: boosts });

  console.log("[Boosts] Deleted boost:", id);
  return true;
}

/**
 * Toggle the enabled state of a boost
 */
export async function toggleBoost(id: string): Promise<Boost | null> {
  const boost = await getBoost(id);
  if (!boost) return null;

  return updateBoost(id, { enabled: !boost.enabled });
}

/**
 * Domain pattern matching
 * - "github.com" matches only github.com
 * - "*.github.com" matches subdomains (gist.github.com) AND the base domain (github.com)
 * - "*" matches everything
 */
export function matchesDomain(pattern: string, hostname: string): boolean {
  if (pattern === "*") {
    return true;
  }

  if (pattern === hostname) {
    return true;
  }

  if (pattern.startsWith("*.")) {
    const baseDomain = pattern.slice(2); // Remove "*."
    // Match subdomains and the base domain itself
    return hostname === baseDomain || hostname.endsWith("." + baseDomain);
  }

  return false;
}
