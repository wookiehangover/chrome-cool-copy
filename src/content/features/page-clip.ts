/**
 * Page Clip Utilities
 * Collects page data safely with size and origin guards
 */

import { showToast } from "../toast.js";

export interface PageClipPayload {
  url: string;
  title: string;
  domContent: string;
  textContent: string;
  metadata: {
    description: string;
    keywords: string;
    author: string;
    ogTitle: string;
    ogDescription: string;
    ogImage: string;
  };
}

// Rough payload cap to avoid accidentally shipping very large pages upstream
const MAX_CLIP_BYTES = 1_000_000; // ~1MB

function isPrivateHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.startsWith("127.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    hostname.endsWith(".local")
  );
}

/**
 * Build the clip payload and enforce safety checks
 */
export function buildPageClipPayload(): PageClipPayload {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;

  if (protocol !== "http:" && protocol !== "https:") {
    throw new Error("Clipping is only supported on http/https pages.");
  }

  const requiresConsent = protocol === "http:" || isPrivateHost(hostname);
  if (requiresConsent) {
    const confirmed = window.confirm(
      `Clip this page from ${hostname}? It may contain sensitive content.`,
    );
    if (!confirmed) {
      throw new Error("Clipping cancelled by user.");
    }
  }

  const domContent = document.documentElement.outerHTML;
  const textContent = document.body?.innerText || "";

  // Estimate payload size in bytes using TextEncoder
  const encoder = new TextEncoder();
  const estimatedBytes = encoder.encode(domContent).length + encoder.encode(textContent).length;
  if (estimatedBytes > MAX_CLIP_BYTES) {
    throw new Error("Page is too large to clip safely.");
  }

  const payload: PageClipPayload = {
    url: window.location.href,
    title: document.title,
    domContent,
    textContent,
    metadata: {
      description: document.querySelector('meta[name="description"]')?.getAttribute("content") || "",
      keywords: document.querySelector('meta[name="keywords"]')?.getAttribute("content") || "",
      author: document.querySelector('meta[name="author"]')?.getAttribute("content") || "",
      ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute("content") || "",
      ogDescription:
        document.querySelector('meta[property="og:description"]')?.getAttribute("content") || "",
      ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute("content") || "",
    },
  };

  return payload;
}

/**
 * Helper to send a toast for clipping errors
 */
export function handleClipError(error: unknown): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error("[Clean Link Copy] Clip error:", errorMessage);
  showToast("Error: " + errorMessage);
}
