/**
 * Media Picker Module
 * Handles image selection UI for clipping media to the server
 */

import { showToast } from "../toast.js";

/**
 * Media Picker State
 */
let mediaPickerActive = false;
let currentHighlightedElement: HTMLImageElement | null = null;
let pickerOverlay: HTMLElement | null = null;

/**
 * Cleanup handlers for navigation/unload while picker is active
 */
function handlePickerPageHide(): void {
  if (mediaPickerActive) {
    stopMediaPicker();
  }
}

function handlePickerVisibilityChange(): void {
  if (document.hidden && mediaPickerActive) {
    stopMediaPicker();
  }
}

/**
 * Create and show the picker overlay
 */
function createPickerOverlay(): HTMLElement {
  if (pickerOverlay) {
    return pickerOverlay;
  }

  const overlay = document.createElement("div");
  overlay.id = "media-picker-overlay";
  overlay.className = "element-picker-overlay";
  overlay.innerHTML = `
    <div class="element-picker-message">
      <span>Click on an image to clip it</span>
      <div class="element-picker-hint">Press Escape to cancel</div>
    </div>
  `;

  if (!document.body) {
    throw new Error("Document body not available");
  }

  document.body.appendChild(overlay);
  pickerOverlay = overlay;
  return overlay;
}

/**
 * Remove the picker overlay
 */
function removePickerOverlay(): void {
  if (pickerOverlay) {
    if (pickerOverlay.parentNode) {
      pickerOverlay.remove();
    }
    pickerOverlay = null;
  }
}

/**
 * Highlight an image element
 */
function highlightElement(element: HTMLImageElement): void {
  if (currentHighlightedElement && currentHighlightedElement !== element) {
    currentHighlightedElement.classList.remove("element-picker-highlight");
  }
  element.classList.add("element-picker-highlight");
  currentHighlightedElement = element;
}

/**
 * Remove highlight from current element
 */
function removeHighlight(): void {
  if (currentHighlightedElement) {
    currentHighlightedElement.classList.remove("element-picker-highlight");
    currentHighlightedElement = null;
  }
}

/**
 * Check if an element is an image or contains an image
 */
function findImageElement(element: Element | null): HTMLImageElement | null {
  if (!element) return null;

  // Direct img element
  if (element.tagName === "IMG") {
    return element as HTMLImageElement;
  }

  // Check for background-image
  const style = window.getComputedStyle(element);
  const bgImage = style.backgroundImage;
  if (bgImage && bgImage !== "none" && bgImage.startsWith("url(")) {
    // Return null - we'll handle background images separately
    return null;
  }

  // Check if element contains a single img
  const images = element.querySelectorAll("img");
  if (images.length === 1) {
    return images[0] as HTMLImageElement;
  }

  return null;
}

/**
 * Handle mouse move during picker mode
 */
function handlePickerMouseMove(event: MouseEvent): void {
  if (!mediaPickerActive) return;

  const element = document.elementFromPoint(event.clientX, event.clientY);

  // Don't highlight the overlay itself
  if (element === pickerOverlay || pickerOverlay?.contains(element)) {
    removeHighlight();
    return;
  }

  const imgElement = findImageElement(element);
  if (imgElement) {
    highlightElement(imgElement);
    document.body.style.cursor = "pointer";
  } else {
    removeHighlight();
    document.body.style.cursor = "crosshair";
  }
}

/**
 * Handle click during picker mode
 */
async function handlePickerClick(event: MouseEvent): Promise<void> {
  if (!mediaPickerActive) return;

  // Ignore clicks on the overlay
  if (pickerOverlay && pickerOverlay.contains(event.target as Node)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const element = document.elementFromPoint(event.clientX, event.clientY);
  const imgElement = findImageElement(element);

  if (!imgElement) {
    showToast("× No image found at click position");
    return;
  }

  // Exit picker mode before processing
  stopMediaPicker();

  // Process the image
  await clipImage(imgElement);
}

/**
 * Handle keydown during picker mode
 */
function handlePickerKeydown(event: KeyboardEvent): void {
  if (!mediaPickerActive) return;

  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    stopMediaPicker();
    showToast("Media picker cancelled");
  }
}

/**
 * Start media picker mode
 */
export function startMediaPicker(): void {
  if (mediaPickerActive) {
    return; // Already active
  }

  mediaPickerActive = true;

  try {
    createPickerOverlay();
  } catch (error) {
    console.error("[Media Picker] Failed to create picker overlay:", error);
    mediaPickerActive = false;
    showToast("× Failed to start media picker");
    throw error;
  }

  // Change cursor to crosshair
  if (document.body) {
    document.body.style.cursor = "crosshair";
  }

  // Add event listeners
  document.addEventListener("mousemove", handlePickerMouseMove, true);
  document.addEventListener("click", handlePickerClick, true);
  document.addEventListener("keydown", handlePickerKeydown, true);
  window.addEventListener("pagehide", handlePickerPageHide, true);
  document.addEventListener("visibilitychange", handlePickerVisibilityChange, true);
}

/**
 * Stop media picker mode
 */
export function stopMediaPicker(): void {
  if (!mediaPickerActive) return;

  mediaPickerActive = false;

  // Restore cursor
  if (document.body) {
    document.body.style.cursor = "auto";
  }

  // Remove event listeners
  document.removeEventListener("mousemove", handlePickerMouseMove, true);
  document.removeEventListener("click", handlePickerClick, true);
  document.removeEventListener("keydown", handlePickerKeydown, true);
  window.removeEventListener("pagehide", handlePickerPageHide, true);
  document.removeEventListener("visibilitychange", handlePickerVisibilityChange, true);

  // Remove highlight and overlay
  removeHighlight();
  removePickerOverlay();
}

/**
 * Download image via background script (bypasses CORS)
 */
async function downloadImageViaBackground(src: string): Promise<Blob | undefined> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        action: "fetchImage",
        url: src,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.warn("[Media Picker] Background fetch error:", chrome.runtime.lastError);
          resolve(undefined);
          return;
        }

        if (response && response.success) {
          const uint8Array = new Uint8Array(response.imageData);
          const blob = new Blob([uint8Array], { type: response.mimetype || "image/png" });
          console.log("[Media Picker] Image downloaded via background:", src);
          resolve(blob);
        } else {
          console.warn("[Media Picker] Background fetch failed:", response?.error);
          resolve(undefined);
        }
      },
    );
  });
}

/**
 * Download image blob from URL
 * Strategy: fetch() first, then canvas fallback, then background script
 */
async function downloadImageBlob(src: string): Promise<Blob | undefined> {
  try {
    // Strategy 1: Try fetch with CORS
    try {
      const response = await fetch(src, { mode: "cors" });
      if (response.ok) {
        const blob = await response.blob();
        console.log("[Media Picker] Image downloaded via fetch:", src);
        return blob;
      }
    } catch (fetchError) {
      console.warn("[Media Picker] Fetch failed, trying canvas fallback:", fetchError);
    }

    // Strategy 2: Try canvas approach
    try {
      const blob = await downloadImageViaCanvas(src);
      if (blob) {
        console.log("[Media Picker] Image downloaded via canvas:", src);
        return blob;
      }
    } catch (canvasError) {
      console.warn("[Media Picker] Canvas fallback failed:", canvasError);
    }

    // Strategy 3: Try background script fetch (bypasses CORS)
    try {
      const blob = await downloadImageViaBackground(src);
      if (blob) {
        return blob;
      }
    } catch (bgError) {
      console.warn("[Media Picker] Background fetch failed:", bgError);
    }

    console.warn("[Media Picker] Could not download image:", src);
    return undefined;
  } catch (error) {
    console.warn("[Media Picker] Error downloading image blob:", error);
    return undefined;
  }
}

/**
 * Download image via canvas approach
 */
async function downloadImageViaCanvas(src: string): Promise<Blob | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve(undefined);
          return;
        }

        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          resolve(blob || undefined);
        }, "image/png");
      } catch (error) {
        console.warn("[Media Picker] Canvas drawing failed:", error);
        resolve(undefined);
      }
    };

    img.onerror = () => {
      console.warn("[Media Picker] Image load failed for canvas approach:", src);
      resolve(undefined);
    };

    img.src = src;
  });
}

/**
 * Extract filename from URL
 */
function extractFilename(src: string): string {
  try {
    const url = new URL(src);
    const pathname = url.pathname;
    const segments = pathname.split("/");
    const lastSegment = segments[segments.length - 1];
    if (lastSegment && lastSegment.includes(".")) {
      return decodeURIComponent(lastSegment);
    }
    return `image_${Date.now()}.png`;
  } catch {
    return `image_${Date.now()}.png`;
  }
}

/**
 * Try server-side image download as fallback
 * Sends image URL to background script which calls the upload-url API
 */
async function tryServerSideDownload(src: string, altText: string | undefined): Promise<boolean> {
  return new Promise((resolve) => {
    console.log("[Media Picker] Trying server-side download fallback for:", src);

    chrome.runtime.sendMessage(
      {
        action: "uploadMediaUrl",
        url: src,
        pageUrl: window.location.href,
        pageTitle: document.title,
        altText,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("[Media Picker] Server-side download error:", chrome.runtime.lastError);
          resolve(false);
        } else if (response && response.success) {
          console.log("[Media Picker] Server-side download succeeded:", response);
          resolve(true);
        } else {
          console.error("[Media Picker] Server-side download failed:", response?.error);
          resolve(false);
        }
      },
    );
  });
}

/**
 * Clip an image element to the server
 */
async function clipImage(imgElement: HTMLImageElement): Promise<void> {
  showToast("Clipping image...");

  const src = imgElement.src || imgElement.getAttribute("src");
  if (!src) {
    showToast("× Could not get image source");
    return;
  }

  const altText = imgElement.alt || undefined;

  // Try to download the image blob client-side
  const blob = await downloadImageBlob(src);

  if (!blob) {
    // Fallback: Try server-side download
    console.log("[Media Picker] Client-side download failed, trying server-side fallback");
    showToast("Trying server-side download...");

    const success = await tryServerSideDownload(src, altText);
    if (success) {
      showToast("✓ Image clipped!");
    } else {
      showToast("× Failed to download image (CORS blocked)");
    }
    return;
  }

  // Extract metadata
  const metadata = {
    originalFilename: extractFilename(src),
    mimetype: blob.type || "image/png",
    fileSize: blob.size,
    width: imgElement.naturalWidth,
    height: imgElement.naturalHeight,
    altText,
    pageUrl: window.location.href,
    pageTitle: document.title,
  };

  // Convert blob to array buffer for message passing
  const arrayBuffer = await blob.arrayBuffer();

  // Send to background script for upload
  chrome.runtime.sendMessage(
    {
      action: "uploadMedia",
      imageData: Array.from(new Uint8Array(arrayBuffer)),
      metadata,
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("[Media Picker] Error uploading image:", chrome.runtime.lastError);
        showToast("× Error uploading image");
      } else if (response && response.success) {
        showToast("✓ Image clipped!");
      } else {
        showToast("× " + (response?.error || "Failed to upload image"));
      }
    },
  );
}
