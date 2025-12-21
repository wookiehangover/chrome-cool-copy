/**
 * URL Cleaner Module
 * Handles URL cleaning and copy operations
 */

import { copyToClipboard } from "../clipboard.js";
import { showToast } from "../toast.js";

// List of common tracking parameters to remove
export const TRACKING_PARAMS: readonly string[] = [
  // UTM parameters
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_source_platform",
  "utm_creative_format",
  "utm_marketing_tactic",

  // Facebook
  "fbclid",
  "fb_action_ids",
  "fb_action_types",
  "fb_ref",
  "fb_source",

  // Google
  "gclid",
  "gclsrc",
  "dclid",
  "gbraid",
  "wbraid",

  // Other common tracking parameters
  "ref",
  "source",
  "mc_cid",
  "mc_eid",
  "_ga",
  "_gl",
  "msclkid",
  "igshid",
  "twclid",
  "li_fat_id",
  "wickedid",
  "yclid",
  "ncid",
  "srsltid",
  "si",
  "feature",
  "app",
  "ved",
  "usg",
  "sa",
  "ei",
  "bvm",
  "sxsrf",
];

/**
 * Clean URL by removing tracking parameters
 * @param url - The URL to clean
 * @returns The cleaned URL
 */
export function cleanUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);

    // Remove tracking parameters
    TRACKING_PARAMS.forEach((param) => {
      params.delete(param);
    });

    // Reconstruct the URL
    urlObj.search = params.toString();

    // Return the clean URL (remove trailing '?' if no params remain)
    let cleanedUrl = urlObj.toString();
    if (cleanedUrl.endsWith("?")) {
      cleanedUrl = cleanedUrl.slice(0, -1);
    }

    return cleanedUrl;
  } catch (error) {
    console.error("Error cleaning URL:", error);
    return url; // Return original URL if parsing fails
  }
}

/**
 * Handle the copy clean URL action
 */
export async function handleCopyCleanUrl(): Promise<void> {
  const currentUrl = window.location.href;
  const cleanedUrl = cleanUrl(currentUrl);

  const success = await copyToClipboard(cleanedUrl);

  if (success) {
    showToast("✓ Link copied");
  } else {
    showToast("× Failed to copy link");
  }
}
