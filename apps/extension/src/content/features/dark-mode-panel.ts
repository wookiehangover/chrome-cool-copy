/**
 * Dark Mode Adjustment Panel
 * Floating control panel for adjusting dark mode settings
 */

import {
  isDarkModeActive,
  getDarkModeSettings,
  updateDarkModeSettings,
} from "./dark-mode-manager.js";
import { showToast } from "../toast.js";
import styles from "./dark-mode-panel.css";

let panelElement: HTMLDivElement | null = null;
let styleInjected = false;

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
    closeDarkModePanel();
  }
}

/**
 * Close the dark mode adjustment panel
 */
export function closeDarkModePanel(): void {
  if (panelElement) {
    panelElement.remove();
    panelElement = null;
  }
  document.removeEventListener("keydown", handleEscape);
}
