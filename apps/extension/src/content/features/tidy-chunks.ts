/**
 * Manual Tidy Chunk UI Helpers
 *
 * Utilities for managing manual chunk-by-chunk content tidying.
 * Each chunk displays action buttons (Tidy and Remove) on hover,
 * allowing users to selectively clean or remove content sections.
 */

export interface TidyChunk {
  id: string;
  content: string;
}

/** Callback type for tidy button click */
export type TidyClickHandler = (chunkId: string) => void;

// SVG icons for chunk action buttons (16x16 viewBox)
const TIDY_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
  <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4"/>
</svg>`;

const REMOVE_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
  <path d="M4 4l8 8M12 4l-8 8"/>
</svg>`;

/**
 * Create the controls container with Tidy and Remove buttons for a chunk.
 *
 * @param chunkId - The ID of the chunk these controls belong to
 * @returns The controls container element
 */
function createChunkControls(chunkId: string): HTMLElement {
  const controls = document.createElement("div");
  controls.className = "tidy-chunk-controls";
  controls.setAttribute("data-chunk-controls", chunkId);

  // Tidy button
  const tidyBtn = document.createElement("button");
  tidyBtn.className = "tidy-chunk-btn tidy-chunk-btn-tidy";
  tidyBtn.setAttribute("data-action", "tidy");
  tidyBtn.setAttribute("title", "Tidy this section");
  tidyBtn.innerHTML = TIDY_ICON;

  // Remove button
  const removeBtn = document.createElement("button");
  removeBtn.className = "tidy-chunk-btn tidy-chunk-btn-remove";
  removeBtn.setAttribute("data-action", "remove");
  removeBtn.setAttribute("title", "Remove this section");
  removeBtn.innerHTML = REMOVE_ICON;

  controls.appendChild(tidyBtn);
  controls.appendChild(removeBtn);

  return controls;
}

/**
 * Wrap existing content in chunk divs with action buttons for manual tidying.
 * Each chunk will have a data-tidy-chunk attribute and Tidy/Remove buttons.
 *
 * @param container - The container element holding the content
 * @param chunks - Array of chunks with IDs and content
 * @param onTidyClick - Callback when Tidy button is clicked
 */
export function wrapContentInChunks(
  container: HTMLElement,
  chunks: TidyChunk[],
  onTidyClick?: TidyClickHandler,
): void {
  // Clear existing content
  container.innerHTML = "";

  for (const chunk of chunks) {
    const chunkDiv = document.createElement("div");
    chunkDiv.className = "tidy-chunk";
    chunkDiv.setAttribute("data-tidy-chunk", chunk.id);

    // Add content wrapper to keep controls separate
    const contentWrapper = document.createElement("div");
    contentWrapper.className = "tidy-chunk-content";
    contentWrapper.innerHTML = chunk.content;

    // Add controls
    const controls = createChunkControls(chunk.id);

    chunkDiv.appendChild(controls);
    chunkDiv.appendChild(contentWrapper);
    container.appendChild(chunkDiv);

    // Attach event listeners
    const tidyBtn = controls.querySelector('[data-action="tidy"]') as HTMLButtonElement;
    const removeBtn = controls.querySelector('[data-action="remove"]') as HTMLButtonElement;

    if (tidyBtn && onTidyClick) {
      tidyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        onTidyClick(chunk.id);
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        removeChunk(container, chunk.id);
      });
    }
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
 * Remove a specific chunk from the DOM.
 *
 * @param root - The root element or shadow root to search in
 * @param chunkId - The ID of the chunk to remove
 * @returns true if the chunk was found and removed, false otherwise
 */
export function removeChunk(
  root: HTMLElement | ShadowRoot | Document,
  chunkId: string,
): boolean {
  const chunk = findChunk(root, chunkId);
  if (!chunk) {
    console.warn(`[Tidy Chunks] Chunk not found for removal: ${chunkId}`);
    return false;
  }

  chunk.remove();
  return true;
}

/**
 * Set a chunk to loading state. Disables buttons and shows pulse animation.
 *
 * @param root - The root element or shadow root to search in
 * @param chunkId - The ID of the chunk to mark as loading
 * @returns true if the chunk was found and marked, false otherwise
 */
export function setChunkLoading(
  root: HTMLElement | ShadowRoot | Document,
  chunkId: string,
): boolean {
  const chunk = findChunk(root, chunkId);
  if (!chunk) {
    console.warn(`[Tidy Chunks] Chunk not found: ${chunkId}`);
    return false;
  }

  chunk.classList.add("loading");

  // Disable buttons during loading
  const buttons = chunk.querySelectorAll(".tidy-chunk-btn") as NodeListOf<HTMLButtonElement>;
  buttons.forEach((btn) => {
    btn.disabled = true;
  });

  return true;
}

/**
 * Set a chunk as complete, updating its content and removing loading state.
 *
 * @param root - The root element or shadow root to search in
 * @param chunkId - The ID of the chunk to update
 * @param newHtml - The new HTML content for the chunk
 * @returns true if the chunk was found and updated, false otherwise
 */
export function setChunkComplete(
  root: HTMLElement | ShadowRoot | Document,
  chunkId: string,
  newHtml: string,
): boolean {
  const chunk = findChunk(root, chunkId);
  if (!chunk) {
    console.warn(`[Tidy Chunks] Chunk not found: ${chunkId}`);
    return false;
  }

  // Update content in the content wrapper
  const contentWrapper = chunk.querySelector(".tidy-chunk-content");
  if (contentWrapper) {
    contentWrapper.innerHTML = newHtml;
  } else {
    // Fallback: update entire chunk innerHTML but preserve controls
    const controls = chunk.querySelector(".tidy-chunk-controls");
    chunk.innerHTML = "";
    if (controls) {
      chunk.appendChild(controls);
    }
    const newWrapper = document.createElement("div");
    newWrapper.className = "tidy-chunk-content";
    newWrapper.innerHTML = newHtml;
    chunk.appendChild(newWrapper);
  }

  // Remove loading state
  chunk.classList.remove("loading");

  // Re-enable buttons
  const buttons = chunk.querySelectorAll(".tidy-chunk-btn") as NodeListOf<HTMLButtonElement>;
  buttons.forEach((btn) => {
    btn.disabled = false;
  });

  return true;
}

// Legacy exports for backward compatibility with reader-mode.ts
// These map to the new function names

/**
 * @deprecated Use setChunkLoading instead
 */
export function markChunkLoading(
  root: HTMLElement | ShadowRoot | Document,
  chunkId: string,
): boolean {
  return setChunkLoading(root, chunkId);
}

/**
 * @deprecated Use setChunkComplete instead
 */
export function markChunkComplete(
  root: HTMLElement | ShadowRoot | Document,
  chunkId: string,
  newHtml: string,
): boolean {
  return setChunkComplete(root, chunkId, newHtml);
}

/**
 * Mark all chunks as loading at once.
 *
 * @param root - The root element or shadow root to search in
 */
export function markAllChunksLoading(root: HTMLElement | ShadowRoot | Document): void {
  const chunks = root.querySelectorAll("[data-tidy-chunk]");
  chunks.forEach((chunk) => {
    const chunkId = chunk.getAttribute("data-tidy-chunk");
    if (chunkId) {
      setChunkLoading(root, chunkId);
    }
  });
}

/**
 * Clear loading state from all chunks without updating content.
 *
 * @param root - The root element or shadow root to search in
 */
export function clearAllLoadingStates(root: HTMLElement | ShadowRoot | Document): void {
  const chunks = root.querySelectorAll(".tidy-chunk.loading");
  chunks.forEach((chunk) => {
    chunk.classList.remove("loading");

    // Re-enable buttons
    const buttons = chunk.querySelectorAll(".tidy-chunk-btn") as NodeListOf<HTMLButtonElement>;
    buttons.forEach((btn) => {
      btn.disabled = false;
    });
  });
}

/**
 * Get all chunk IDs currently in the container.
 *
 * @param root - The root element or shadow root to search in
 * @returns Array of chunk IDs
 */
export function getChunkIds(root: HTMLElement | ShadowRoot | Document): string[] {
  const chunks = root.querySelectorAll("[data-tidy-chunk]");
  return Array.from(chunks)
    .map((chunk) => chunk.getAttribute("data-tidy-chunk") || "")
    .filter(Boolean);
}

/**
 * Remove all chunk UI wrappers but preserve the content.
 * Useful when finalizing the tidied content.
 *
 * @param container - The container element holding the chunks
 */
export function removeChunkUI(container: HTMLElement): void {
  const chunks = container.querySelectorAll(".tidy-chunk");

  chunks.forEach((chunk) => {
    const content = chunk.querySelector(".tidy-chunk-content");
    if (content) {
      // Replace chunk wrapper with just its content
      const fragment = document.createDocumentFragment();
      while (content.firstChild) {
        fragment.appendChild(content.firstChild);
      }
      chunk.replaceWith(fragment);
    } else {
      // No content wrapper, remove chunk controls and unwrap
      const controls = chunk.querySelector(".tidy-chunk-controls");
      if (controls) {
        controls.remove();
      }
      const fragment = document.createDocumentFragment();
      while (chunk.firstChild) {
        fragment.appendChild(chunk.firstChild);
      }
      chunk.replaceWith(fragment);
    }
  });
}

/**
 * Get the cleaned HTML content with chunk wrappers removed.
 *
 * @param container - The container element holding the chunks
 * @returns HTML string with chunk UI removed
 */
export function getCleanedContent(container: HTMLElement): string {
  // Clone the container so we don't modify the original
  const clone = container.cloneNode(true) as HTMLElement;

  // Remove all chunk controls
  const controls = clone.querySelectorAll(".tidy-chunk-controls");
  controls.forEach((ctrl) => ctrl.remove());

  // Unwrap chunk divs
  const chunks = clone.querySelectorAll(".tidy-chunk");
  chunks.forEach((chunk) => {
    const content = chunk.querySelector(".tidy-chunk-content");
    if (content) {
      chunk.replaceWith(...Array.from(content.childNodes));
    } else {
      // No content wrapper, just unwrap the chunk
      const fragment = document.createDocumentFragment();
      while (chunk.firstChild) {
        fragment.appendChild(chunk.firstChild);
      }
      chunk.replaceWith(fragment);
    }
  });

  // Also unwrap any remaining content wrappers
  const contentWrappers = clone.querySelectorAll(".tidy-chunk-content");
  contentWrappers.forEach((wrapper) => {
    const fragment = document.createDocumentFragment();
    while (wrapper.firstChild) {
      fragment.appendChild(wrapper.firstChild);
    }
    wrapper.replaceWith(fragment);
  });

  return clone.innerHTML;
}
