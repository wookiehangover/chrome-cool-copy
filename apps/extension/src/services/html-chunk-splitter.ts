/**
 * HTML Chunk Splitter Service
 *
 * Splits HTML content by semantic boundaries (h1, h2, h3 headings)
 * into chunks targeting 3000-5000 characters while preserving valid HTML structure.
 */

export type HtmlChunk = {
  id: string;
  html: string;
};

export type HtmlChunkOptions = {
  /** Minimum characters per chunk (default: 3000) */
  minChars?: number;
  /** Maximum characters per chunk (default: 5000) */
  maxChars?: number;
};

const HEADING_SELECTORS = "h1, h2, h3";
const DEFAULT_MIN_CHARS = 3000;
const DEFAULT_MAX_CHARS = 5000;

/**
 * Split HTML content into semantic chunks based on headings.
 */
export function getHtmlChunks(html: string, options?: HtmlChunkOptions): HtmlChunk[] {
  const { minChars = DEFAULT_MIN_CHARS, maxChars = DEFAULT_MAX_CHARS } = options || {};

  if (minChars > maxChars) {
    throw new Error("minChars must be less than or equal to maxChars");
  }

  const trimmed = html.trim();
  if (!trimmed) {
    return [];
  }

  // Parse HTML into a DOM
  const parser = new DOMParser();
  const doc = parser.parseFromString(trimmed, "text/html");
  const body = doc.body;

  // If content is small enough, return as single chunk
  if (body.innerHTML.length <= maxChars) {
    return [createChunk(body.innerHTML)];
  }

  // Find all headings to use as split points
  const headings = Array.from(body.querySelectorAll(HEADING_SELECTORS));

  if (headings.length === 0) {
    // No headings - split by top-level elements
    return splitByTopLevelElements(body, minChars, maxChars);
  }

  return splitByHeadings(body, headings, minChars, maxChars);
}

function createChunk(html: string): HtmlChunk {
  return {
    id: crypto.randomUUID(),
    html: html.trim(),
  };
}

/**
 * Split content by heading boundaries.
 * Each section includes a heading and all content until the next heading.
 */
function splitByHeadings(
  body: HTMLElement,
  headings: Element[],
  minChars: number,
  maxChars: number,
): HtmlChunk[] {
  const chunks: HtmlChunk[] = [];
  const sections: string[] = [];

  // Get all child nodes to iterate through
  const children = Array.from(body.childNodes);
  let currentSection = "";

  for (const node of children) {
    const nodeHtml = getNodeHtml(node);
    const isHeading = node.nodeType === Node.ELEMENT_NODE && headings.includes(node as Element);

    if (isHeading && currentSection.trim()) {
      // Save current section and start new one
      sections.push(currentSection);
      currentSection = nodeHtml;
    } else {
      currentSection += nodeHtml;
    }
  }

  // Don't forget the last section
  if (currentSection.trim()) {
    sections.push(currentSection);
  }

  // Now combine sections into chunks respecting size limits
  let currentChunk = "";

  for (const section of sections) {
    const combined = currentChunk + section;

    if (combined.length <= maxChars) {
      currentChunk = combined;
    } else if (section.length > maxChars) {
      // Section itself is too large - save current and split the section
      if (currentChunk.trim().length >= minChars) {
        chunks.push(createChunk(currentChunk));
        currentChunk = "";
      }
      // Split large section by its child elements
      const largeChunks = splitLargeSection(section, minChars, maxChars);
      chunks.push(...largeChunks);
    } else if (currentChunk.length >= minChars) {
      // Current chunk is big enough, save it and start fresh
      chunks.push(createChunk(currentChunk));
      currentChunk = section;
    } else {
      // Current chunk too small, but combined too big - need to split
      chunks.push(createChunk(combined.slice(0, maxChars)));
      currentChunk = combined.slice(maxChars);
    }
  }

  // Handle remaining content
  if (currentChunk.trim()) {
    if (currentChunk.length >= minChars || chunks.length === 0) {
      chunks.push(createChunk(currentChunk));
    } else {
      // Try to append to last chunk
      const last = chunks[chunks.length - 1];
      if (last.html.length + currentChunk.length <= maxChars) {
        chunks[chunks.length - 1] = createChunk(last.html + currentChunk);
      } else {
        chunks.push(createChunk(currentChunk));
      }
    }
  }

  return chunks;
}

function getNodeHtml(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || "";
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    return (node as Element).outerHTML;
  }
  return "";
}

/**
 * Split content by top-level elements when no headings are present.
 */
function splitByTopLevelElements(
  body: HTMLElement,
  minChars: number,
  maxChars: number,
): HtmlChunk[] {
  const chunks: HtmlChunk[] = [];
  const children = Array.from(body.childNodes);
  let currentChunk = "";

  for (const node of children) {
    const nodeHtml = getNodeHtml(node);

    if (!nodeHtml.trim()) continue;

    const combined = currentChunk + nodeHtml;

    if (combined.length <= maxChars) {
      currentChunk = combined;
    } else if (nodeHtml.length > maxChars) {
      // Single element too large
      if (currentChunk.trim().length >= minChars) {
        chunks.push(createChunk(currentChunk));
        currentChunk = "";
      }
      // Try to split the large element's children
      if (node.nodeType === Node.ELEMENT_NODE) {
        const largeChunks = splitLargeElement(node as Element, minChars, maxChars);
        chunks.push(...largeChunks);
      } else {
        // Text node too large - just split by character
        const textChunks = splitTextBySize(nodeHtml, maxChars);
        chunks.push(...textChunks.map(createChunk));
      }
    } else if (currentChunk.length >= minChars) {
      chunks.push(createChunk(currentChunk));
      currentChunk = nodeHtml;
    } else {
      // Merge small chunks
      currentChunk = combined;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(createChunk(currentChunk));
  }

  return chunks;
}

/**
 * Split a large HTML section (string) into smaller chunks.
 */
function splitLargeSection(sectionHtml: string, minChars: number, maxChars: number): HtmlChunk[] {
  // Parse this section and split by its children
  const parser = new DOMParser();
  const doc = parser.parseFromString(sectionHtml, "text/html");
  return splitByTopLevelElements(doc.body, minChars, maxChars);
}

/**
 * Split a large element by its children recursively.
 */
function splitLargeElement(element: Element, minChars: number, maxChars: number): HtmlChunk[] {
  const chunks: HtmlChunk[] = [];
  const children = Array.from(element.childNodes);

  if (children.length === 0) {
    // No children - split text content
    const text = element.outerHTML;
    return splitTextBySize(text, maxChars).map(createChunk);
  }

  let currentChunk = "";
  const tagName = element.tagName.toLowerCase();
  const openTag = getOpenTag(element);
  const closeTag = `</${tagName}>`;

  for (const child of children) {
    const childHtml = getNodeHtml(child);
    if (!childHtml.trim()) continue;

    // Calculate size including wrapper tags
    const wrappedSize = openTag.length + currentChunk.length + childHtml.length + closeTag.length;

    if (wrappedSize <= maxChars) {
      currentChunk += childHtml;
    } else if (childHtml.length > maxChars - openTag.length - closeTag.length) {
      // Child itself is too large
      if (currentChunk.trim()) {
        chunks.push(createChunk(openTag + currentChunk + closeTag));
        currentChunk = "";
      }
      if (child.nodeType === Node.ELEMENT_NODE) {
        chunks.push(...splitLargeElement(child as Element, minChars, maxChars));
      } else {
        chunks.push(...splitTextBySize(childHtml, maxChars).map(createChunk));
      }
    } else {
      // Save current and start new
      if (currentChunk.trim()) {
        chunks.push(createChunk(openTag + currentChunk + closeTag));
      }
      currentChunk = childHtml;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(createChunk(openTag + currentChunk + closeTag));
  }

  return chunks;
}

/**
 * Get the opening tag of an element including its attributes.
 */
function getOpenTag(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const attrs = Array.from(element.attributes)
    .map((attr) => `${attr.name}="${attr.value}"`)
    .join(" ");
  return attrs ? `<${tag} ${attrs}>` : `<${tag}>`;
}

/**
 * Split text into chunks of specified max size.
 */
function splitTextBySize(text: string, maxSize: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxSize) {
    chunks.push(remaining.slice(0, maxSize));
    remaining = remaining.slice(maxSize);
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}
