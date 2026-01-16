/**
 * Chrome Storage Utilities
 * Wrapper functions for chrome.storage API with Promise-based interface
 */

/**
 * Get a value from chrome.storage.local
 * @param key - The storage key to retrieve
 * @returns Promise resolving to the stored value or undefined
 */
export async function getStorageItem<T = unknown>(key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve((result[key] as T) || undefined);
    });
  });
}

/**
 * Set a value in chrome.storage.local
 * @param key - The storage key
 * @param value - The value to store
 */
export async function setStorageItem<T = unknown>(key: string, value: T): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => {
      resolve();
    });
  });
}

/**
 * Remove a value from chrome.storage.local
 * @param key - The storage key to remove
 */
export async function removeStorageItem(key: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove([key], () => {
      resolve();
    });
  });
}

/**
 * Get multiple values from chrome.storage.local
 * @param keys - Array of storage keys to retrieve
 * @returns Promise resolving to an object with key-value pairs
 */
export async function getStorageItems<T = Record<string, unknown>>(keys: string[]): Promise<T> {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => {
      resolve((result as T) || ({} as T));
    });
  });
}

/**
 * Clear all items from chrome.storage.local
 */
export async function clearStorage(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.clear(() => {
      resolve();
    });
  });
}
