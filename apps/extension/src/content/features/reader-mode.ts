/**
 * Reader Mode
 * Provides a clean, distraction-free reading experience by extracting
 * and displaying the main article content with optimized typography
 * Uses Shadow DOM for complete style isolation
 */

import { showToast } from "../toast.js";
import styles from "./reader-mode.css";

let readerModeActive = false;
let readerModeContainer: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let originalPageDisplay: string = "";
let originalBodyOverflow: string = "";

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
  // Try semantic elements first
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
 * Activate reader mode
 */
export function activateReaderMode(): void {
  if (readerModeActive) {
    showToast("Reader mode already active");
    return;
  }

  try {
    // Extract article content
    const { title, content } = extractArticleContent();

    // Create reader mode container with Shadow DOM
    createReaderModeUI(title, content);

    // Hide the original page content
    hideOriginalContent();

    readerModeActive = true;
    showToast("Reader mode activated");
  } catch (error) {
    console.error("[Reader Mode] Error activating reader mode:", error);
    showToast("Failed to activate reader mode");
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
 * Create the reader mode UI with Shadow DOM
 */
function createReaderModeUI(title: string, content: Element): void {
  // Create a div element for reader mode container
  // Shadow DOM can be attached to any element, no need for custom element registration
  readerModeContainer = document.createElement("div");
  readerModeContainer.id = "reader-mode-root";

  // Attach closed shadow DOM for complete encapsulation
  shadowRoot = readerModeContainer.attachShadow({ mode: "closed" });

  // Inject styles into shadow DOM
  const styleElement = document.createElement("style");
  styleElement.textContent = styles;
  shadowRoot.appendChild(styleElement);

  // Create wrapper div for background
  const wrapper = document.createElement("div");
  wrapper.className = "reader-mode-wrapper";

  // Create reader mode container
  const container = document.createElement("div");
  container.className = "reader-mode-container";

  // Create header with title and close button
  const header = document.createElement("div");
  header.className = "reader-mode-header";

  const titleElement = document.createElement("h1");
  titleElement.className = "reader-mode-title";
  titleElement.textContent = title;

  const closeButton = document.createElement("button");
  closeButton.className = "reader-mode-close";
  closeButton.innerHTML = "✕";
  closeButton.title = "Exit reader mode (Esc)";
  closeButton.addEventListener("click", deactivateReaderMode);

  header.appendChild(closeButton);
  header.appendChild(titleElement);

  // Create content wrapper
  const contentWrapper = document.createElement("div");
  contentWrapper.className = "reader-mode-content";
  contentWrapper.appendChild(content);

  // Assemble the UI
  container.appendChild(header);
  container.appendChild(contentWrapper);
  wrapper.appendChild(container);
  shadowRoot.appendChild(wrapper);

  // Add to document body
  document.body.appendChild(readerModeContainer);

  // Add keyboard listener for ESC key
  document.addEventListener("keydown", handleReaderModeKeydown);
}

/**
 * Handle keyboard events in reader mode
 */
function handleReaderModeKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && readerModeActive) {
    event.preventDefault();
    deactivateReaderMode();
  }
}

/**
 * Deactivate reader mode and restore original content
 */
export function deactivateReaderMode(): void {
  if (!readerModeActive) {
    return;
  }

  try {
    // Remove keyboard listener
    document.removeEventListener("keydown", handleReaderModeKeydown);

    // Remove reader mode container
    if (readerModeContainer && readerModeContainer.parentNode) {
      readerModeContainer.parentNode.removeChild(readerModeContainer);
    }

    // Restore original page visibility
    restoreOriginalContent();

    // Reset state
    readerModeActive = false;
    readerModeContainer = null;
    shadowRoot = null;

    showToast("Reader mode deactivated");
  } catch (error) {
    console.error("[Reader Mode] Error deactivating reader mode:", error);
    showToast("Failed to deactivate reader mode");
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

