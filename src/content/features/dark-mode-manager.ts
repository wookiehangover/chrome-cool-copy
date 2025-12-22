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

// DOM element for the dark mode overlay
let overlayElement: HTMLDivElement | null = null;
let isActive = false;

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
  isActive = false;
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
 * Apply backdrop-filter settings to the overlay
 * Uses invert(1) for dark mode base, then contrast/brightness adjustments
 */
function applySettingsToDOM(): void {
  if (!overlayElement) return;

  const { brightness, contrast, sepia, grayscale } = currentSettings;

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
