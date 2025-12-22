/**
 * Dark Mode Manager
 * Uses SVG filters with mix-blend-mode for dark mode effect
 * Contrast adjustment uses shader-style pivot around middle gray:
 *   adjusted = (color - 0.5) * contrast + 0.5
 */

export type DarkModePreference = "always" | "system" | "off";

export interface DarkModeSettings {
  brightness: number; // 50-150, default 100
  contrast: number; // 50-150, default 100 (1.0 = no change)
  sepia: number; // 0-100, default 0
  grayscale: number; // 0-100, default 0
  mixColor: string; // hex color, default #fff
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
};

// DOM elements for the dark mode overlay
let overlayElement: HTMLDivElement | null = null;
let svgFilterElement: SVGSVGElement | null = null;
let isActive = false;

let currentDomain: string = "";
let currentPreference: DarkModePreference = "off";
let currentSettings: DarkModeSettings = { ...defaultSettings };
let darkModeMediaQuery: MediaQueryList | null = null;

const FILTER_ID = "dark-mode-contrast-filter";
const OVERLAY_ID = "dark-mode-overlay";
const SVG_FILTER_ID = "dark-mode-svg-filters";

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
 * Create the SVG filter element with feComponentTransfer for contrast adjustment
 * Formula: adjusted = (color - 0.5) * contrast + 0.5
 * Maps to: slope = contrast, intercept = 0.5 * (1 - contrast)
 */
function createSVGFilter(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = SVG_FILTER_ID;
  svg.setAttribute("style", "position: absolute; width: 0; height: 0;");
  svg.innerHTML = `
    <defs>
      <filter id="${FILTER_ID}" color-interpolation-filters="sRGB">
        <feComponentTransfer>
          <feFuncR type="linear" slope="1" intercept="0"/>
          <feFuncG type="linear" slope="1" intercept="0"/>
          <feFuncB type="linear" slope="1" intercept="0"/>
        </feComponentTransfer>
      </filter>
    </defs>
  `;
  return svg;
}

/**
 * Create the overlay element that applies the dark mode effect
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
    mix-blend-mode: difference;
    background: #ffffff;
    transition: opacity 0.2s ease;
  `;
  return overlay;
}

/**
 * Update the SVG filter parameters based on current contrast setting
 */
function updateFilterParams(): void {
  if (!svgFilterElement) return;

  // Convert percentage (50-150) to multiplier (0.5-1.5)
  const contrast = currentSettings.contrast / 100;

  // Shader formula: adjusted = (color - 0.5) * contrast + 0.5
  // SVG linear: output = slope * input + intercept
  // Therefore: slope = contrast, intercept = 0.5 * (1 - contrast)
  const slope = contrast;
  const intercept = 0.5 * (1 - contrast);

  const feFuncR = svgFilterElement.querySelector("feFuncR");
  const feFuncG = svgFilterElement.querySelector("feFuncG");
  const feFuncB = svgFilterElement.querySelector("feFuncB");

  [feFuncR, feFuncG, feFuncB].forEach((func) => {
    if (func) {
      func.setAttribute("slope", String(slope));
      func.setAttribute("intercept", String(intercept));
    }
  });
}

/**
 * Clean up dark mode DOM elements and state
 */
function cleanupDarkMode(): void {
  if (overlayElement) {
    overlayElement.remove();
    overlayElement = null;
  }
  if (svgFilterElement) {
    svgFilterElement.remove();
    svgFilterElement = null;
  }
  isActive = false;
}

/**
 * Enable the dark mode overlay
 */
function enableDarkMode(): void {
  if (isActive) return;

  // Create and inject SVG filter if needed
  if (!svgFilterElement) {
    svgFilterElement = createSVGFilter();
    document.body.appendChild(svgFilterElement);
  }

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
    currentPreference === "always" ||
    (currentPreference === "system" && isSystemDark);

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
export async function setDarkModePreference(
  preference: DarkModePreference,
): Promise<void> {
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
 */
export function isDarkModeActive(): boolean {
  return isActive;
}

/**
 * Apply CSS filters and settings to the overlay
 */
function applySettingsToDOM(): void {
  if (!overlayElement) return;

  const { brightness, sepia, grayscale, mixColor } = currentSettings;

  // Update SVG filter for contrast (shader-style pivot adjustment)
  updateFilterParams();

  // Build CSS filter string for other effects
  const filters: string[] = [];

  // Always reference the SVG filter for contrast
  filters.push(`url(#${FILTER_ID})`);

  if (brightness !== 100) filters.push(`brightness(${brightness}%)`);
  if (sepia > 0) filters.push(`sepia(${sepia}%)`);
  if (grayscale > 0) filters.push(`grayscale(${grayscale}%)`);

  overlayElement.style.filter = filters.join(" ");
  overlayElement.style.background = mixColor;
}

/**
 * Get current dark mode settings
 */
export function getDarkModeSettings(): DarkModeSettings {
  return { ...currentSettings };
}

/**
 * Update dark mode settings and apply them
 */
export async function updateDarkModeSettings(
  partial: Partial<DarkModeSettings>,
): Promise<void> {
  currentSettings = { ...currentSettings, ...partial };

  // Apply to DOM immediately
  applySettingsToDOM();

  // Persist to storage
  const allSettings = await loadSettings();
  allSettings[currentDomain] = currentSettings;
  await saveSettings(allSettings);
}

/**
 * Load domain-specific settings on initialization
 */
async function loadDomainSettings(): Promise<void> {
  const allSettings = await loadSettings();
  currentSettings = allSettings[currentDomain] || { ...defaultSettings };
}
