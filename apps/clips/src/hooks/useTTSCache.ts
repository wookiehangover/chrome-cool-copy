/**
 * IndexedDB-based audio cache for TTS.
 *
 * Storage design:
 * - Key: clip ID (unique identifier for each clip)
 * - Value: { blob, voiceId, textHash, size, createdAt }
 * - Max size: 50MB (LRU eviction)
 */

const DB_NAME = "tts-cache";
const STORE_NAME = "audio";
const DB_VERSION = 1;
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB

interface CacheEntry {
  clipId: string;
  blob: Blob;
  voiceId: string;
  textHash: string;
  size: number;
  createdAt: number;
  lastAccessedAt: number;
}

// Simple hash function for text content
function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "clipId" });
        store.createIndex("lastAccessedAt", "lastAccessedAt");
        store.createIndex("size", "size");
      }
    };
  });

  return dbPromise;
}

/**
 * Get cached audio for a clip
 * @returns Blob URL if cached and valid, null otherwise
 */
export async function getCachedAudio(
  clipId: string,
  textContent: string,
  voiceId: string = "alba",
): Promise<string | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const entry: CacheEntry | undefined = await new Promise((resolve, reject) => {
      const request = store.get(clipId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    if (!entry) return null;

    // Validate cache - check if text/voice matches
    const currentHash = hashText(textContent);
    if (entry.textHash !== currentHash || entry.voiceId !== voiceId) {
      // Content changed, invalidate cache
      store.delete(clipId);
      console.log("[TTS Cache] Invalidated - content or voice changed");
      return null;
    }

    // Update last accessed time
    entry.lastAccessedAt = Date.now();
    store.put(entry);

    console.log("[TTS Cache] Hit! Size:", (entry.size / 1024).toFixed(1), "KB");
    return URL.createObjectURL(entry.blob);
  } catch (error) {
    console.error("[TTS Cache] Error getting cached audio:", error);
    return null;
  }
}

/**
 * Cache audio for a clip
 */
export async function cacheAudio(
  clipId: string,
  blob: Blob,
  textContent: string,
  voiceId: string = "alba",
): Promise<void> {
  try {
    const db = await openDB();

    // First, check total cache size and evict if needed
    await evictIfNeeded(db, blob.size);

    const entry: CacheEntry = {
      clipId,
      blob,
      voiceId,
      textHash: hashText(textContent),
      size: blob.size,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
    };

    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.put(entry);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });

    console.log("[TTS Cache] Stored:", (blob.size / 1024).toFixed(1), "KB for clip", clipId);
  } catch (error) {
    console.error("[TTS Cache] Error caching audio:", error);
  }
}

/**
 * Evict oldest entries if cache is too large
 */
async function evictIfNeeded(db: IDBDatabase, incomingSize: number): Promise<void> {
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const index = store.index("lastAccessedAt");

  // Get all entries sorted by last accessed time (oldest first)
  const entries: CacheEntry[] = await new Promise((resolve, reject) => {
    const request = index.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });

  // Calculate total size
  let totalSize = entries.reduce((sum, e) => sum + e.size, 0);

  // Evict oldest entries until we have room
  for (const entry of entries) {
    if (totalSize + incomingSize <= MAX_CACHE_SIZE) break;

    console.log("[TTS Cache] Evicting:", entry.clipId, (entry.size / 1024).toFixed(1), "KB");
    store.delete(entry.clipId);
    totalSize -= entry.size;
  }
}
