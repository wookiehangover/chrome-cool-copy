/**
 * Grokipedia Page Existence Checker
 * Checks if a Grokipedia page exists via background script with session-based caching
 */

const CACHE_KEY_PREFIX = "grokipedia_cache_";
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  exists: boolean;
  timestamp: number;
}

/**
 * Get cache key for an article title
 * @param title - The article title
 * @returns Cache key for sessionStorage
 */
function getCacheKey(title: string): string {
  return CACHE_KEY_PREFIX + title.toLowerCase();
}

/**
 * Get cached result if available and not expired
 * @param title - The article title
 * @returns Cached result or null if not found or expired
 */
function getCachedResult(title: string): boolean | null {
  try {
    const cacheKey = getCacheKey(title);
    const cached = sessionStorage.getItem(cacheKey);

    if (!cached) {
      return null;
    }

    const entry: CacheEntry = JSON.parse(cached);
    const now = Date.now();

    // Check if cache has expired
    if (now - entry.timestamp > CACHE_EXPIRY_MS) {
      sessionStorage.removeItem(cacheKey);
      return null;
    }

    return entry.exists;
  } catch (error) {
    console.error("Error reading Grokipedia cache:", error);
    return null;
  }
}

/**
 * Store result in cache
 * @param title - The article title
 * @param exists - Whether the page exists
 */
function setCachedResult(title: string, exists: boolean): void {
  try {
    const cacheKey = getCacheKey(title);
    const entry: CacheEntry = {
      exists,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch (error) {
    console.error("Error writing to Grokipedia cache:", error);
    // Fail silently - cache is optional
  }
}

/**
 * Check if a Grokipedia page exists for the given article title
 * Sends request to background script to avoid CORS issues
 * Results are cached in sessionStorage to minimize network calls
 *
 * @param articleTitle - The article title to check
 * @returns Promise<boolean> - true if page exists, false otherwise
 */
export async function checkGrokipediaPageExists(
  articleTitle: string
): Promise<boolean> {
  if (!articleTitle || typeof articleTitle !== "string") {
    return false;
  }

  // Check cache first
  const cached = getCachedResult(articleTitle);
  if (cached !== null) {
    return cached;
  }

  try {
    // Send message to background script to check (avoids CORS)
    const response = await chrome.runtime.sendMessage({
      action: "checkGrokipediaExists",
      articleTitle: articleTitle,
    });

    const exists = response?.success && response?.exists === true;

    // Cache the result
    setCachedResult(articleTitle, exists);

    return exists;
  } catch (error) {
    // Handle errors gracefully
    console.error(
      `Error checking Grokipedia page for "${articleTitle}":`,
      error
    );
    // Return false on error to fail silently
    return false;
  }
}

/**
 * Clear the Grokipedia cache
 * Useful for testing or manual cache invalidation
 */
export function clearGrokipediaCache(): void {
  try {
    const keys = Object.keys(sessionStorage);
    keys.forEach((key) => {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        sessionStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error("Error clearing Grokipedia cache:", error);
  }
}

