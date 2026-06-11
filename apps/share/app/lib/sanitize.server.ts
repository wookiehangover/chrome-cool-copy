/**
 * Server-side HTML sanitization for clip content.
 *
 * Shared clip pages render `dom_content` via dangerouslySetInnerHTML on a
 * public origin, so the stored HTML must be sanitized before it reaches the
 * browser. Sanitizing here (server-side, in `.server.ts`) keeps jsdom out of
 * the client bundle and ensures the SSR response is already clean.
 */

import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize untrusted article HTML, stripping scripts, event-handler
 * attributes, and other active/embeddable content while preserving normal
 * formatting, links, images, and inline styles so the clip still renders as
 * captured.
 *
 * DOMPurify's defaults already remove `<script>`, `on*` handler attributes,
 * and `javascript:` URLs (and sanitize CSS inside `style`). We additionally
 * forbid embedding tags that can load external active content on the public
 * share origin.
 */
export function sanitizeClipHtml(html: string): string {
  if (!html) return "";

  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ["iframe", "object", "embed", "form"],
  });
}
