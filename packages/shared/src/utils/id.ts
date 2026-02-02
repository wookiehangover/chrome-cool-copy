/**
 * ID Generation Utilities
 * Functions for generating unique identifiers
 */

/**
 * Generate a UUID using the Web Crypto API
 * @returns A UUID v4 string
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Alias for generateUUID - generates a session ID
 * @returns A UUID v4 string for use as a session ID
 */
export function generateSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a unique clip ID with timestamp and random suffix
 * Format: clip_{timestamp}_{randomSuffix}
 * @returns A unique clip identifier
 */
export function generateClipId(): string {
  return `clip_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generate a generic unique ID with optional prefix
 * @param prefix - Optional prefix for the ID (default: empty)
 * @returns A unique identifier
 */
export function generateId(prefix?: string): string {
  const id = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  return prefix ? `${prefix}_${id}` : id;
}
