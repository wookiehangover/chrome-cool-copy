/**
 * Dark Mode Manager
 * Uses backdrop-filter with invert + contrast for dark mode effect
 * Contrast adjustment uses shader-style pivot around middle gray:
 *   adjusted = (color - 0.5) * contrast + 0.5
 */

export type DarkModePreference = "always" | "system" | "off";

export interface DarkModeSettings {
  brightness: number; // 50-150, default 100
  contrast: number; // 50-150, default 100 (1.0 = no change)
  sepia: number; // 0-100, default 0
  grayscale: number; // 0-100, default 0
  mixColor: string; // hex color, default #fff (unused in backdrop-filter approach)
  preserveImages: boolean; // true = counter-invert images to preserve original colors
  excludedSelectors: string[]; // CSS selectors for elements to exclude from dark mode
}

interface DarkModePreferences {
  [domain: string]: DarkModePreference;
}

interface DarkModeSettingsStorage {
  [domain: string]: DarkModeSettings;
}

const defaultSettings: DarkModeSettings = {
  brightness: 100,
  contrast: 100,
  sepia: 0,
  grayscale: 0,
  mixColor: "#ffffff",
  preserveImages: true,
  excludedSelectors: [],
};

// DOM elements for the dark mode overlay and image preservation
let overlayElement: HTMLDivElement | null = null;
let imagePreserveStyleElement: HTMLStyleElement | null = null;
let isActive = false;

const IMAGE_PRESERVE_STYLE_ID = "dark-mode-image-preserve";

let currentDomain: string = "";
let currentPreference: DarkModePreference = "off";
let currentSettings: DarkModeSettings = { ...defaultSettings };
let darkModeMediaQuery: MediaQueryList | null = null;

const OVERLAY_ID = "dark-mode-overlay";

/**
 * Extract the precise hostname from URL for per-host scoping
 * Keeps localhost/IPs as-is and lowercases everything else
 */
export function getBaseDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname;
  } catch {
    return "";
  }
}

/**
 * Load preferences from chrome.storage.sync
 */
async function loadPreferences(): Promise<DarkModePreferences> {
  try {
    const result = await chrome.storage.sync.get(["darkModePreferences"]);
    return (result.darkModePreferences as DarkModePreferences) || {};
  } catch (error) {
    console.error("[Dark Mode] Error loading preferences:", error);
    return {};
  }
}

/**
 * Save preferences to chrome.storage.sync
 */
async function savePreferences(prefs: DarkModePreferences): Promise<void> {
  try {
    await chrome.storage.sync.set({ darkModePreferences: prefs });
  } catch (error) {
    console.error("[Dark Mode] Error saving preferences:", error);
  }
}

/**
 * Load settings from chrome.storage.sync
 */
async function loadSettings(): Promise<DarkModeSettingsStorage> {
  try {
    const result = await chrome.storage.sync.get(["darkModeSettings"]);
    return (result.darkModeSettings as DarkModeSettingsStorage) || {};
  } catch (error) {
    console.error("[Dark Mode] Error loading settings:", error);
    return {};
  }
}

/**
 * Save settings to chrome.storage.sync
 */
async function saveSettings(settings: DarkModeSettingsStorage): Promise<void> {
  try {
    await chrome.storage.sync.set({ darkModeSettings: settings });
  } catch (error) {
    console.error("[Dark Mode] Error saving settings:", error);
  }
}

/**
 * Create the overlay element that applies the dark mode effect using backdrop-filter
 * This inverts colors and applies contrast/brightness adjustments to the page behind it
 */
function createOverlay(): HTMLDivElement {
  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 2147483646;
    background: transparent;
    transition: backdrop-filter 0.2s ease;
  `;
  return overlay;
}

/**
 * Clean up dark mode DOM elements and state
 */
function cleanupDarkMode(): void {
  if (overlayElement) {
    overlayElement.remove();
    overlayElement = null;
  }
  if (imagePreserveStyleElement) {
    imagePreserveStyleElement.remove();
    imagePreserveStyleElement = null;
  }
  isActive = false;
}

/**
 * Create or update the style element for preserving images and excluded elements
 * Applies counter-inversion to images and excluded selectors so they appear in original colors
 */
function updateImagePreserveStyle(preserveImages: boolean, excludedSelectors: string[]): void {
  const hasExclusions = excludedSelectors.length > 0;

  if (preserveImages || hasExclusions) {
    if (!imagePreserveStyleElement) {
      imagePreserveStyleElement = document.createElement("style");
      imagePreserveStyleElement.id = IMAGE_PRESERVE_STYLE_ID;
      document.head.appendChild(imagePreserveStyleElement);
    }

    // Build the selector list
    const selectors: string[] = [];

    // Add image/media selectors if preserveImages is enabled
    if (preserveImages) {
      selectors.push(
        "img",
        "video",
        "picture",
        "canvas",
        "svg",
        '[style*="background-image"]',
        "iframe",
      );
    }

    // Add user-defined excluded selectors
    if (hasExclusions) {
      selectors.push(...excludedSelectors);
    }

    // Counter-invert selected elements
    // This cancels out the backdrop-filter invert, preserving original colors
    imagePreserveStyleElement.textContent = `
      ${selectors.join(",\n      ")} {
        filter: invert(1) !important;
      }
    `;
  } else {
    if (imagePreserveStyleElement) {
      imagePreserveStyleElement.remove();
      imagePreserveStyleElement = null;
    }
  }
}

/**
 * Enable the dark mode overlay
 */
function enableDarkMode(): void {
  if (isActive) return;

  // Create and inject overlay if needed
  if (!overlayElement) {
    overlayElement = createOverlay();
    document.body.appendChild(overlayElement);
  }

  // Apply current settings
  applySettingsToDOM();
  isActive = true;
}

/**
 * Disable the dark mode overlay
 */
function disableDarkMode(): void {
  if (!isActive) return;
  cleanupDarkMode();
}

/**
 * Apply dark mode based on current preference and system state
 */
function applyDarkMode(): void {
  const isSystemDark = darkModeMediaQuery?.matches ?? false;
  const shouldEnable =
    currentPreference === "always" || (currentPreference === "system" && isSystemDark);

  if (shouldEnable) {
    enableDarkMode();
  } else {
    disableDarkMode();
  }
}

/**
 * Handle system preference changes
 */
function handleSystemPreferenceChange(): void {
  if (currentPreference === "system") {
    applyDarkMode();
  }
}

/**
 * Initialize dark mode manager
 */
export async function initializeDarkMode(): Promise<void> {
  try {
    // Get current domain
    currentDomain = getBaseDomain(window.location.href);
    if (!currentDomain) return;

    // Set up system preference listener
    darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    darkModeMediaQuery.addEventListener("change", handleSystemPreferenceChange);

    // Load saved preferences and settings
    const prefs = await loadPreferences();
    currentPreference = prefs[currentDomain] || "off";
    await loadDomainSettings();

    // Apply dark mode if preference is not 'off'
    if (currentPreference !== "off") {
      applyDarkMode();
    }
  } catch (error) {
    console.error("[Dark Mode] Initialization error:", error);
  }
}

/**
 * Set dark mode preference for current domain
 * Setting to 'off' clears the domain from storage entirely
 */
export async function setDarkModePreference(preference: DarkModePreference): Promise<void> {
  try {
    currentPreference = preference;
    const prefs = await loadPreferences();

    if (preference === "off") {
      // Clear settings for this domain
      delete prefs[currentDomain];
      await savePreferences(prefs);
      cleanupDarkMode();
    } else {
      prefs[currentDomain] = preference;
      await savePreferences(prefs);
      applyDarkMode();
    }
  } catch (error) {
    console.error("[Dark Mode] Error setting preference:", error);
  }
}

/**
 * Get current dark mode preference
 */
export function getCurrentPreference(): DarkModePreference {
  return currentPreference;
}

/**
 * Get current domain
 */
export function getCurrentDomain(): string {
  return currentDomain;
}

/**
 * Check if dark mode is currently active
 * Checks both the isActive flag and the presence of the overlay element in the DOM
 */
export function isDarkModeActive(): boolean {
  // Check both the flag and verify the overlay is actually in the DOM
  // The overlay could be detached by page scripts or other extensions
  const overlayInDOM = overlayElement !== null && document.body.contains(overlayElement);
  return isActive || overlayInDOM;
}

/**
 * Convert hex color to rgba with specified alpha
 */
function hexToRgba(hex: string, alpha: number): string {
  // Remove # if present
  const cleanHex = hex.replace("#", "");

  // Parse hex values
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Check if a color is white (or close to it)
 */
function isWhite(hex: string): boolean {
  const cleanHex = hex.replace("#", "").toLowerCase();
  return cleanHex === "ffffff" || cleanHex === "fff";
}

/**
 * Apply backdrop-filter settings to the overlay
 * Uses invert(1) for dark mode base, then contrast/brightness adjustments
 * Adds a color tint overlay when mixColor is not white
 */
function applySettingsToDOM(): void {
  if (!overlayElement) return;

  const { brightness, contrast, sepia, grayscale, mixColor, preserveImages, excludedSelectors } =
    currentSettings;

  // Build backdrop-filter string
  // Order matters: invert first, then adjust contrast/brightness
  const filters: string[] = [];

  // Base dark mode effect - invert all colors
  filters.push("invert(1)");

  // Contrast adjustment (percentage maps directly)
  if (contrast !== 100) filters.push(`contrast(${contrast}%)`);

  // Brightness adjustment
  if (brightness !== 100) filters.push(`brightness(${brightness}%)`);

  // Optional color adjustments
  if (sepia > 0) filters.push(`sepia(${sepia}%)`);
  if (grayscale > 0) filters.push(`grayscale(${grayscale}%)`);

  overlayElement.style.backdropFilter = filters.join(" ");
  // Also set webkit prefix for Safari compatibility
  overlayElement.style.setProperty("-webkit-backdrop-filter", filters.join(" "));

  // Apply color tint if mixColor is not white
  if (!isWhite(mixColor)) {
    // Use 15% opacity for the tint - enough to shift colors without overwhelming
    overlayElement.style.background = hexToRgba(mixColor, 0.15);
  } else {
    overlayElement.style.background = "transparent";
  }

  // Apply image preservation and excluded selectors (counter-invert)
  updateImagePreserveStyle(preserveImages, excludedSelectors);
}

/**
 * Get current dark mode settings
 */
export function getDarkModeSettings(): DarkModeSettings {
  return { ...currentSettings };
}

// Debounce timer for saving settings
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const SAVE_DEBOUNCE_MS = 500;

/**
 * Debounced save to avoid hitting chrome.storage.sync rate limits
 */
function debouncedSaveSettings(): void {
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
  }

  saveDebounceTimer = setTimeout(async () => {
    try {
      const allSettings = await loadSettings();
      allSettings[currentDomain] = currentSettings;
      await saveSettings(allSettings);
    } catch (error) {
      console.error("[Dark Mode] Error in debounced save:", error);
    }
    saveDebounceTimer = null;
  }, SAVE_DEBOUNCE_MS);
}

/**
 * Update dark mode settings and apply them
 */
export function updateDarkModeSettings(partial: Partial<DarkModeSettings>): void {
  currentSettings = { ...currentSettings, ...partial };

  // Apply to DOM immediately
  applySettingsToDOM();

  // Debounce the save to storage
  debouncedSaveSettings();
}

/**
 * Load domain-specific settings on initialization
 * Merges saved settings with defaults to handle missing fields from older versions
 */
async function loadDomainSettings(): Promise<void> {
  const allSettings = await loadSettings();
  const savedSettings = allSettings[currentDomain];
  // Merge with defaults to ensure all fields exist (handles schema migrations)
  currentSettings = savedSettings
    ? { ...defaultSettings, ...savedSettings }
    : { ...defaultSettings };
}

/**
 * Generate a unique CSS selector for an element
 * Mimics Chrome DevTools "Copy selector" behavior for maximum specificity
 */
export function generateSelector(element: Element): string {
  // If element has an ID, use it (most specific)
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  // Build a path-based selector like Chrome DevTools
  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();

    // If this element has an ID, use it and stop
    if (current.id) {
      path.unshift(`#${CSS.escape(current.id)}`);
      break;
    }

    // Add classes for specificity (filter out dynamic/generated classes)
    const classes = Array.from(current.classList)
      .filter((c) => {
        // Filter out classes that look auto-generated (common patterns)
        return (
          c.length > 0 &&
          !c.match(/^[a-z]{1,2}-[a-f0-9]{4,}$/i) && // e.g., "sc-abc123"
          !c.match(/^_[a-zA-Z0-9]+_[a-z0-9]+$/i) && // CSS modules style
          !c.match(/^css-[a-z0-9]+$/i) && // emotion/styled-components
          !c.match(/^[A-Z][a-zA-Z]+-[a-zA-Z]+-[a-zA-Z0-9]+$/) // MUI style
        );
      })
      .slice(0, 3) // Limit to first 3 classes for readability
      .map((c) => `.${CSS.escape(c)}`)
      .join("");

    selector += classes;

    // Always add nth-child for disambiguation (like Chrome DevTools)
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(current) + 1;
      selector += `:nth-child(${index})`;
    }

    path.unshift(selector);
    current = parent;
  }

  // If path is empty, we're at body
  if (path.length === 0) {
    return "body";
  }

  // Prepend "body > " if we didn't hit an ID
  const firstPart = path[0];
  if (!firstPart.startsWith("#")) {
    path.unshift("body");
  }

  return path.join(" > ");
}

/**
 * Add a selector to the excluded selectors list
 */
export function addExcludedSelector(selector: string): void {
  if (!currentSettings.excludedSelectors.includes(selector)) {
    currentSettings.excludedSelectors = [...currentSettings.excludedSelectors, selector];
    applySettingsToDOM();
    debouncedSaveSettings();
  }
}

/**
 * Remove a selector from the excluded selectors list
 */
export function removeExcludedSelector(selector: string): void {
  const index = currentSettings.excludedSelectors.indexOf(selector);
  if (index !== -1) {
    currentSettings.excludedSelectors = currentSettings.excludedSelectors.filter(
      (s) => s !== selector,
    );
    applySettingsToDOM();
    debouncedSaveSettings();
  }
}

/**
 * Update an excluded selector (replace old with new)
 */
export function updateExcludedSelector(oldSelector: string, newSelector: string): void {
  const index = currentSettings.excludedSelectors.indexOf(oldSelector);
  if (index !== -1 && newSelector.trim()) {
    currentSettings.excludedSelectors[index] = newSelector.trim();
    applySettingsToDOM();
    debouncedSaveSettings();
  }
}

/**
 * Get the current list of excluded selectors
 */
export function getExcludedSelectors(): string[] {
  return [...currentSettings.excludedSelectors];
}
