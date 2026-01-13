/**
 * Style Extractor Tests
 * Tests for extractComputedStyles functionality
 */

import { describe, it, expect, beforeEach } from "vitest";
import { extractComputedStyles } from "./style-extractor";

describe("extractComputedStyles", () => {
  let container: HTMLElement;

  beforeEach(() => {
    // Create a container for test elements
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    // Clean up
    document.body.removeChild(container);
  });

  it("should return a style block with data-clip-scope attribute", () => {
    const element = document.createElement("div");
    element.textContent = "Test";
    container.appendChild(element);

    const result = extractComputedStyles(element, "test-scope");

    expect(result).toContain('<style data-clip-scope="test-scope">');
    expect(result).toContain("</style>");
  });

  it("should extract computed styles for elements", () => {
    const element = document.createElement("div");
    element.style.color = "red";
    element.style.fontSize = "16px";
    container.appendChild(element);

    const result = extractComputedStyles(element, "test-scope");

    expect(result).toContain("color");
    expect(result).toContain("font-size");
  });

  it("should create scoped selectors with data-clip-scope prefix", () => {
    const element = document.createElement("div");
    element.className = "test-class";
    element.style.display = "block";
    container.appendChild(element);

    const result = extractComputedStyles(element, "scope123");

    expect(result).toContain('[data-clip-scope="scope123"]');
    expect(result).toContain(".test-class");
  });

  it("should handle nested elements", () => {
    const parent = document.createElement("div");
    parent.style.color = "blue";
    const child = document.createElement("span");
    child.style.fontWeight = "bold";
    parent.appendChild(child);
    container.appendChild(parent);

    const result = extractComputedStyles(parent, "nested-scope");

    expect(result).toContain("color");
    expect(result).toContain("font-weight");
  });

  it("should extract CSS custom properties", () => {
    const element = document.createElement("div");
    element.style.setProperty("--custom-color", "purple");
    element.style.setProperty("--custom-size", "20px");
    container.appendChild(element);

    const result = extractComputedStyles(element, "vars-scope");

    expect(result).toContain("--custom-color");
    expect(result).toContain("--custom-size");
  });

  it("should handle elements with IDs", () => {
    const element = document.createElement("div");
    element.id = "unique-id";
    element.style.padding = "10px";
    container.appendChild(element);

    const result = extractComputedStyles(element, "id-scope");

    expect(result).toContain("#unique-id");
  });

  it("should skip empty style sets", () => {
    const element = document.createElement("div");
    // No styles applied
    container.appendChild(element);

    const result = extractComputedStyles(element, "empty-scope");

    // Should still have the style block
    expect(result).toContain('<style data-clip-scope="empty-scope">');
    expect(result).toContain("</style>");
  });

  it("should handle multiple classes", () => {
    const element = document.createElement("div");
    element.className = "class1 class2 class3";
    element.style.margin = "5px";
    container.appendChild(element);

    const result = extractComputedStyles(element, "multi-class-scope");

    expect(result).toContain(".class1");
    expect(result).toContain(".class2");
    expect(result).toContain(".class3");
  });
});

