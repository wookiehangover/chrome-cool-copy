/**
 * Grokipedia Banner Component
 * Displays a fixed-position banner at the top of Wikipedia article pages
 * only when a corresponding Grokipedia page exists
 */

import styles from "./grokipedia-banner.css";
import { getWikipediaArticle } from "./wikipedia-detector.js";
import { checkGrokipediaPageExists } from "./grokipedia-checker.js";

let bannerElement: HTMLDivElement | null = null;
let styleInjected = false;
let bannerEnabled = true; // Default to enabled
let currentArticleTitle: string | null = null;

const BANNER_STATE_KEY = "grokipedia_banner_enabled";
const GROKIPEDIA_BASE_URL = "https://grokipedia.com/page";

/**
 * Inject banner styles into the page
 */
function injectStyles(): void {
  if (styleInjected) return;

  const style = document.createElement("style");
  style.id = "grokipedia-banner-styles";
  style.textContent = styles;
  document.head.appendChild(style);
  styleInjected = true;
}

/**
 * Build the Grokipedia URL for an article
 */
function getGrokipediaUrl(articleTitle: string): string {
  const encodedTitle = encodeURIComponent(articleTitle.trim());
  return `${GROKIPEDIA_BASE_URL}/${encodedTitle}`;
}

/**
 * Create and display the banner for a specific article
 */
function displayBanner(articleTitle: string): void {
  // Don't show if already displayed
  if (bannerElement) {
    return;
  }

  // Inject styles
  injectStyles();

  const grokipediaUrl = getGrokipediaUrl(articleTitle);

  // Create banner element
  bannerElement = document.createElement("div");
  bannerElement.id = "grokipedia-banner";
  bannerElement.className = "grokipedia-banner";

  // Create banner content
  bannerElement.innerHTML = `
    <div class="grokipedia-banner-content">
      <span class="grokipedia-banner-text">
        View on
        <a href="${grokipediaUrl}" target="_blank" rel="noopener noreferrer" class="grokipedia-banner-link">
          Grokipedia
        </a>
      </span>
      <button class="grokipedia-banner-close" aria-label="Dismiss" type="button">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M11 3L3 11M3 3L11 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  `;

  // Add close button handler
  const closeButton = bannerElement.querySelector(".grokipedia-banner-close");
  if (closeButton) {
    closeButton.addEventListener("click", dismissBanner);
  }

  // Add to page
  if (document.body) {
    document.body.insertBefore(bannerElement, document.body.firstChild);
  }
}

/**
 * Check conditions and show banner if appropriate
 */
export async function showGrokipediaBanner(): Promise<void> {
  try {
    // Get the article title (returns null for non-article pages)
    const articleTitle = getWikipediaArticle();
    if (!articleTitle) {
      return;
    }

    // Check if Grokipedia page exists for this article
    const exists = await checkGrokipediaPageExists(articleTitle);
    if (!exists) {
      return;
    }

    currentArticleTitle = articleTitle;
    displayBanner(articleTitle);
  } catch (error) {
    console.error("[Grokipedia Banner] Error showing banner:", error);
  }
}

/**
 * Dismiss the banner
 */
export function dismissBanner(): void {
  try {
    if (bannerElement && bannerElement.parentNode) {
      bannerElement.remove();
      bannerElement = null;
    }
  } catch (error) {
    console.error("[Grokipedia Banner] Error dismissing banner:", error);
  }
}

/**
 * Load banner enabled state from storage
 */
async function loadBannerState(): Promise<void> {
  try {
    const stored = localStorage.getItem(BANNER_STATE_KEY);
    if (stored !== null) {
      bannerEnabled = JSON.parse(stored);
    }
  } catch (error) {
    console.error("[Grokipedia Banner] Error loading state:", error);
    // Default to enabled on error
    bannerEnabled = true;
  }
}

/**
 * Save banner enabled state to storage
 */
async function saveBannerState(): Promise<void> {
  try {
    localStorage.setItem(BANNER_STATE_KEY, JSON.stringify(bannerEnabled));
  } catch (error) {
    console.error("[Grokipedia Banner] Error saving state:", error);
  }
}

/**
 * Check if the banner is currently enabled
 */
export function isBannerEnabled(): boolean {
  return bannerEnabled;
}

/**
 * Toggle the banner enabled state
 * @returns The new enabled state
 */
export async function toggleBannerState(): Promise<boolean> {
  bannerEnabled = !bannerEnabled;
  await saveBannerState();

  // If disabling, dismiss the banner if it's showing
  if (!bannerEnabled) {
    dismissBanner();
  } else {
    // If enabling, try to show the banner (will check conditions)
    showGrokipediaBanner();
  }

  return bannerEnabled;
}

/**
 * Initialize the banner feature
 */
export function initializeGrokipediaBanner(): void {
  try {
    // Load saved state first
    loadBannerState().then(() => {
      // Only show banner if enabled
      if (!bannerEnabled) {
        return;
      }

      // Show banner when page loads
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", showGrokipediaBanner);
      } else {
        showGrokipediaBanner();
      }
    });
  } catch (error) {
    console.error("[Grokipedia Banner] Initialization failed:", error);
  }
}

