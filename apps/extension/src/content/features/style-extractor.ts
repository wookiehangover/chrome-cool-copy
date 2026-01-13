/**
 * Style Extractor
 * Extracts computed styles from DOM elements and generates scoped CSS rules
 */

/**
 * Extract computed styles for an element and all descendants
 * Creates scoped CSS rules using the scopeId as a prefix
 * Handles pseudo-elements and CSS custom properties
 *
 * @param element - The root element to extract styles from
 * @param scopeId - The scope ID to use for CSS rule prefixing (e.g., "abc123")
 * @returns A complete <style> block string with scoped CSS rules
 */
export function extractComputedStyles(element: Element, scopeId: string): string {
  const styleMap = new Map<string, Set<string>>();
  const customProperties = new Set<string>();

  // Walk the DOM tree and collect computed styles
  walkElement(element, styleMap, customProperties);

  // Generate CSS rules from collected styles
  const cssRules = generateCSSRules(styleMap, customProperties, scopeId);

  // Return as a complete style block
  return `<style data-clip-scope="${scopeId}">\n${cssRules}\n</style>`;
}

/**
 * Walk the DOM tree and collect computed styles for each element
 */
function walkElement(
  element: Element,
  styleMap: Map<string, Set<string>>,
  customProperties: Set<string>,
): void {
  // Get computed styles for this element
  const computed = window.getComputedStyle(element);
  const selector = generateSelector(element);

  if (selector) {
    const styles = new Set<string>();
    collectStyles(computed, styles, customProperties);
    if (styles.size > 0) {
      styleMap.set(selector, styles);
    }

    // Handle pseudo-elements
    handlePseudoElement(element, "::before", styleMap, customProperties);
    handlePseudoElement(element, "::after", styleMap, customProperties);
  }

  // Recursively process children
  for (const child of element.children) {
    walkElement(child, styleMap, customProperties);
  }
}

/**
 * Handle pseudo-elements (::before, ::after)
 */
function handlePseudoElement(
  element: Element,
  pseudo: "::before" | "::after",
  styleMap: Map<string, Set<string>>,
  customProperties: Set<string>,
): void {
  const computed = window.getComputedStyle(element, pseudo);
  const content = computed.getPropertyValue("content");

  // Only include pseudo-element if it has content
  if (content && content !== "none" && content !== '""') {
    const selector = generateSelector(element) + pseudo;
    const styles = new Set<string>();
    collectStyles(computed, styles, customProperties);
    if (styles.size > 0) {
      styleMap.set(selector, styles);
    }
  }
}

/**
 * Collect CSS properties from computed styles
 */
function collectStyles(
  computed: CSSStyleDeclaration,
  styles: Set<string>,
  customProperties: Set<string>,
): void {
  // Important properties to preserve
  const importantProps = [
    "display",
    "visibility",
    "opacity",
    "position",
    "top",
    "right",
    "bottom",
    "left",
    "width",
    "height",
    "margin",
    "padding",
    "border",
    "background",
    "color",
    "font-size",
    "font-weight",
    "font-family",
    "text-align",
    "text-decoration",
    "line-height",
    "z-index",
    "transform",
    "transition",
    "box-shadow",
    "text-shadow",
  ];

  importantProps.forEach((prop) => {
    const value = computed.getPropertyValue(prop);
    if (value && value !== "auto" && value !== "normal") {
      styles.add(`${prop}: ${value}`);
    }
  });

  // Extract CSS custom properties (variables)
  for (let i = 0; i < computed.length; i++) {
    const prop = computed[i];
    if (prop.startsWith("--")) {
      const value = computed.getPropertyValue(prop);
      if (value) {
        customProperties.add(`${prop}: ${value}`);
      }
    }
  }
}

/**
 * Generate a unique selector for an element
 */
function generateSelector(element: Element): string {
  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();

    // Add ID if present
    if (current.id) {
      selector = `#${current.id}`;
      path.unshift(selector);
      break;
    }

    // Add classes
    const classes = Array.from(current.classList)
      .map((c) => `.${c}`)
      .join("");
    if (classes) {
      selector += classes;
    }

    // Add nth-child for disambiguation
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(current) + 1;
      selector += `:nth-child(${index})`;
    }

    path.unshift(selector);
    current = parent;
  }

  return path.length > 0 ? path.join(" > ") : "";
}

/**
 * Generate CSS rules from collected styles
 */
function generateCSSRules(
  styleMap: Map<string, Set<string>>,
  customProperties: Set<string>,
  scopeId: string,
): string {
  const rules: string[] = [];

  // Add CSS custom properties at the root
  if (customProperties.size > 0) {
    const varRules = Array.from(customProperties).join(";\n  ");
    rules.push(`[data-clip-scope="${scopeId}"] {\n  ${varRules};\n}`);
  }

  // Add scoped CSS rules
  styleMap.forEach((styles, selector) => {
    const scopedSelector = `[data-clip-scope="${scopeId}"] ${selector}`;
    const styleDeclarations = Array.from(styles).join(";\n  ");
    rules.push(`${scopedSelector} {\n  ${styleDeclarations};\n}`);
  });

  return rules.join("\n\n");
}

