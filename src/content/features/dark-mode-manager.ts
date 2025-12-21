/**
 * Dark Mode Manager
 * Handles Darkmode.js initialization, storage operations, and preference application
 */

export type DarkModePreference = "always" | "system" | "off";

export interface DarkModeSettings {
  brightness: number; // 50-150, default 100
  contrast: number; // 50-150, default 100
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

// Darkmode.js is loaded from vendor script, so we use any type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let darkmodeInstance: any = null;
let currentDomain: string = "";
let currentPreference: DarkModePreference = "off";
let currentSettings: DarkModeSettings = { ...defaultSettings };
let darkModeMediaQuery: MediaQueryList | null = null;

/**
 * Extract base domain from URL
 * Handles localhost, IP addresses, and regular domains
 */
export function getBaseDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;

    // Handle localhost and IP addresses
    if (hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return hostname;
    }

    // Extract base domain (last two parts for most TLDs)
    const parts = hostname.split(".");
    return parts.length >= 2 ? parts.slice(-2).join(".") : hostname;
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
 * Clean up Darkmode.js DOM elements and state
 */
function cleanupDarkMode(): void {
  // Remove Darkmode.js injected elements
  document.querySelector(".darkmode-layer")?.remove();
  document.querySelector(".darkmode-background")?.remove();
  document.querySelector(".darkmode-toggle")?.remove();

  // Remove the body class
  document.body.classList.remove("darkmode--activated");

  // Clear localStorage entry that Darkmode.js creates
  window.localStorage.removeItem("darkmode");

  // Clear the instance reference
  darkmodeInstance = null;
}

/**
 * Apply dark mode based on current preference and system state
 */
function applyDarkMode(): void {
  if (!darkmodeInstance) return;

  const isSystemDark = darkModeMediaQuery?.matches ?? false;
  const shouldEnable =
    currentPreference === "always" || (currentPreference === "system" && isSystemDark);

  const isCurrentlyActive = darkmodeInstance.isActivated();

  if (shouldEnable && !isCurrentlyActive) {
    darkmodeInstance.toggle();
  } else if (!shouldEnable && isCurrentlyActive) {
    darkmodeInstance.toggle();
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
 * Initialize just the Darkmode.js instance (not the full manager)
 */
function initializeDarkmodeJs(): void {
  if (darkmodeInstance) return;

  darkmodeInstance = new window.Darkmode({
    bottom: "32px",
    right: "32px",
    mixColor: "#fff",
    buttonColorDark: "#100f2c",
    buttonColorLight: "#fff",
    saveInCookies: false,
    autoMatchOsTheme: false,
  });
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

    // Only initialize Darkmode.js if preference is not 'off'
    if (currentPreference !== "off") {
      initializeDarkmodeJs();
      applyDarkMode();
      applySettingsToDOM();
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
      // Clean up all Darkmode.js artifacts
      cleanupDarkMode();
    } else {
      prefs[currentDomain] = preference;
      await savePreferences(prefs);
      // Ensure Darkmode.js is initialized before applying
      if (!darkmodeInstance) {
        initializeDarkmodeJs();
      }
      applyDarkMode();
      applySettingsToDOM();
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
  return darkmodeInstance?.isActivated() ?? false;
}

/**
 * Apply CSS filters based on current settings
 */
function applySettingsToDOM(): void {
  const layer = document.querySelector(".darkmode-layer") as HTMLElement | null;
  if (!layer) return;

  const { brightness, contrast, sepia, grayscale, mixColor } = currentSettings;

  // Apply filters to the layer
  const filters: string[] = [];
  if (brightness !== 100) filters.push(`brightness(${brightness}%)`);
  if (contrast !== 100) filters.push(`contrast(${contrast}%)`);
  if (sepia > 0) filters.push(`sepia(${sepia}%)`);
  if (grayscale > 0) filters.push(`grayscale(${grayscale}%)`);

  layer.style.filter = filters.length > 0 ? filters.join(" ") : "";
  layer.style.background = mixColor;
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
export async function updateDarkModeSettings(partial: Partial<DarkModeSettings>): Promise<void> {
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
