/**
 * Check if an element has visual styling (gradients, shadows, transforms, etc.)
 * @param {Element} element - The element to check
 * @returns {boolean} - True if element has significant visual styling
 */
export function hasVisualStyling(element: Element): boolean {
  if (!element) return false;

  const computedStyle = window.getComputedStyle(element);

  // Check for background images
  const backgroundImage = computedStyle.backgroundImage;
  if (backgroundImage && backgroundImage !== "none") {
    return true;
  }

  // Check for gradients in background
  if (
    backgroundImage &&
    (backgroundImage.includes("gradient") || backgroundImage.includes("url"))
  ) {
    return true;
  }

  // Check for box-shadow or text-shadow
  const boxShadow = computedStyle.boxShadow;
  const textShadow = computedStyle.textShadow;
  if ((boxShadow && boxShadow !== "none") || (textShadow && textShadow !== "none")) {
    return true;
  }

  // Check for transforms
  const transform = computedStyle.transform;
  if (transform && transform !== "none") {
    return true;
  }

  // Check for filters
  const filter = computedStyle.filter;
  if (filter && filter !== "none") {
    return true;
  }

  return false;
}

/**
 * Calculate the text-to-element ratio for an element
 * @param {Element} element - The element to analyze
 * @returns {number} - Ratio of text content to descendant elements (higher = more text-heavy)
 */
export function calculateTextRatio(element: Element): number {
  if (!element) return 0;

  // Get total text content length (all text recursively, trimmed)
  const htmlElement = element as HTMLElement;
  const text = (htmlElement.innerText || element.textContent || "").trim();
  const totalCharacters = text.length;

  // Count all descendant elements (not just direct children)
  const descendantElementCount = element.querySelectorAll("*").length;

  // If no descendant elements, it's text-heavy if there's text
  if (descendantElementCount === 0) {
    return totalCharacters > 0 ? 100 : 0;
  }

  // Calculate ratio: text characters per descendant element
  // Higher ratio means more text relative to structure
  const ratio = totalCharacters / descendantElementCount;

  return ratio;
}

/**
 * Check if an element is text-heavy (high ratio of text to visual complexity)
 * @param {Element} element - The element to check
 * @returns {boolean} - True if element is text-heavy
 */
export function isTextHeavy(element: Element): boolean {
  if (!element) return false;

  // Don't consider elements with visual styling as text-heavy
  if (hasVisualStyling(element)) {
    return false;
  }

  // Calculate text ratio
  const textRatio = calculateTextRatio(element);

  // Threshold: if ratio is >= 20 characters per child element, consider it text-heavy
  // This accounts for typical text content while filtering out structure-heavy elements
  const TEXT_RATIO_THRESHOLD = 20;

  return textRatio >= TEXT_RATIO_THRESHOLD;
}

/**
 * Detect the type of element for copying
 * @param {Element} element - The element to detect
 * @returns {string} - The element type: 'table', 'text', 'image', 'svg', or 'visual'
 */
export function detectElementType(element: Element): "table" | "text" | "image" | "svg" | "visual" {
  if (!element) {
    return "text";
  }

  // Check if element is or contains a table
  if (element.tagName === "TABLE" || element.querySelector("table")) {
    return "table";
  }

  // Check if element is or contains images
  if (element.tagName === "IMG" || element.querySelector("img")) {
    return "image";
  }

  // Check if element is or contains video
  if (element.tagName === "VIDEO" || element.querySelector("video")) {
    return "visual";
  }

  // Check if element is or contains SVG (before canvas check)
  if (element.tagName === "SVG" || element.querySelector("svg")) {
    return "svg";
  }

  // Check if element is or contains canvas
  if (element.tagName === "CANVAS" || element.querySelector("canvas")) {
    return "visual";
  }

  // Check if element is text-heavy (high text-to-element ratio, minimal visual styling)
  if (isTextHeavy(element)) {
    return "text";
  }

  // Default to visual for other elements (complex/styled content)
  return "visual";
}
