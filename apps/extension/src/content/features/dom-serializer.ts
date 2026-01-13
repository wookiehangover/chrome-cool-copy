/**
 * DOM Serializer
 * Converts DOM elements to clean, self-contained HTML strings
 * Removes scripts, event handlers, and converts relative URLs to absolute
 */

/**
 * Serialize a DOM element to a clean HTML string
 * - Clones the element
 * - Removes all script tags and event handlers
 * - Converts relative URLs to absolute using the page's base URL
 * - Preserves class names, data-* attributes, and ARIA attributes
 * @param element - The element to serialize
 * @returns Clean, self-contained HTML string
 */
export function serializeDOM(element: Element): string {
  // Clone the element to avoid modifying the original
  const clone = element.cloneNode(true) as Element;

  // Remove all script tags
  clone.querySelectorAll("script").forEach((script) => script.remove());

  // Remove all style tags (to avoid inline styles that might reference external resources)
  clone.querySelectorAll("style").forEach((style) => style.remove());

  // Remove all event handler attributes
  removeEventHandlers(clone);

  // Convert relative URLs to absolute
  convertRelativeUrlsToAbsolute(clone);

  // Return the serialized HTML
  return clone.outerHTML;
}

/**
 * Recursively remove all event handler attributes from an element and its children
 * Removes attributes like onclick, onload, onmouseover, etc.
 */
function removeEventHandlers(element: Element): void {
  // Get all attributes that start with "on"
  const attributesToRemove: string[] = [];

  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    if (attr.name.toLowerCase().startsWith("on")) {
      attributesToRemove.push(attr.name);
    }
  }

  // Remove the event handler attributes
  attributesToRemove.forEach((attrName) => {
    element.removeAttribute(attrName);
  });

  // Recursively process all child elements
  element.querySelectorAll("*").forEach((child) => {
    const childAttributesToRemove: string[] = [];

    for (let i = 0; i < child.attributes.length; i++) {
      const attr = child.attributes[i];
      if (attr.name.toLowerCase().startsWith("on")) {
        childAttributesToRemove.push(attr.name);
      }
    }

    childAttributesToRemove.forEach((attrName) => {
      child.removeAttribute(attrName);
    });
  });
}

/**
 * Convert all relative URLs in href and src attributes to absolute URLs
 * Uses the page's base URL (window.location.origin)
 */
function convertRelativeUrlsToAbsolute(element: Element): void {
  const baseUrl = window.location.origin;

  // Process href attributes (links, anchors, etc.)
  element.querySelectorAll("[href]").forEach((el) => {
    const href = el.getAttribute("href");
    if (href && !isAbsoluteUrl(href)) {
      try {
        const absoluteUrl = new URL(href, baseUrl).href;
        el.setAttribute("href", absoluteUrl);
      } catch (error) {
        console.warn("[DOM Serializer] Failed to convert href:", href, error);
      }
    }
  });

  // Process src attributes (images, scripts, iframes, etc.)
  element.querySelectorAll("[src]").forEach((el) => {
    const src = el.getAttribute("src");
    if (src && !isAbsoluteUrl(src)) {
      try {
        const absoluteUrl = new URL(src, baseUrl).href;
        el.setAttribute("src", absoluteUrl);
      } catch (error) {
        console.warn("[DOM Serializer] Failed to convert src:", src, error);
      }
    }
  });

  // Process srcset attributes (responsive images)
  element.querySelectorAll("[srcset]").forEach((el) => {
    const srcset = el.getAttribute("srcset");
    if (srcset) {
      try {
        const convertedSrcset = srcset
          .split(",")
          .map((entry) => {
            const [url, descriptor] = entry.trim().split(/\s+(?=\d)/);
            if (url && !isAbsoluteUrl(url)) {
              const absoluteUrl = new URL(url, baseUrl).href;
              return descriptor ? `${absoluteUrl} ${descriptor}` : absoluteUrl;
            }
            return entry.trim();
          })
          .join(", ");
        el.setAttribute("srcset", convertedSrcset);
      } catch (error) {
        console.warn("[DOM Serializer] Failed to convert srcset:", srcset, error);
      }
    }
  });

  // Process data attributes that might contain URLs (e.g., data-src for lazy loading)
  element.querySelectorAll("[data-src]").forEach((el) => {
    const dataSrc = el.getAttribute("data-src");
    if (dataSrc && !isAbsoluteUrl(dataSrc)) {
      try {
        const absoluteUrl = new URL(dataSrc, baseUrl).href;
        el.setAttribute("data-src", absoluteUrl);
      } catch (error) {
        console.warn("[DOM Serializer] Failed to convert data-src:", dataSrc, error);
      }
    }
  });
}

/**
 * Check if a URL is absolute (starts with http://, https://, //, or data:)
 */
function isAbsoluteUrl(url: string): boolean {
  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("//") ||
    url.startsWith("data:") ||
    url.startsWith("blob:")
  );
}

