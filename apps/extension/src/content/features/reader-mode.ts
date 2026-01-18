/**
 * Reader Mode
 * Provides a clean, distraction-free reading experience with:
 * - Auto-clip on entry
 * - Text highlighting with annotations
 * Uses Shadow DOM for complete style isolation
 */

import styles from "./reader-mode.css?raw";
import type { Highlight } from "@repo/shared";
import { showToast } from "../toast.js";
import { copyToClipboard } from "../clipboard.js";
import {
  wrapContentInChunks,
  markAllChunksLoading,
  markChunkComplete,
  clearAllLoadingStates,
} from "./tidy-chunks.js";

// =============================================================================
// Reader Mode
// =============================================================================

// Reader mode state
let readerModeActive = false;
let readerModeContainer: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let originalPageDisplay: string = "";
let originalBodyOverflow: string = "";

// Current clip data
let currentClipId: string | null = null;
let currentHighlights: Highlight[] = [];

// UI elements (inside shadow DOM)
let contentWrapper: HTMLElement | null = null;
let noteEditor: HTMLElement | null = null;
let activeHighlightId: string | null = null;

// Settings defaults
interface ReaderSettings {
  fontFamily: "sans" | "serif" | "mono";
  fontSize: number; // 14-22
}

const DEFAULT_SETTINGS: ReaderSettings = {
  fontFamily: "sans",
  fontSize: 16,
};

// Storage key for remembering reader mode URLs
const READER_MODE_URLS_KEY = "readerModeUrls";

// Storage key for local clips (must match local-clips.ts)
const LOCAL_CLIPS_STORAGE_KEY = "local_clips";

// Storage change listener reference for cleanup
let storageChangeListener:
  | ((changes: { [key: string]: chrome.storage.StorageChange }) => void)
  | null = null;

/**
 * Setup storage change listener for highlight sync
 * This allows highlights created in clip viewer to appear in reader mode
 */
function setupHighlightSyncListener(): void {
  if (storageChangeListener) return; // Already set up

  storageChangeListener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
    if (!currentClipId || !changes[LOCAL_CLIPS_STORAGE_KEY]) return;

    const { newValue } = changes[LOCAL_CLIPS_STORAGE_KEY];
    if (!Array.isArray(newValue)) return;

    // Find our clip in the updated clips
    const updatedClip = newValue.find((c: { id: string }) => c.id === currentClipId);
    if (!updatedClip) return;

    const newHighlights: Highlight[] = updatedClip.highlights || [];

    // Check if highlights actually changed (compare IDs)
    const currentIds = new Set(currentHighlights.map((h) => h.id));
    const newIds = new Set(newHighlights.map((h) => h.id));

    // Find new highlights to add
    const addedHighlights = newHighlights.filter((h) => !currentIds.has(h.id));
    // Find highlights to remove
    const removedIds = [...currentIds].filter((id) => !newIds.has(id));

    if (addedHighlights.length === 0 && removedIds.length === 0) {
      // Check for note updates
      const noteChanges = newHighlights.filter((newHl) => {
        const existing = currentHighlights.find((h) => h.id === newHl.id);
        return existing && existing.note !== newHl.note;
      });

      // Update notes in local state and DOM
      for (const updated of noteChanges) {
        const existing = currentHighlights.find((h) => h.id === updated.id);
        if (existing) {
          existing.note = updated.note;
          // Update has-note class on DOM element
          const markElement = shadowRoot?.querySelector(`[data-highlight-id="${updated.id}"]`);
          if (markElement) {
            if (updated.note) {
              markElement.classList.add("has-note");
            } else {
              markElement.classList.remove("has-note");
            }
          }
        }
      }
      return;
    }

    // Remove deleted highlights from DOM
    for (const id of removedIds) {
      const markElement = shadowRoot?.querySelector(`[data-highlight-id="${id}"]`);
      if (markElement) {
        const parent = markElement.parentNode;
        while (markElement.firstChild) {
          parent?.insertBefore(markElement.firstChild, markElement);
        }
        markElement.remove();
      }
    }

    // Add new highlights to DOM
    for (const highlight of addedHighlights) {
      if (contentWrapper) {
        wrapHighlightByOffset(contentWrapper, highlight);
      }
    }

    // Update local state
    currentHighlights = newHighlights;
  };

  chrome.storage.local.onChanged.addListener(storageChangeListener);
}

/**
 * Remove storage change listener
 */
function removeHighlightSyncListener(): void {
  if (storageChangeListener) {
    chrome.storage.local.onChanged.removeListener(storageChangeListener);
    storageChangeListener = null;
  }
}

/**
 * Add current URL to reader mode memory
 */
async function rememberReaderModeUrl(): Promise<void> {
  try {
    const url = window.location.href;
    const result = await chrome.storage.local.get([READER_MODE_URLS_KEY]);
    const urls = (result[READER_MODE_URLS_KEY] as string[] | undefined) || [];

    if (!urls.includes(url)) {
      urls.push(url);
      // Keep only the last 100 URLs to avoid storage bloat
      const trimmedUrls = urls.slice(-100);
      await chrome.storage.local.set({ [READER_MODE_URLS_KEY]: trimmedUrls });
    }
  } catch (error) {
    console.error("[Reader Mode] Failed to remember URL:", error);
  }
}

/**
 * Remove current URL from reader mode memory
 */
async function forgetReaderModeUrl(): Promise<void> {
  try {
    const url = window.location.href;
    const result = await chrome.storage.local.get([READER_MODE_URLS_KEY]);
    const urls = (result[READER_MODE_URLS_KEY] as string[] | undefined) || [];

    const index = urls.indexOf(url);
    if (index !== -1) {
      urls.splice(index, 1);
      await chrome.storage.local.set({ [READER_MODE_URLS_KEY]: urls });
    }
  } catch (error) {
    console.error("[Reader Mode] Failed to forget URL:", error);
  }
}

/**
 * Check if current URL should auto-enter reader mode
 */
async function shouldAutoEnterReaderMode(): Promise<boolean> {
  try {
    const url = window.location.href;
    const result = await chrome.storage.local.get([READER_MODE_URLS_KEY]);
    const urls = (result[READER_MODE_URLS_KEY] as string[] | undefined) || [];
    return urls.includes(url);
  } catch (error) {
    console.error("[Reader Mode] Failed to check URL:", error);
    return false;
  }
}

/**
 * Initialize reader mode - check if we should auto-enter
 */
export async function initReaderMode(): Promise<void> {
  if (await shouldAutoEnterReaderMode()) {
    // Small delay to let the page finish loading
    setTimeout(() => {
      activateReaderMode();
    }, 100);
  }
}

/**
 * Extract the main article content from the page
 */
function extractArticleContent(): { title: string; content: Element; images: string[] } {
  // Try to find the main content using semantic HTML and common patterns
  const mainContent = findMainContent();
  const cleanedContent = cleanContent(mainContent);

  // Extract title
  const title = extractTitle();

  // Extract images from the article
  const images = extractImages(cleanedContent);

  return { title, content: cleanedContent, images };
}

/**
 * Find the main content element on the page
 */
function findMainContent(): Element {
  // Site-specific selectors for better content extraction
  // Substack uses .body.markup for article content
  const substackBody = document.querySelector("article .body.markup");
  if (substackBody) return substackBody;

  // Medium uses article content directly but has cleaner structure
  const mediumContent = document.querySelector("article[data-post-id]");
  if (mediumContent) return mediumContent;

  // Try semantic elements
  const main = document.querySelector("main");
  if (main) return main;

  const article = document.querySelector("article");
  if (article) return article;

  const roleMain = document.querySelector('[role="main"]');
  if (roleMain) return roleMain;

  // Try common content containers
  const content =
    document.querySelector("#content") ||
    document.querySelector(".content") ||
    document.querySelector("#main-content") ||
    document.querySelector(".main-content") ||
    document.querySelector(".post-content") ||
    document.querySelector(".entry-content") ||
    document.querySelector(".article-content");
  if (content) return content;

  // Fall back to body
  return document.body;
}

/**
 * Extract the article title
 */
function extractTitle(): string {
  // Try h1 in article or main
  const articleH1 = document.querySelector("article h1, main h1");
  if (articleH1?.textContent) return articleH1.textContent.trim();

  // Try meta tags
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute("content");
  if (ogTitle) return ogTitle;

  // Fall back to document title
  return document.title;
}

/**
 * Clone element and remove non-content elements
 */
function cleanContent(element: Element): Element {
  const clone = element.cloneNode(true) as Element;

  // Remove non-content elements
  const selectorsToRemove = [
    "script",
    "style",
    "noscript",
    "iframe",
    "nav",
    "footer",
    "header:not(article header):not(main header)",
    "aside",
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    '[role="complementary"]',
    ".sidebar",
    ".nav",
    ".navigation",
    ".menu",
    ".advertisement",
    ".ad",
    ".ads",
    ".adsbygoogle",
    ".comments",
    ".comment-section",
    ".social-share",
    ".share-buttons",
    ".related-posts",
    ".recommended",
    ".newsletter",
    ".popup",
    ".modal",
    ".cookie-notice",
    ".breadcrumb",
    ".tags",
    ".categories",
    // Substack-specific elements
    ".subscribe-widget",
    '[data-component-name*="Subscribe"]',
    ".post-header",
    ".post-footer",
    ".visibility-check",
    "dialog",
    '[class*="modal"]',
    '[class*="popup"]',
    ".like-button-container",
    ".post-ufi",
    '[class*="ufi-button"]',
  ];

  selectorsToRemove.forEach((selector) => {
    clone.querySelectorAll(selector).forEach((el) => el.remove());
  });

  return clone;
}

/**
 * Extract images from content
 */
function extractImages(content: Element): string[] {
  const images: string[] = [];
  content.querySelectorAll("img").forEach((img) => {
    const src = img.src || img.getAttribute("data-src");
    if (src && !src.includes("icon") && !src.includes("logo")) {
      images.push(src);
    }
  });
  return images;
}

/**
 * Load reader settings from storage
 */
async function loadSettings(): Promise<ReaderSettings> {
  try {
    const result = await chrome.storage.sync.get(["readerSettings"]);
    const stored = result.readerSettings as ReaderSettings | undefined;
    if (stored && typeof stored === "object") {
      return {
        fontFamily: stored.fontFamily || DEFAULT_SETTINGS.fontFamily,
        fontSize: stored.fontSize || DEFAULT_SETTINGS.fontSize,
      };
    }
    return DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save reader settings to storage
 */
async function saveSettings(settings: ReaderSettings): Promise<void> {
  try {
    await chrome.storage.sync.set({ readerSettings: settings });
  } catch (error) {
    console.error("[Reader Mode] Failed to save settings:", error);
  }
}

/**
 * Auto-clip the page when entering reader mode
 */
async function autoClipPage(title: string, content: Element): Promise<void> {
  try {
    // Check if already clipped via message to background
    const checkResponse = await chrome.runtime.sendMessage({
      action: "checkExistingClip",
      url: window.location.href,
    });

    if (checkResponse?.clip) {
      currentClipId = checkResponse.clip.id;
      currentHighlights = checkResponse.clip.highlights || [];

      // Restore saved highlights to the DOM
      restoreHighlights();
      return;
    }

    // Save new clip via message to background
    const saveResponse = await chrome.runtime.sendMessage({
      action: "savePageToDatabase",
      url: window.location.href,
      title: title,
      domContent: content.outerHTML,
      textContent: content.textContent || "",
      metadata: {
        clippedFrom: "reader-mode",
        clippedAt: new Date().toISOString(),
      },
    });

    if (saveResponse?.success && saveResponse?.clipId) {
      currentClipId = saveResponse.clipId;
      currentHighlights = [];
    } else {
      console.warn("[Reader Mode] Failed to save clip:", saveResponse?.error);
    }
  } catch (error) {
    console.error("[Reader Mode] Auto-clip failed:", error);
    // Don't fail reader mode if clip fails
  }
}

/**
 * Restore saved highlights to the DOM
 */
function restoreHighlights(): void {
  if (!contentWrapper || currentHighlights.length === 0) return;

  // Sort highlights by startOffset (process from end to start to preserve offsets)
  const sortedHighlights = [...currentHighlights].sort((a, b) => b.startOffset - a.startOffset);

  for (const highlight of sortedHighlights) {
    try {
      // Use offset-based restoration for accurate placement
      wrapHighlightByOffset(contentWrapper, highlight);
    } catch (error) {
      console.error("[Reader Mode] Error restoring highlight:", error);
    }
  }
}

/**
 * Find text in the DOM and wrap it with a mark element
 * Handles text that spans multiple text nodes
 */
function findTextAndWrap(
  container: Element,
  searchText: string,
  highlightId: string,
  note?: string,
): boolean {
  // First, try to find in a single text node (fast path)
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let node: Text | null;

  while ((node = walker.nextNode() as Text | null)) {
    const nodeText = node.textContent || "";
    const index = nodeText.indexOf(searchText);

    if (index !== -1) {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + searchText.length);

      const mark = document.createElement("mark");
      mark.className = "reader-highlight" + (note ? " has-note" : "");
      mark.dataset.highlightId = highlightId;

      range.surroundContents(mark);
      return true;
    }
  }

  // Text spans multiple nodes - build a text node map
  const textNodes: { node: Text; start: number; end: number }[] = [];
  const walker2 = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let pos = 0;

  while ((node = walker2.nextNode() as Text | null)) {
    const len = node.textContent?.length || 0;
    textNodes.push({ node, start: pos, end: pos + len });
    pos += len;
  }

  // Find where searchText starts in the combined text
  const fullText = container.textContent || "";
  const searchIndex = fullText.indexOf(searchText);

  if (searchIndex === -1) {
    return false;
  }

  const searchEnd = searchIndex + searchText.length;

  // Find the nodes that contain the start and end of our search text
  const startNodeInfo = textNodes.find((n) => searchIndex >= n.start && searchIndex < n.end);
  const endNodeInfo = textNodes.find((n) => searchEnd > n.start && searchEnd <= n.end);

  if (!startNodeInfo || !endNodeInfo) {
    return false;
  }

  const startOffset = searchIndex - startNodeInfo.start;
  const endOffset = searchEnd - endNodeInfo.start;

  try {
    const range = document.createRange();
    range.setStart(startNodeInfo.node, startOffset);
    range.setEnd(endNodeInfo.node, endOffset);

    const mark = document.createElement("mark");
    mark.className = "reader-highlight" + (note ? " has-note" : "");
    mark.dataset.highlightId = highlightId;

    // For cross-node ranges, we need to extract and wrap
    const contents = range.extractContents();
    mark.appendChild(contents);
    range.insertNode(mark);

    return true;
  } catch {
    return false;
  }
}

/**
 * Wrap text at a specific offset position (preferred method for synced highlights)
 */
function wrapHighlightByOffset(container: Element, highlight: Highlight): boolean {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let currentOffset = 0;
  let node: Text | null;

  while ((node = walker.nextNode() as Text | null)) {
    const nodeLength = node.textContent?.length || 0;
    const nodeStart = currentOffset;
    const nodeEnd = currentOffset + nodeLength;

    // Check if this node contains the highlight start
    if (nodeEnd > highlight.startOffset && nodeStart < highlight.endOffset) {
      const mark = document.createElement("mark");
      mark.className = "reader-highlight" + (highlight.note ? " has-note" : "");
      mark.dataset.highlightId = highlight.id;

      const range = document.createRange();
      const startOffset = Math.max(0, highlight.startOffset - nodeStart);
      const endOffset = Math.min(nodeLength, highlight.endOffset - nodeStart);

      range.setStart(node, startOffset);
      range.setEnd(node, endOffset);

      try {
        range.surroundContents(mark);
        return true;
      } catch {
        // If surroundContents fails, try extract and insert
        const fragment = range.extractContents();
        mark.appendChild(fragment);
        range.insertNode(mark);
        return true;
      }
    }

    currentOffset = nodeEnd;
  }

  // Fallback to text-based search if offset didn't work
  return findTextAndWrap(container, highlight.text, highlight.id, highlight.note);
}

/**
 * Activate reader mode
 */
export async function activateReaderMode(): Promise<void> {
  if (readerModeActive) {
    return;
  }

  try {
    // Check if page is already clipped - use saved content if so
    const existingClip = await checkForExistingClip();

    let title: string;
    let content: Element;

    if (existingClip) {
      // Use saved content from clip
      title = existingClip.title;
      content = document.createElement("div");
      content.innerHTML = existingClip.dom_content;
      currentClipId = existingClip.id;
      currentHighlights = existingClip.highlights || [];
    } else {
      // Extract fresh content from the page
      const extracted = extractArticleContent();
      title = extracted.title;
      content = extracted.content;
    }

    // Load settings
    const settings = await loadSettings();

    // Create reader mode container with Shadow DOM
    await createReaderModeUI(title, content, settings);

    // Hide the original page content
    hideOriginalContent();

    // If no existing clip, save a new one
    if (!existingClip) {
      await autoClipPage(title, content);
    } else {
      // Check if highlights are already in the DOM (from edited content)
      const existingMarks = contentWrapper?.querySelectorAll(".reader-highlight");
      if (!existingMarks || existingMarks.length === 0) {
        // Restore highlights from the saved clip
        restoreHighlights();
      }
    }

    // Remember this URL for auto-enter on refresh
    await rememberReaderModeUrl();

    // Setup storage listener for highlight sync with clip viewer
    setupHighlightSyncListener();

    readerModeActive = true;
  } catch (error) {
    console.error("[Reader Mode] Error activating reader mode:", error);
  }
}

/**
 * Check if page is already clipped and return the clip data
 */
async function checkForExistingClip(): Promise<{
  id: string;
  title: string;
  dom_content: string;
  highlights?: Highlight[];
} | null> {
  try {
    const response = await chrome.runtime.sendMessage({
      action: "checkExistingClip",
      url: window.location.href,
    });

    if (response?.clip) {
      return response.clip;
    }
    return null;
  } catch (error) {
    console.error("[Reader Mode] Error checking for existing clip:", error);
    return null;
  }
}

/**
 * Hide original page content
 */
function hideOriginalContent(): void {
  // Store original styles
  originalPageDisplay = document.documentElement.style.overflow;
  originalBodyOverflow = document.body.style.overflow;

  // Hide scrollbars on original content
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
}

/**
 * Restore original page content visibility
 */
function restoreOriginalContent(): void {
  document.documentElement.style.overflow = originalPageDisplay;
  document.body.style.overflow = originalBodyOverflow;
}

/**
 * Create toolbar button
 */
function createToolbarButton(icon: string, title: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "reader-mode-btn";
  btn.innerHTML = icon;
  btn.title = title;
  btn.addEventListener("click", onClick);
  return btn;
}

/**
 * Create note editor element (positioned to the right of highlights)
 */
function createNoteEditor(): HTMLElement {
  const editor = document.createElement("div");
  editor.className = "note-editor";
  editor.innerHTML = `
    <textarea class="note-textarea" placeholder="Add a note..."></textarea>
    <div class="note-actions">
      <button class="note-copy" title="Copy highlight"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 14h6"/><path d="M12 17v-6"/></svg></button>
      <button class="note-save">Save</button>
      <button class="note-delete">Delete</button>
    </div>
  `;
  return editor;
}

/**
 * Open the clip in the clips viewer
 */
function openInClipViewer(): void {
  if (currentClipId) {
    chrome.runtime.sendMessage({
      action: "openClipViewer",
      clipId: currentClipId,
    });
  }
}

/**
 * Create the reader mode UI with Shadow DOM
 */
async function createReaderModeUI(
  title: string,
  content: Element,
  settings: ReaderSettings,
): Promise<void> {
  readerModeContainer = document.createElement("div");
  readerModeContainer.id = "reader-mode-root";

  shadowRoot = readerModeContainer.attachShadow({ mode: "closed" });

  // Inject styles
  const styleElement = document.createElement("style");
  styleElement.textContent = styles;
  shadowRoot.appendChild(styleElement);

  // Create wrapper with font class
  const wrapper = document.createElement("div");
  wrapper.className = `reader-mode-wrapper font-${settings.fontFamily}`;
  wrapper.style.setProperty("--font-size-base", `${settings.fontSize}px`);

  // Create toolbar
  const toolbar = document.createElement("div");
  toolbar.className = "reader-mode-toolbar";

  // Icons
  const moreIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`;
  const tidyIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 12h-5"/><path d="M15 8h-5"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V11a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h3"/></svg>`;
  const resetIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;
  const clipIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"/></svg>`;
  const copyIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;

  // Create dropdown container
  const dropdown = document.createElement("div");
  dropdown.className = "reader-dropdown";

  const dropdownBtn = createToolbarButton(moreIcon, "More options", () => {
    dropdownMenu.classList.toggle("visible");
  });

  const dropdownMenu = document.createElement("div");
  dropdownMenu.className = "reader-dropdown-menu";

  // Tidy Content - Progressive chunked processing
  const tidyBtn = document.createElement("button");
  tidyBtn.className = "reader-dropdown-item";
  tidyBtn.innerHTML = `${tidyIcon} Tidy Content`;
  tidyBtn.addEventListener("click", async () => {
    dropdownMenu.classList.remove("visible");
    tidyBtn.disabled = true;
    tidyBtn.innerHTML = `${tidyIcon} Tidying...`;

    if (!contentWrapper || !shadowRoot) {
      tidyBtn.disabled = false;
      tidyBtn.innerHTML = `${tidyIcon} Tidy Content`;
      return;
    }

    try {
      const originalHtml = contentWrapper.innerHTML;

      // Split content into chunks locally (content script has DOM access)
      const { getHtmlChunks } = await import("../../services/html-chunk-splitter.js");
      const chunks = getHtmlChunks(originalHtml);

      if (chunks.length === 0) {
        console.warn("[Tidy Content] No chunks generated from content");
        tidyBtn.disabled = false;
        tidyBtn.innerHTML = `${tidyIcon} Tidy Content`;
        return;
      }

      // Wrap DOM with chunk divs BEFORE sending to background
      const tidyChunks = chunks.map((c) => ({ id: c.id, content: c.html }));
      wrapContentInChunks(contentWrapper, tidyChunks);
      markAllChunksLoading(shadowRoot);

      // Send pre-split chunks to background for processing
      const response = await chrome.runtime.sendMessage({
        action: "tidyContentChunked",
        chunks: chunks.map((c) => ({ id: c.id, html: c.html })),
        concurrency: 4,
      });

      if (!response?.success) {
        clearAllLoadingStates(shadowRoot);
        throw new Error(response?.error || "Failed to start chunked tidy");
      }

      // Track completed chunks
      const expectedChunkIds = new Set(chunks.map((c) => c.id));
      const completedChunkIds = new Set<string>();

      // Setup listener for chunk completion events
      const handleChunkComplete = (event: Event) => {
        const detail = (event as CustomEvent).detail;
        const { chunkId, html, success, error } = detail;
        console.log(
          `[Tidy Content] Handling chunk event:`,
          chunkId,
          success,
          `(expected: ${[...expectedChunkIds].join(", ")})`,
        );

        if (!expectedChunkIds.has(chunkId) && chunkId !== "error") {
          console.log(`[Tidy Content] Ignoring unknown chunk: ${chunkId}`);
          return; // Not our chunk
        }

        if (chunkId === "error" || !success) {
          console.error(`[Tidy Content] Chunk ${chunkId} failed:`, error);
          // On error, clear loading states and restore button
          clearAllLoadingStates(shadowRoot!);
          tidyBtn.disabled = false;
          tidyBtn.innerHTML = `${tidyIcon} Tidy Content`;
          showToast("Tidy failed. Try again.");
          window.removeEventListener("tidyChunkComplete", handleChunkComplete);
          return;
        }

        // Update the chunk with new content
        markChunkComplete(shadowRoot!, chunkId, html);
        completedChunkIds.add(chunkId);

        // Check if all chunks are complete
        if (completedChunkIds.size === expectedChunkIds.size) {
          window.removeEventListener("tidyChunkComplete", handleChunkComplete);

          // All chunks complete - collect final HTML and update storage
          const finalHtml = contentWrapper!.innerHTML;

          if (currentClipId) {
            chrome.runtime.sendMessage({
              action: "updateClip",
              clipId: currentClipId,
              updates: { dom_content: finalHtml },
            });
          }

          tidyBtn.disabled = false;
          tidyBtn.innerHTML = `${tidyIcon} Tidy Content`;
          showToast("Content tidied!");
        }
      };

      window.addEventListener("tidyChunkComplete", handleChunkComplete);

      console.log(`[Tidy Content] Started processing ${response.totalChunks} chunks`);
    } catch (err) {
      console.error("Failed to tidy content:", err);
      clearAllLoadingStates(shadowRoot!);
      tidyBtn.disabled = false;
      tidyBtn.innerHTML = `${tidyIcon} Tidy Content`;
      showToast("Tidy failed. Try again.");
    }
  });

  // Reset Content
  const resetBtn = document.createElement("button");
  resetBtn.className = "reader-dropdown-item";
  resetBtn.innerHTML = `${resetIcon} Reset Content`;
  resetBtn.addEventListener("click", () => {
    dropdownMenu.classList.remove("visible");
    window.location.reload();
  });

  // Separator
  const separator = document.createElement("div");
  separator.className = "reader-dropdown-separator";

  // View Clip
  const viewClipBtn = document.createElement("button");
  viewClipBtn.className = "reader-dropdown-item";
  viewClipBtn.innerHTML = `${clipIcon} View Clip`;
  viewClipBtn.addEventListener("click", () => {
    dropdownMenu.classList.remove("visible");
    openInClipViewer();
  });

  // Copy Content
  const copyBtn = document.createElement("button");
  copyBtn.className = "reader-dropdown-item";
  copyBtn.innerHTML = `${copyIcon} Copy Content`;
  copyBtn.addEventListener("click", async () => {
    dropdownMenu.classList.remove("visible");
    const textContent = contentWrapper?.textContent || "";
    try {
      await navigator.clipboard.writeText(textContent);
      copyBtn.innerHTML = `${copyIcon} Copied!`;
      setTimeout(() => {
        copyBtn.innerHTML = `${copyIcon} Copy Content`;
      }, 1500);
    } catch (err) {
      console.error("Failed to copy content:", err);
    }
  });

  // Read Aloud
  const speakerIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
  const readAloudBtn = document.createElement("button");
  readAloudBtn.className = "reader-dropdown-item";
  readAloudBtn.innerHTML = `${speakerIcon} Read Aloud`;
  readAloudBtn.addEventListener("click", () => {
    dropdownMenu.classList.remove("visible");
    // Send the same message as the readAloud command
    const textContent = contentWrapper?.textContent || "";
    chrome.runtime.sendMessage({
      action: "readAloud",
      text: textContent,
      title: title,
      url: window.location.href,
    });
  });

  // Assemble dropdown menu
  dropdownMenu.appendChild(tidyBtn);
  dropdownMenu.appendChild(resetBtn);
  dropdownMenu.appendChild(separator);
  dropdownMenu.appendChild(viewClipBtn);
  dropdownMenu.appendChild(copyBtn);
  dropdownMenu.appendChild(readAloudBtn);

  dropdown.appendChild(dropdownBtn);
  dropdown.appendChild(dropdownMenu);

  // Close dropdown when clicking outside
  wrapper.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target as Node)) {
      dropdownMenu.classList.remove("visible");
    }
  });

  const closeBtn = createToolbarButton("×", "Exit (Esc)", deactivateReaderMode);

  toolbar.appendChild(dropdown);
  toolbar.appendChild(closeBtn);

  // Create main container
  const container = document.createElement("div");
  container.className = "reader-mode-container";

  // Create header
  const header = document.createElement("div");
  header.className = "reader-mode-header";

  const titleElement = document.createElement("h1");
  titleElement.className = "reader-mode-title";
  titleElement.textContent = title;

  // Add clip status indicator (clickable to open in viewer)
  const clipStatus = document.createElement("a");
  clipStatus.className = "clip-status";
  clipStatus.innerHTML = '<span class="clip-status-dot"></span> Saved locally';
  clipStatus.title = "Open in clip viewer";
  clipStatus.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentClipId) {
      chrome.runtime.sendMessage({
        action: "openClipViewer",
        clipId: currentClipId,
      });
    }
  });

  header.appendChild(titleElement);
  header.appendChild(clipStatus);

  // Create content wrapper
  contentWrapper = document.createElement("div");
  contentWrapper.className = "reader-mode-content";
  contentWrapper.appendChild(content);

  // Create note editor (will be positioned next to active highlight)
  noteEditor = createNoteEditor();

  // Create reading progress indicator
  const progressBar = document.createElement("div");
  progressBar.className = "reader-progress-bar";

  // Assemble UI
  container.appendChild(header);
  container.appendChild(contentWrapper);
  wrapper.appendChild(toolbar);
  wrapper.appendChild(container);
  wrapper.appendChild(noteEditor);
  wrapper.appendChild(progressBar);
  shadowRoot.appendChild(wrapper);

  document.body.appendChild(readerModeContainer);

  // Setup event listeners
  document.addEventListener("keydown", handleReaderModeKeydown);
  setupSelectionListener();
  setupHighlightListeners();
  setupProgressIndicator(progressBar);
}

/**
 * Get current selection (works within shadow DOM)
 */
function getSelection(): Selection | null {
  // Try shadowRoot.getSelection first (for shadow DOM)
  if (shadowRoot && typeof (shadowRoot as any).getSelection === "function") {
    const shadowSelection = (shadowRoot as any).getSelection();
    if (shadowSelection && !shadowSelection.isCollapsed) {
      return shadowSelection;
    }
  }

  // Fallback to window.getSelection
  return window.getSelection();
}

/**
 * Setup text selection listener for highlighting
 */
function setupSelectionListener(): void {
  if (!shadowRoot || !contentWrapper) return;

  // Listen on the shadowRoot for mouseup events
  shadowRoot.addEventListener("mouseup", async (e) => {
    // Skip highlighting when shift is held - allow normal text selection for copying
    if ((e as MouseEvent).shiftKey) {
      return;
    }

    // Small delay to let the selection finalize
    await new Promise((resolve) => setTimeout(resolve, 10));

    const selection = getSelection();

    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      return;
    }

    // Check if selection is within our content wrapper
    const anchorNode = selection.anchorNode;
    if (!anchorNode || !contentWrapper?.contains(anchorNode)) {
      return;
    }

    // Immediately create highlight
    await createHighlightFromSelection(selection);
  });
}

/**
 * Get the text offset of a node within a container
 * This calculates the absolute character position in the text content
 */
function getTextOffset(container: Node, targetNode: Node, offset: number): number {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let accumulated = 0;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    if (node === targetNode) {
      return accumulated + offset;
    }
    accumulated += node.textContent?.length || 0;
  }

  return accumulated + offset;
}

/**
 * Create highlight from current selection
 */
async function createHighlightFromSelection(selection: Selection): Promise<void> {
  const text = selection.toString().trim();

  if (!text || !currentClipId || !contentWrapper) {
    return;
  }

  try {
    // Calculate the actual text offset in the document
    const range = selection.getRangeAt(0);
    const startOffset = getTextOffset(contentWrapper, range.startContainer, range.startOffset);
    const endOffset = getTextOffset(contentWrapper, range.endContainer, range.endOffset);

    const response = await chrome.runtime.sendMessage({
      action: "addHighlight",
      clipId: currentClipId,
      highlight: {
        text,
        startOffset,
        endOffset,
        color: "#fff3cd",
      },
    });

    if (response?.success && response?.highlight) {
      currentHighlights.push(response.highlight);
      applyHighlightToDOM(selection, response.highlight.id);
      selection.removeAllRanges();
      // updateExportButtonVisibility();
    }
  } catch (error) {
    console.error("[Reader Mode] Failed to create highlight:", error);
  }
}

/**
 * Apply highlight styling to selection, returns the mark element
 */
function applyHighlightToDOM(selection: Selection, highlightId: string): HTMLElement | null {
  const range = selection.getRangeAt(0);

  const mark = document.createElement("mark");
  mark.className = "reader-highlight";
  mark.dataset.highlightId = highlightId;

  try {
    range.surroundContents(mark);
    return mark;
  } catch {
    // Can't surround if selection spans multiple elements
    const fragment = range.extractContents();
    mark.appendChild(fragment);
    range.insertNode(mark);
    return mark;
  }
}

/**
 * Check if CSS anchor positioning is supported
 */
function supportsAnchorPositioning(): boolean {
  return CSS.supports("anchor-name", "--test");
}

/**
 * Show note editor positioned to the right of a highlight
 */
function showNoteEditor(markElement: HTMLElement, highlightId: string, existingNote: string): void {
  if (!noteEditor || !shadowRoot) return;

  activeHighlightId = highlightId;

  // Clear previous active highlights and set new one
  shadowRoot
    .querySelectorAll(".reader-highlight.active")
    .forEach((el) => el.classList.remove("active"));
  markElement.classList.add("active");

  // Fallback positioning for browsers without CSS anchor positioning
  if (!supportsAnchorPositioning()) {
    const rect = markElement.getBoundingClientRect();
    const containerRect = shadowRoot
      .querySelector(".reader-mode-container")
      ?.getBoundingClientRect();

    if (containerRect) {
      // Position to the right of the content container
      const leftPos = containerRect.right + 24;
      noteEditor.style.left = `${leftPos}px`;
      noteEditor.style.top = `${rect.top + window.scrollY}px`;
    }
  }

  // Set existing note value
  const textarea = noteEditor.querySelector(".note-textarea") as HTMLTextAreaElement;
  if (textarea) {
    textarea.value = existingNote;
    textarea.focus();
  }

  noteEditor.classList.add("visible");
}

/**
 * Hide note editor
 */
function hideNoteEditor(): void {
  if (!noteEditor || !shadowRoot) return;

  noteEditor.classList.remove("visible");
  activeHighlightId = null;

  shadowRoot
    .querySelectorAll(".reader-highlight.active")
    .forEach((el) => el.classList.remove("active"));
}

/**
 * Save the current note
 */
async function saveCurrentNote(): Promise<void> {
  if (!noteEditor || !activeHighlightId || !currentClipId || !shadowRoot) return;

  const textarea = noteEditor.querySelector(".note-textarea") as HTMLTextAreaElement;
  const note = textarea?.value || "";

  try {
    await chrome.runtime.sendMessage({
      action: "updateHighlightNote",
      clipId: currentClipId,
      highlightId: activeHighlightId,
      note,
    });

    // Update local state
    const hl = currentHighlights.find((h) => h.id === activeHighlightId);
    if (hl) hl.note = note;

    // Update has-note class on the mark element
    const markElement = shadowRoot.querySelector(`[data-highlight-id="${activeHighlightId}"]`);
    if (markElement) {
      if (note) {
        markElement.classList.add("has-note");
      } else {
        markElement.classList.remove("has-note");
      }
    }

    hideNoteEditor();
  } catch (error) {
    console.error("[Reader Mode] Failed to save note:", error);
  }
}

/**
 * Delete the current highlight
 */
async function deleteCurrentHighlight(): Promise<void> {
  if (!activeHighlightId || !currentClipId || !shadowRoot) return;

  try {
    await chrome.runtime.sendMessage({
      action: "deleteHighlight",
      clipId: currentClipId,
      highlightId: activeHighlightId,
    });

    // Remove from local state
    currentHighlights = currentHighlights.filter((h) => h.id !== activeHighlightId);

    // Unwrap the mark element
    const markElement = shadowRoot.querySelector(`[data-highlight-id="${activeHighlightId}"]`);
    if (markElement) {
      const parent = markElement.parentNode;
      while (markElement.firstChild) {
        parent?.insertBefore(markElement.firstChild, markElement);
      }
      markElement.remove();
    }

    // updateExportButtonVisibility();
    hideNoteEditor();
  } catch (error) {
    console.error("[Reader Mode] Failed to delete highlight:", error);
  }
}

/**
 * Copy the current highlight text to clipboard
 */
async function copyCurrentHighlight(): Promise<void> {
  if (!activeHighlightId) return;

  const highlightData = currentHighlights.find((h) => h.id === activeHighlightId);
  if (!highlightData) return;

  // Get the title from the reader mode header
  const titleElement = shadowRoot?.querySelector(".reader-mode-title");
  const title = titleElement?.textContent || document.title;
  const url = window.location.href;

  // Build markdown output in the same style as the main export
  const lines: string[] = [];

  // Header with title and URL
  lines.push(`[${title}](${url})`);
  lines.push("");

  // Add highlight as a blockquote with optional comment
  lines.push(`> ${highlightData.text}`);
  lines.push("");

  if (highlightData.note && highlightData.note.trim()) {
    lines.push(highlightData.note.trim());
    lines.push("");
  }

  const markdown = lines.join("\n").trim();

  const success = await copyToClipboard(markdown);
  if (success) {
    showToast("Highlight copied");
  } else {
    showToast("Failed to copy");
  }
}

/**
 * Setup highlight interaction listeners
 */
function setupHighlightListeners(): void {
  if (!contentWrapper || !noteEditor) return;

  // Click on highlight to edit note
  contentWrapper.addEventListener("click", (e) => {
    const target = e.target as Element;
    const markElement = target.closest(".reader-highlight") as HTMLElement;

    if (!markElement) {
      // Clicked outside highlight - save and hide editor
      if (activeHighlightId) {
        saveCurrentNote();
      }
      return;
    }

    const highlightId = markElement.dataset.highlightId;
    if (!highlightId) return;

    // If clicking a different highlight, save current first
    if (activeHighlightId && activeHighlightId !== highlightId) {
      saveCurrentNote();
    }

    const highlightData = currentHighlights.find((h) => h.id === highlightId);
    showNoteEditor(markElement, highlightId, highlightData?.note || "");
  });

  // Setup note editor buttons
  const copyBtn = noteEditor.querySelector(".note-copy");
  const saveBtn = noteEditor.querySelector(".note-save");
  const deleteBtn = noteEditor.querySelector(".note-delete");

  copyBtn?.addEventListener("click", () => copyCurrentHighlight());
  saveBtn?.addEventListener("click", () => saveCurrentNote());
  deleteBtn?.addEventListener("click", () => deleteCurrentHighlight());
}

/**
 * Setup reading progress indicator
 */
function setupProgressIndicator(progressBar: HTMLElement): void {
  if (!shadowRoot || !readerModeContainer) return;

  const container = readerModeContainer; // Capture for closure

  const updateProgress = (): void => {
    if (!container) return;

    // Scroll happens on the :host element (readerModeContainer), not the wrapper
    const scrollTop: number = container.scrollTop || 0;
    const scrollHeight: number = container.scrollHeight || 0;
    const clientHeight: number = container.clientHeight || 0;
    const scrollableHeight = scrollHeight - clientHeight;

    if (scrollableHeight <= 0) {
      progressBar.style.setProperty("--scroll-progress", "0%");
      return;
    }

    const progress = Math.min(100, (scrollTop / scrollableHeight) * 100);
    progressBar.style.setProperty("--scroll-progress", `${progress}%`);
  };

  // Update on scroll - attach to the host element
  container.addEventListener("scroll", updateProgress, { passive: true });
  // Initial update
  requestAnimationFrame(updateProgress);

  // Also update on resize to handle content changes
  window.addEventListener("resize", updateProgress, { passive: true });
}

/**
 * Handle keyboard events in reader mode
 */
function handleReaderModeKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && readerModeActive) {
    // First close note editor if open
    if (noteEditor?.classList.contains("visible")) {
      saveCurrentNote();
      return;
    }
    // // Then close settings panel if open
    // if (settingsPanel?.classList.contains("visible")) {
    //   settingsPanel.classList.remove("visible");
    //   return;
    // }
    event.preventDefault();
    deactivateReaderMode();
  }
}

/**
 * Stop TTS playback
 */
async function stopTTS(): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ action: "stopTTS" });
  } catch (error) {
    console.error("[Reader Mode] Failed to stop TTS:", error);
  }
}

/**
 * Deactivate reader mode and restore original content
 */
export async function deactivateReaderMode(): Promise<void> {
  if (!readerModeActive) {
    return;
  }

  try {
    // Stop TTS if playing
    await stopTTS();

    // Forget this URL so it won't auto-enter on refresh
    await forgetReaderModeUrl();

    // Remove storage change listener
    removeHighlightSyncListener();

    document.removeEventListener("keydown", handleReaderModeKeydown);

    if (readerModeContainer && readerModeContainer.parentNode) {
      readerModeContainer.parentNode.removeChild(readerModeContainer);
    }

    restoreOriginalContent();

    // Reset state
    readerModeActive = false;
    readerModeContainer = null;
    shadowRoot = null;
    contentWrapper = null;
    // settingsPanel = null;
    noteEditor = null;
    activeHighlightId = null;
    currentClipId = null;
    currentHighlights = [];
    // editModeActive = false;
    // editModeBtn = null;
    // tidyBtn = null;
    // resetBtn = null;
    // exportBtn = null;
    // ttsBtn = null;
    // ttsPlayerContainer = null;
  } catch (error) {
    console.error("[Reader Mode] Error deactivating reader mode:", error);
  }
}

/**
 * Toggle reader mode on/off
 */
export function toggleReaderMode(): void {
  if (readerModeActive) {
    deactivateReaderMode();
  } else {
    activateReaderMode();
  }
}

/**
 * Check if reader mode is currently active
 */
export function isReaderModeActive(): boolean {
  return readerModeActive;
}
