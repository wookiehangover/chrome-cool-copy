/**
 * Structured Data Extractor
 * Extracts JSON-LD, microdata, Open Graph, and ARIA attributes from a webpage
 */

import type { StructuredData } from "@repo/shared/types";

/**
 * Extracts structured data from an element and its context
 * @param element - The DOM element to extract data from
 * @returns StructuredData object containing JSON-LD, microdata, Open Graph, and ARIA attributes
 */
export function extractStructuredData(element: Element): StructuredData {
  return {
    jsonLd: extractJsonLd(),
    microdata: extractMicrodata(element),
    openGraph: extractOpenGraph(),
    ariaAttributes: extractAriaAttributes(element),
  };
}

/**
 * Extracts JSON-LD data from script[type="application/ld+json"] tags
 */
function extractJsonLd(): Record<string, unknown>[] {
  const jsonLdScripts = document.querySelectorAll(
    'script[type="application/ld+json"]'
  );
  const jsonLdData: Record<string, unknown>[] = [];

  jsonLdScripts.forEach((script) => {
    try {
      const content = script.textContent;
      if (content) {
        const parsed = JSON.parse(content);
        jsonLdData.push(parsed);
      }
    } catch (error) {
      // Silently skip malformed JSON-LD
      console.debug("Failed to parse JSON-LD:", error);
    }
  });

  return jsonLdData;
}

/**
 * Extracts microdata from elements with itemscope/itemprop attributes
 */
function extractMicrodata(
  element: Element
): Array<{ itemtype?: string; properties: Record<string, string[]> }> {
  const microdataItems: Array<{
    itemtype?: string;
    properties: Record<string, string[]>;
  }> = [];

  // Find all elements with itemscope within or near the element
  const scopedElements = element.querySelectorAll("[itemscope]");

  scopedElements.forEach((scopedElement) => {
    const itemtype = scopedElement.getAttribute("itemtype");
    const properties: Record<string, string[]> = {};

    // Extract all itemprop elements within this scope
    const propElements = scopedElement.querySelectorAll("[itemprop]");
    propElements.forEach((propElement) => {
      const propName = propElement.getAttribute("itemprop");
      if (propName) {
        let propValue = "";

        // Get value based on element type
        if (propElement instanceof HTMLMetaElement) {
          propValue = propElement.content;
        } else if (propElement instanceof HTMLAnchorElement) {
          propValue = propElement.href;
        } else if (propElement instanceof HTMLImageElement) {
          propValue = propElement.src;
        } else {
          propValue = propElement.textContent || "";
        }

        if (!properties[propName]) {
          properties[propName] = [];
        }
        properties[propName].push(propValue.trim());
      }
    });

    microdataItems.push({
      itemtype: itemtype || undefined,
      properties,
    });
  });

  return microdataItems;
}

/**
 * Extracts Open Graph meta tags
 */
function extractOpenGraph(): Record<string, string> {
  const ogData: Record<string, string> = {};
  const metaTags = document.querySelectorAll('meta[property^="og:"]');

  metaTags.forEach((tag) => {
    const property = tag.getAttribute("property");
    const content = tag.getAttribute("content");

    if (property && content) {
      ogData[property] = content;
    }
  });

  return ogData;
}

/**
 * Extracts ARIA attributes from an element and its descendants
 */
function extractAriaAttributes(element: Element): Record<string, string[]> {
  const ariaAttrs: Record<string, string[]> = {};

  // Get all elements including the root element
  const allElements = [element, ...Array.from(element.querySelectorAll("*"))];

  allElements.forEach((el) => {
    // Get all attributes
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.startsWith("aria-")) {
        if (!ariaAttrs[attr.name]) {
          ariaAttrs[attr.name] = [];
        }
        // Only add unique values
        if (!ariaAttrs[attr.name].includes(attr.value)) {
          ariaAttrs[attr.name].push(attr.value);
        }
      }
    });
  });

  return ariaAttrs;
}

