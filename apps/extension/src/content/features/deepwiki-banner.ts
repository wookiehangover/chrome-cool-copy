/**
 * DeepWiki Banner Component
 * Displays a fixed-position banner at the top of GitHub repository pages
 * linking to the DeepWiki equivalent page
 */

import styles from "./deepwiki-banner.css?raw";
import { getGitHubRepo } from "./github-detector.js";

let bannerElement: HTMLDivElement | null = null;
let styleInjected = false;
let bannerEnabled = true; // Default to enabled

const BANNER_STATE_KEY = "deepwiki_banner_enabled";
const DEEPWIKI_BASE_URL = "https://deepwiki.com";

/**
 * Inject banner styles into the page
 */
function injectStyles(): void {
  if (styleInjected) return;

  const style = document.createElement("style");
  style.id = "deepwiki-banner-styles";
  style.textContent = styles;
  document.head.appendChild(style);
  styleInjected = true;
}

/**
 * Build the DeepWiki URL for a GitHub repo
 */
function getDeepWikiUrl(owner: string, repo: string): string {
  return `${DEEPWIKI_BASE_URL}/${owner}/${repo}`;
}

/**
 * Create and display the banner for a specific repo
 */
function displayBanner(owner: string, repo: string): void {
  // Don't show if already displayed
  if (bannerElement) {
    return;
  }

  // Inject styles
  injectStyles();

  const deepwikiUrl = getDeepWikiUrl(owner, repo);

  // Create banner element
  bannerElement = document.createElement("div");
  bannerElement.id = "deepwiki-banner";
  bannerElement.className = "deepwiki-banner";

  // Create banner content
  bannerElement.innerHTML = `
    <div class="deepwiki-banner-content">
      <span class="deepwiki-banner-text">
        View on
        <a href="${deepwikiUrl}" target="_blank" rel="noopener noreferrer" class="deepwiki-banner-link">
          DeepWiki
        </a>
      </span>
      <button class="deepwiki-banner-close" aria-label="Dismiss" type="button">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M11 3L3 11M3 3L11 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  `;

  // Add close button handler
  const closeButton = bannerElement.querySelector(".deepwiki-banner-close");
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
export function showDeepWikiBanner(): void {
  try {
    // Get the repo info (returns null for non-repo pages)
    const repoInfo = getGitHubRepo();
    if (!repoInfo) {
      return;
    }

    displayBanner(repoInfo.owner, repoInfo.repo);
  } catch (error) {
    console.error("[DeepWiki Banner] Error showing banner:", error);
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
    console.error("[DeepWiki Banner] Error dismissing banner:", error);
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
    console.error("[DeepWiki Banner] Error loading state:", error);
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
    console.error("[DeepWiki Banner] Error saving state:", error);
  }
}

/**
 * Check if the banner is currently enabled
 */
export function isDeepWikiBannerEnabled(): boolean {
  return bannerEnabled;
}

/**
 * Toggle the banner enabled state
 * @returns The new enabled state
 */
export async function toggleDeepWikiBannerState(): Promise<boolean> {
  bannerEnabled = !bannerEnabled;
  await saveBannerState();

  // If disabling, dismiss the banner if it's showing
  if (!bannerEnabled) {
    dismissBanner();
  } else {
    // If enabling, try to show the banner (will check conditions)
    showDeepWikiBanner();
  }

  return bannerEnabled;
}

/**
 * Initialize the banner feature
 */
export function initializeDeepWikiBanner(): void {
  try {
    // Load saved state first
    loadBannerState().then(() => {
      // Only show banner if enabled
      if (!bannerEnabled) {
        return;
      }

      // Show banner when page loads
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", showDeepWikiBanner);
      } else {
        showDeepWikiBanner();
      }
    });
  } catch (error) {
    console.error("[DeepWiki Banner] Initialization failed:", error);
  }
}

