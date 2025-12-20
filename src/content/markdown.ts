/**
 * Markdown utilities for creating and copying markdown links
 */

import { copyToClipboard } from "./clipboard.js";
import { showToast } from "./toast.js";
import { cleanUrl } from "./url-cleaner.js";

/**
 * Get the page title
 * @returns The page title
 */
export function getPageTitle(): string {
  return document.title || "Untitled";
}

/**
 * Create a markdown link
 * @param url - The URL
 * @param title - The link title
 * @returns The markdown formatted link
 */
export function createMarkdownLink(url: string, title: string): string {
  // Escape square brackets in title
  const escapedTitle = title.replace(/\[/g, "\\[").replace(/\]/g, "\\]");
  return `[${escapedTitle}](${url})`;
}

/**
 * Handle the copy markdown link action
 */
export async function handleCopyMarkdownLink(): Promise<void> {
  const currentUrl = window.location.href;
  const cleanedUrl = cleanUrl(currentUrl);
  const pageTitle = getPageTitle();
  const markdownLink = createMarkdownLink(cleanedUrl, pageTitle);

  const success = await copyToClipboard(markdownLink);

  if (success) {
    showToast("✓ Link copied");
  } else {
    showToast("× Failed to copy link");
  }
}
