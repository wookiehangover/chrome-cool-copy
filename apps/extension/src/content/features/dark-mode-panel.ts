/**
 * Dark Mode Adjustment Panel
 * Floating control panel for adjusting dark mode settings
 */

import {
  isDarkModeActive,
  getDarkModeSettings,
  updateDarkModeSettings,
  addExcludedSelector,
  removeExcludedSelector,
  updateExcludedSelector,
  getExcludedSelectors,
  generateSelector,
} from "./dark-mode-manager.js";
import { showToast } from "../toast.js";
import styles from "./dark-mode-panel.css?raw";

let panelElement: HTMLDivElement | null = null;
let styleInjected = false;

// Exclusion picker state
let exclusionPickerActive = false;
let exclusionPickerOverlay: HTMLDivElement | null = null;
let currentHighlightedElement: Element | null = null;

/**
 * Inject panel styles into the page
 */
function injectStyles(): void {
  if (styleInjected) return;

  const style = document.createElement("style");
  style.id = "dark-mode-panel-styles";
  style.textContent = styles;
  document.head.appendChild(style);
  styleInjected = true;
}

/**
 * Create a slider control row
 */
function createSliderRow(
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
  unit: string,
  onChange: (value: number) => void,
): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "dark-mode-panel-row";

  const labelEl = document.createElement("span");
  labelEl.className = "dark-mode-panel-label";
  labelEl.textContent = label;

  const sliderContainer = document.createElement("div");
  sliderContainer.className = "dark-mode-panel-slider-container";

  const slider = document.createElement("input");
  slider.type = "range";
  slider.className = "dark-mode-panel-slider";
  slider.min = String(min);
  slider.max = String(max);
  slider.step = String(step);
  slider.value = String(value);

  const valueEl = document.createElement("span");
  valueEl.className = "dark-mode-panel-value";
  valueEl.textContent = `${value}${unit}`;

  slider.addEventListener("input", () => {
    const newValue = parseFloat(slider.value);
    valueEl.textContent = `${newValue}${unit}`;
    onChange(newValue);
  });

  sliderContainer.appendChild(slider);
  sliderContainer.appendChild(valueEl);
  row.appendChild(labelEl);
  row.appendChild(sliderContainer);

  return row;
}

/**
 * Create a color picker row
 */
function createColorRow(
  label: string,
  value: string,
  onChange: (value: string) => void,
): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "dark-mode-panel-row";

  const labelEl = document.createElement("span");
  labelEl.className = "dark-mode-panel-label";
  labelEl.textContent = label;

  const colorContainer = document.createElement("div");
  colorContainer.className = "dark-mode-panel-color";

  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.className = "dark-mode-panel-color-input";
  colorInput.value = value;

  const colorValue = document.createElement("span");
  colorValue.className = "dark-mode-panel-color-value";
  colorValue.textContent = value;

  colorInput.addEventListener("input", () => {
    colorValue.textContent = colorInput.value;
    onChange(colorInput.value);
  });

  colorContainer.appendChild(colorInput);
  colorContainer.appendChild(colorValue);
  row.appendChild(labelEl);
  row.appendChild(colorContainer);

  return row;
}

/**
 * Create a divider element
 */
function createDivider(): HTMLDivElement {
  const divider = document.createElement("div");
  divider.className = "dark-mode-panel-divider";
  return divider;
}

/**
 * Create a toggle switch row
 */
function createToggleRow(
  label: string,
  value: boolean,
  onChange: (value: boolean) => void,
): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "dark-mode-panel-row";

  const labelEl = document.createElement("span");
  labelEl.className = "dark-mode-panel-label";
  labelEl.textContent = label;

  const toggle = document.createElement("div");
  toggle.className = `dark-mode-panel-toggle${value ? " active" : ""}`;

  const thumb = document.createElement("div");
  thumb.className = "dark-mode-panel-toggle-thumb";
  toggle.appendChild(thumb);

  toggle.addEventListener("click", () => {
    const newValue = !toggle.classList.contains("active");
    toggle.classList.toggle("active", newValue);
    onChange(newValue);
  });

  row.appendChild(labelEl);
  row.appendChild(toggle);

  return row;
}

/**
 * Create the exclusion picker overlay
 */
function createExclusionPickerOverlay(): HTMLDivElement {
  const overlay = document.createElement("div");
  overlay.className = "dark-mode-exclusion-picker-overlay";
  overlay.innerHTML = `
    <div class="dark-mode-exclusion-picker-message">
      Click an element to exclude from dark mode
      <span class="dark-mode-exclusion-picker-hint">Press Escape to cancel</span>
    </div>
  `;
  return overlay;
}

/**
 * Highlight an element during exclusion picking
 */
function highlightExclusionElement(element: Element): void {
  if (currentHighlightedElement && currentHighlightedElement !== element) {
    currentHighlightedElement.classList.remove("dark-mode-exclusion-highlight");
  }
  if (element) {
    element.classList.add("dark-mode-exclusion-highlight");
    currentHighlightedElement = element;
  }
}

/**
 * Remove highlight from current element
 */
function removeExclusionHighlight(): void {
  if (currentHighlightedElement) {
    currentHighlightedElement.classList.remove("dark-mode-exclusion-highlight");
    currentHighlightedElement = null;
  }
}

/**
 * Handle mouse move during exclusion picker
 */
function handleExclusionMouseMove(event: MouseEvent): void {
  if (!exclusionPickerActive) return;

  const element = document.elementFromPoint(event.clientX, event.clientY);

  // Don't highlight overlay, panel, or structural elements
  if (
    element &&
    element !== exclusionPickerOverlay &&
    !exclusionPickerOverlay?.contains(element) &&
    !panelElement?.contains(element) &&
    element.tagName !== "HTML" &&
    element.tagName !== "BODY"
  ) {
    highlightExclusionElement(element);
  } else {
    removeExclusionHighlight();
  }
}

/**
 * Handle click during exclusion picker
 */
function handleExclusionClick(event: MouseEvent): void {
  if (!exclusionPickerActive) return;

  // Ignore clicks on overlay or panel
  if (
    exclusionPickerOverlay?.contains(event.target as Node) ||
    panelElement?.contains(event.target as Node)
  ) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const element = document.elementFromPoint(event.clientX, event.clientY);

  if (
    element &&
    element.tagName !== "HTML" &&
    element.tagName !== "BODY"
  ) {
    const selector = generateSelector(element);
    addExcludedSelector(selector);
    showToast("Element excluded from dark mode");

    // Refresh the panel to show the new exclusion
    stopExclusionPicker();
    refreshExclusionsList();
  } else {
    stopExclusionPicker();
  }
}

/**
 * Handle keydown during exclusion picker
 */
function handleExclusionKeydown(event: KeyboardEvent): void {
  if (!exclusionPickerActive) return;

  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    stopExclusionPicker();
  }
}

/**
 * Start the exclusion picker mode
 */
export function startExclusionPicker(): void {
  if (exclusionPickerActive) return;

  exclusionPickerActive = true;

  // Create and show overlay
  exclusionPickerOverlay = createExclusionPickerOverlay();
  document.body.appendChild(exclusionPickerOverlay);

  // Change cursor
  document.body.style.cursor = "crosshair";

  // Add event listeners
  document.addEventListener("mousemove", handleExclusionMouseMove, true);
  document.addEventListener("click", handleExclusionClick, true);
  document.addEventListener("keydown", handleExclusionKeydown, true);
}

/**
 * Stop the exclusion picker mode
 */
function stopExclusionPicker(): void {
  if (!exclusionPickerActive) return;

  exclusionPickerActive = false;

  // Restore cursor
  document.body.style.cursor = "auto";

  // Remove event listeners
  document.removeEventListener("mousemove", handleExclusionMouseMove, true);
  document.removeEventListener("click", handleExclusionClick, true);
  document.removeEventListener("keydown", handleExclusionKeydown, true);

  // Remove highlight and overlay
  removeExclusionHighlight();
  if (exclusionPickerOverlay) {
    exclusionPickerOverlay.remove();
    exclusionPickerOverlay = null;
  }
}

/**
 * Create the exclusions section for the panel
 */
function createExclusionsSection(): HTMLDivElement {
  const section = document.createElement("div");
  section.className = "dark-mode-panel-exclusions";
  section.id = "dark-mode-exclusions-section";

  const header = document.createElement("div");
  header.className = "dark-mode-panel-exclusions-header";

  const label = document.createElement("span");
  label.className = "dark-mode-panel-label";
  label.textContent = "Exclusions";

  const pickBtn = document.createElement("button");
  pickBtn.className = "dark-mode-panel-pick-btn";
  pickBtn.textContent = "Pick Element";
  pickBtn.addEventListener("click", () => {
    startExclusionPicker();
  });

  header.appendChild(label);
  header.appendChild(pickBtn);
  section.appendChild(header);

  // Exclusions list
  const list = document.createElement("div");
  list.className = "dark-mode-panel-exclusions-list";
  list.id = "dark-mode-exclusions-list";

  const selectors = getExcludedSelectors();
  if (selectors.length === 0) {
    const empty = document.createElement("div");
    empty.className = "dark-mode-panel-exclusions-empty";
    empty.textContent = "No exclusions";
    list.appendChild(empty);
  } else {
    selectors.forEach((selector) => {
      const item = createExclusionItem(selector);
      list.appendChild(item);
    });
  }

  section.appendChild(list);
  return section;
}

/**
 * Create an exclusion list item with editable selector
 */
function createExclusionItem(selector: string): HTMLDivElement {
  const item = document.createElement("div");
  item.className = "dark-mode-panel-exclusion-item";

  const selectorInput = document.createElement("input");
  selectorInput.type = "text";
  selectorInput.className = "dark-mode-panel-exclusion-selector";
  selectorInput.value = selector;
  selectorInput.title = "Click to edit selector";

  let originalValue = selector;

  // Save on blur
  selectorInput.addEventListener("blur", () => {
    const newValue = selectorInput.value.trim();
    if (newValue && newValue !== originalValue) {
      updateExcludedSelector(originalValue, newValue);
      originalValue = newValue;
    } else if (!newValue) {
      // Restore original if empty
      selectorInput.value = originalValue;
    }
  });

  // Save on Enter, cancel on Escape
  selectorInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      selectorInput.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      selectorInput.value = originalValue;
      selectorInput.blur();
    }
  });

  const removeBtn = document.createElement("button");
  removeBtn.className = "dark-mode-panel-exclusion-remove";
  removeBtn.innerHTML = "&#215;";
  removeBtn.title = "Remove exclusion";
  removeBtn.addEventListener("click", () => {
    removeExcludedSelector(originalValue);
    refreshExclusionsList();
  });

  item.appendChild(selectorInput);
  item.appendChild(removeBtn);
  return item;
}

/**
 * Refresh the exclusions list in the panel
 */
function refreshExclusionsList(): void {
  const list = document.getElementById("dark-mode-exclusions-list");
  if (!list) return;

  list.innerHTML = "";

  const selectors = getExcludedSelectors();
  if (selectors.length === 0) {
    const empty = document.createElement("div");
    empty.className = "dark-mode-panel-exclusions-empty";
    empty.textContent = "No exclusions";
    list.appendChild(empty);
  } else {
    selectors.forEach((selector) => {
      const item = createExclusionItem(selector);
      list.appendChild(item);
    });
  }
}

/**
 * Open the dark mode adjustment panel
 */
export function openDarkModePanel(): void {
  if (!isDarkModeActive()) {
    showToast("Enable dark mode first");
    return;
  }

  if (panelElement) {
    closeDarkModePanel();
    return;
  }

  injectStyles();

  const settings = getDarkModeSettings();
  panelElement = document.createElement("div");
  panelElement.className = "dark-mode-panel";

  // Header
  const header = document.createElement("div");
  header.className = "dark-mode-panel-header";

  const title = document.createElement("span");
  title.className = "dark-mode-panel-title";
  title.textContent = "Dark Mode";

  const closeBtn = document.createElement("button");
  closeBtn.className = "dark-mode-panel-close";
  closeBtn.innerHTML = "&#215;";
  closeBtn.addEventListener("click", closeDarkModePanel);

  header.appendChild(title);
  header.appendChild(closeBtn);

  // Body
  const body = document.createElement("div");
  body.className = "dark-mode-panel-body";

  // Brightness control
  const brightnessRow = createSliderRow(
    "Brightness",
    settings.brightness,
    50,
    150,
    5,
    "%",
    (value) => {
      updateDarkModeSettings({ brightness: value });
    },
  );

  // Contrast control
  const contrastRow = createSliderRow("Contrast", settings.contrast, 50, 150, 5, "%", (value) => {
    updateDarkModeSettings({ contrast: value });
  });

  // Sepia control
  const sepiaRow = createSliderRow("Sepia", settings.sepia, 0, 100, 5, "%", (value) => {
    updateDarkModeSettings({ sepia: value });
  });

  // Grayscale control
  const grayscaleRow = createSliderRow("Grayscale", settings.grayscale, 0, 100, 5, "%", (value) => {
    updateDarkModeSettings({ grayscale: value });
  });

  // Preserve images toggle
  const preserveImagesRow = createToggleRow("Preserve Images", settings.preserveImages, (value) => {
    updateDarkModeSettings({ preserveImages: value });
  });

  body.appendChild(preserveImagesRow);
  body.appendChild(createDivider());
  body.appendChild(brightnessRow);
  body.appendChild(contrastRow);
  body.appendChild(createDivider());
  body.appendChild(sepiaRow);
  body.appendChild(grayscaleRow);
  body.appendChild(createDivider());

  // Mix color control
  const mixColorRow = createColorRow("Mix Color", settings.mixColor, (value) => {
    updateDarkModeSettings({ mixColor: value });
  });

  body.appendChild(mixColorRow);
  body.appendChild(createDivider());

  // Exclusions section
  const exclusionsSection = createExclusionsSection();
  body.appendChild(exclusionsSection);

  panelElement.appendChild(header);
  panelElement.appendChild(body);
  document.body.appendChild(panelElement);

  // Close on escape
  document.addEventListener("keydown", handleEscape);
}

/**
 * Handle escape key to close panel
 */
function handleEscape(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    // If exclusion picker is active, let its handler deal with escape
    if (exclusionPickerActive) return;
    closeDarkModePanel();
  }
}

/**
 * Close the dark mode adjustment panel
 */
export function closeDarkModePanel(): void {
  // Stop exclusion picker if active
  if (exclusionPickerActive) {
    stopExclusionPicker();
  }
  if (panelElement) {
    panelElement.remove();
    panelElement = null;
  }
  document.removeEventListener("keydown", handleEscape);
}
