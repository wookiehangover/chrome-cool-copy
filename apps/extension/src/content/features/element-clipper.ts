/**
 * Element Clipper Module
 * Captures a complete ElementClip from a selected element
 * Coordinates DOM serialization, style extraction, text conversion, and media collection
 */

import { serializeDOM } from "./dom-serializer.js";
import { extractComputedStyles } from "./style-extractor.js";
import { extractStructuredData } from "./structured-data-extractor.js";
import type { ElementMetadata, MediaAssetReference, StructuredData } from "@repo/shared/types";

/**
 * Element clip payload - returned from captureElementClip
 * Omits id, timestamps, and sync status (added on save)
 */
export interface ElementClipData {
  url: string;
  pageTitle: string;
  selector: string;
  domStructure: string;
  scopedStyles: string;
  textContent: string;
  markdownContent: string;
  structuredData?: StructuredData;
  mediaAssets: MediaAssetReference[];
  elementMeta: ElementMetadata;
  imageBlob?: Blob; // Primary image blob if element is single-image
}

/**
 * Capture a complete ElementClip from a DOM element
 * Coordinates all extraction modules and media collection
 *
 * @param element - The DOM element to capture
 * @returns Promise resolving to ElementClipData
 */
export async function captureElementClip(element: Element): Promise<ElementClipData> {
  try {
    // 1. Serialize DOM structure
    const domStructure = serializeDOM(element);

    // 2. Extract computed styles with unique scope ID
    const scopeId = `clip-${Date.now()}`;
    const scopedStyles = extractComputedStyles(element, scopeId);

    // 3. Extract structured data
    const structuredData = extractStructuredData(element);

    // 4. Extract text content and convert to markdown
    const textContent = (element as HTMLElement).innerText || element.textContent || "";
    const markdownContent = convertToMarkdown(element.innerHTML);

    // 5. Collect media assets and detect single-image element
    const { mediaAssets, imageBlob } = await collectMediaAssets(element);

    // 6. Collect element metadata
    const elementMeta = collectElementMetadata(element);

    return {
      url: window.location.href,
      pageTitle: document.title,
      selector: generateSelector(element),
      domStructure,
      scopedStyles,
      textContent,
      markdownContent,
      structuredData,
      mediaAssets,
      elementMeta,
      imageBlob,
    };
  } catch (error) {
    console.error("[Element Clipper] Error capturing element clip:", error);
    throw error;
  }
}

/**
 * Convert HTML to markdown using Turndown
 */
function convertToMarkdown(html: string): string {
  try {
    const turndownService = new TurndownService();
    return turndownService.turndown(html);
  } catch (error) {
    console.warn("[Element Clipper] Error converting to markdown:", error);
    // Fallback to empty string if conversion fails
    return "";
  }
}

/**
 * Collect all media assets from the element
 * Finds img, video, and source tags; attempts to download as data URIs
 * For single-image elements, downloads the image blob
 */
async function collectMediaAssets(
  element: Element,
): Promise<{ mediaAssets: MediaAssetReference[]; imageBlob?: Blob }> {
  const assets: MediaAssetReference[] = [];
  let imageBlob: Blob | undefined;

  try {
    // Check if element is a single-image element
    const singleImageBlob = await detectAndDownloadSingleImage(element);
    if (singleImageBlob) {
      imageBlob = singleImageBlob;
    }

    // Collect images
    const images = element.querySelectorAll("img");
    for (const img of images) {
      const src = img.src || img.getAttribute("src");
      const alt = img.getAttribute("alt");
      if (src) {
        assets.push({
          type: "image",
          originalSrc: src,
          alt: alt || undefined,
        });
      }
    }

    // Collect videos
    const videos = element.querySelectorAll("video");
    for (const video of videos) {
      const src = video.src || video.getAttribute("src");
      if (src) {
        assets.push({
          type: "video",
          originalSrc: src,
        });
      }

      // Also collect source elements within video
      const sources = video.querySelectorAll("source");
      for (const source of sources) {
        const srcset = source.src || source.getAttribute("src");
        if (srcset) {
          assets.push({
            type: "video",
            originalSrc: srcset,
          });
        }
      }
    }

    // Collect background images from computed styles
    const allElements = [element, ...Array.from(element.querySelectorAll("*"))];
    for (const el of allElements) {
      const computed = window.getComputedStyle(el);
      const bgImage = computed.backgroundImage;
      if (bgImage && bgImage !== "none") {
        const urlMatch = bgImage.match(/url\(['"]?([^'")]+)['"]?\)/);
        if (urlMatch && urlMatch[1]) {
          assets.push({
            type: "background",
            originalSrc: urlMatch[1],
          });
        }
      }
    }
  } catch (error) {
    console.warn("[Element Clipper] Error collecting media assets:", error);
  }

  return { mediaAssets: assets, imageBlob };
}

/**
 * Detect if element is a single-image element and download the image blob
 * Returns blob if element IS an img tag or contains exactly one img descendant
 */
async function detectAndDownloadSingleImage(element: Element): Promise<Blob | undefined> {
  try {
    let imgElement: HTMLImageElement | null = null;

    // Check if element itself is an img tag
    if (element.tagName.toLowerCase() === "img") {
      imgElement = element as HTMLImageElement;
    } else {
      // Check if element contains exactly one img descendant
      const images = element.querySelectorAll("img");
      if (images.length === 1) {
        imgElement = images[0] as HTMLImageElement;
      }
    }

    if (!imgElement) {
      return undefined;
    }

    const src = imgElement.src || imgElement.getAttribute("src");
    if (!src) {
      return undefined;
    }

    // Try to download the image blob
    return await downloadImageBlob(src);
  } catch (error) {
    console.warn("[Element Clipper] Error detecting/downloading single image:", error);
    return undefined;
  }
}

/**
 * Download image blob from URL
 * Strategy: fetch() first, then canvas fallback if CORS blocks fetch
 */
async function downloadImageBlob(src: string): Promise<Blob | undefined> {
  try {
    // Strategy 1: Try fetch with CORS
    try {
      const response = await fetch(src, { mode: "cors" });
      if (response.ok) {
        const blob = await response.blob();
        console.log("[Element Clipper] Image downloaded via fetch:", src);
        return blob;
      }
    } catch (fetchError) {
      console.warn("[Element Clipper] Fetch failed, trying canvas fallback:", fetchError);
    }

    // Strategy 2: Try canvas approach (draw image → toDataURL → blob)
    try {
      const blob = await downloadImageViaCanvas(src);
      if (blob) {
        console.log("[Element Clipper] Image downloaded via canvas:", src);
        return blob;
      }
    } catch (canvasError) {
      console.warn("[Element Clipper] Canvas fallback failed:", canvasError);
    }

    // If both strategies fail, return undefined (URL will be kept in mediaAssets)
    console.warn("[Element Clipper] Could not download image, will keep URL only:", src);
    return undefined;
  } catch (error) {
    console.warn("[Element Clipper] Error downloading image blob:", error);
    return undefined;
  }
}

/**
 * Download image via canvas approach
 * Creates an image element, draws it to canvas, and converts to blob
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
        console.warn("[Element Clipper] Canvas drawing failed:", error);
        resolve(undefined);
      }
    };

    img.onerror = () => {
      console.warn("[Element Clipper] Image load failed for canvas approach:", src);
      resolve(undefined);
    };

    img.src = src;
  });
}

/**
 * Collect element metadata
 */
function collectElementMetadata(element: Element): ElementMetadata {
  const rect = element.getBoundingClientRect();
  const dataAttributes: Record<string, string> = {};

  // Collect data-* attributes
  for (const attr of element.attributes) {
    if (attr.name.startsWith("data-")) {
      dataAttributes[attr.name] = attr.value;
    }
  }

  return {
    tagName: element.tagName,
    role: element.getAttribute("role") || undefined,
    boundingBox: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    },
    classNames: Array.from(element.classList),
    dataAttributes,
  };
}

/**
 * Generate a CSS selector for the element
 */
function generateSelector(element: Element): string {
  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();

    // Add ID if present
    if (current.id) {
      selector += `#${current.id}`;
      path.unshift(selector);
      break;
    }

    // Add class names if present
    if (current.classList.length > 0) {
      selector += `.${Array.from(current.classList).join(".")}`;
    }

    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(" > ");
}

