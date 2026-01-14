/**
 * IndexedDB Asset Store Service
 * Manages storage and retrieval of binary assets (screenshots, images, etc.)
 * for element clips using IndexedDB
 */

import type { ClipAsset } from "@repo/shared/types";

const DB_NAME = "clip-assets";
const STORE_NAME = "assets";
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

/**
 * Initialize the IndexedDB database for asset storage
 * Creates the database and object store if they don't exist
 */
export async function initAssetStore(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open IndexedDB: ${request.error}`));
    };

    request.onsuccess = () => {
      db = request.result;
      console.log("[Asset Store] Database initialized successfully");
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create object store with keyPath 'id'
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        // Create index on clipId for efficient lookups
        store.createIndex("clipId", "clipId", { unique: false });
        console.log("[Asset Store] Object store created with clipId index");
      }
    };
  });
}

/**
 * Save an asset (blob) to IndexedDB
 * @param clipId - ID of the parent clip
 * @param type - Type of asset (screenshot, image, video, background)
 * @param blob - Binary data to store
 * @param originalUrl - Optional original URL of the asset
 * @returns Promise resolving to the asset ID
 */
export async function saveAsset(
  clipId: string,
  type: ClipAsset["type"],
  blob: Blob,
  originalUrl?: string,
): Promise<string> {
  if (!db) {
    throw new Error("Asset store not initialized. Call initAssetStore() first.");
  }

  const assetId = `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const asset: ClipAsset = {
    id: assetId,
    clipId,
    type,
    mimeType: blob.type || "application/octet-stream",
    data: blob,
    originalUrl,
    createdAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(asset);

    request.onerror = () => {
      reject(new Error(`Failed to save asset: ${request.error}`));
    };

    request.onsuccess = () => {
      console.log("[Asset Store] Asset saved:", assetId);
      resolve(assetId);
    };
  });
}

/**
 * Retrieve an asset blob by ID
 * @param assetId - ID of the asset to retrieve
 * @returns Promise resolving to the blob or null if not found
 */
export async function getAsset(assetId: string): Promise<Blob | null> {
  if (!db) {
    throw new Error("Asset store not initialized. Call initAssetStore() first.");
  }

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(assetId);

    request.onerror = () => {
      reject(new Error(`Failed to get asset: ${request.error}`));
    };

    request.onsuccess = () => {
      const asset = request.result as ClipAsset | undefined;
      resolve(asset ? asset.data : null);
    };
  });
}

/**
 * Convert an asset blob to a data URL for use in img src
 * @param assetId - ID of the asset
 * @returns Promise resolving to data URL or null if asset not found
 */
export async function getAssetAsDataUrl(assetId: string): Promise<string | null> {
  const blob = await getAsset(assetId);
  if (!blob) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      reject(new Error("Failed to read asset as data URL"));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Delete all assets associated with a clip
 * @param clipId - ID of the clip
 */
export async function deleteClipAssets(clipId: string): Promise<void> {
  if (!db) {
    throw new Error("Asset store not initialized. Call initAssetStore() first.");
  }

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("clipId");
    const request = index.getAll(clipId);

    request.onerror = () => {
      reject(new Error(`Failed to query assets: ${request.error}`));
    };

    request.onsuccess = () => {
      const assets = request.result as ClipAsset[];
      let deleteCount = 0;

      if (assets.length === 0) {
        resolve();
        return;
      }

      assets.forEach((asset) => {
        const deleteRequest = store.delete(asset.id);
        deleteRequest.onsuccess = () => {
          deleteCount++;
          if (deleteCount === assets.length) {
            console.log("[Asset Store] Deleted", deleteCount, "assets for clip:", clipId);
            resolve();
          }
        };
        deleteRequest.onerror = () => {
          reject(new Error(`Failed to delete asset: ${deleteRequest.error}`));
        };
      });
    };
  });
}

/**
 * Delete a single asset by ID
 * @param assetId - ID of the asset to delete
 */
export async function deleteAsset(assetId: string): Promise<void> {
  if (!db) {
    throw new Error("Asset store not initialized. Call initAssetStore() first.");
  }

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(assetId);

    request.onerror = () => {
      reject(new Error(`Failed to delete asset: ${request.error}`));
    };

    request.onsuccess = () => {
      console.log("[Asset Store] Asset deleted:", assetId);
      resolve();
    };
  });
}
