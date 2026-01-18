/**
 * Progressive Tidy Chunk Helpers
 *
 * Utilities for managing progressive content updates during the tidy process.
 * Chunks are wrapped with data-tidy-chunk attributes and can show loading states
 * while being processed, then update with new content when complete.
 */

export interface TidyChunk {
  id: string;
  content: string;
}

/**
 * Wrap existing content in chunk divs for progressive updates.
 * Each chunk will have a data-tidy-chunk attribute with its ID.
 *
 * @param container - The container element holding the content
 * @param chunks - Array of chunks with IDs and content
 */
export function wrapContentInChunks(
  container: HTMLElement,
  chunks: TidyChunk[],
): void {
  // Clear existing content
  container.innerHTML = "";

  for (const chunk of chunks) {
    const chunkDiv = document.createElement("div");
    chunkDiv.setAttribute("data-tidy-chunk", chunk.id);
    chunkDiv.innerHTML = chunk.content;
    container.appendChild(chunkDiv);
  }
}

/**
 * Find a chunk element by its ID within a container or shadow root.
 *
 * @param root - The root element or shadow root to search in
 * @param chunkId - The chunk ID to find
 * @returns The chunk element or null if not found
 */
export function findChunk(
  root: HTMLElement | ShadowRoot | Document,
  chunkId: string,
): HTMLElement | null {
  return root.querySelector(`[data-tidy-chunk="${chunkId}"]`) as HTMLElement | null;
}

/**
 * Mark a chunk as loading. Adds the tidy-loading class which shows
 * a subtle left border accent and pulse animation.
 *
 * @param root - The root element or shadow root to search in
 * @param chunkId - The ID of the chunk to mark as loading
 * @returns true if the chunk was found and marked, false otherwise
 */
export function markChunkLoading(
  root: HTMLElement | ShadowRoot | Document,
  chunkId: string,
): boolean {
  const chunk = findChunk(root, chunkId);
  if (!chunk) {
    console.warn(`[Tidy Chunks] Chunk not found: ${chunkId}`);
    return false;
  }

  chunk.classList.add("tidy-loading");
  return true;
}

/**
 * Mark a chunk as complete, replacing its content with new HTML
 * and removing the loading state.
 *
 * @param root - The root element or shadow root to search in
 * @param chunkId - The ID of the chunk to update
 * @param newHtml - The new HTML content for the chunk
 * @returns true if the chunk was found and updated, false otherwise
 */
export function markChunkComplete(
  root: HTMLElement | ShadowRoot | Document,
  chunkId: string,
  newHtml: string,
): boolean {
  const chunk = findChunk(root, chunkId);
  if (!chunk) {
    console.warn(`[Tidy Chunks] Chunk not found: ${chunkId}`);
    return false;
  }

  // Update content
  chunk.innerHTML = newHtml;

  // Remove loading state
  chunk.classList.remove("tidy-loading");

  return true;
}

/**
 * Mark all chunks as loading at once.
 *
 * @param root - The root element or shadow root to search in
 */
export function markAllChunksLoading(
  root: HTMLElement | ShadowRoot | Document,
): void {
  const chunks = root.querySelectorAll("[data-tidy-chunk]");
  chunks.forEach((chunk) => {
    chunk.classList.add("tidy-loading");
  });
}

/**
 * Clear loading state from all chunks without updating content.
 *
 * @param root - The root element or shadow root to search in
 */
export function clearAllLoadingStates(
  root: HTMLElement | ShadowRoot | Document,
): void {
  const chunks = root.querySelectorAll(".tidy-loading");
  chunks.forEach((chunk) => {
    chunk.classList.remove("tidy-loading");
  });
}

/**
 * Get all chunk IDs currently in the container.
 *
 * @param root - The root element or shadow root to search in
 * @returns Array of chunk IDs
 */
export function getChunkIds(
  root: HTMLElement | ShadowRoot | Document,
): string[] {
  const chunks = root.querySelectorAll("[data-tidy-chunk]");
  return Array.from(chunks).map(
    (chunk) => chunk.getAttribute("data-tidy-chunk") || "",
  ).filter(Boolean);
}

