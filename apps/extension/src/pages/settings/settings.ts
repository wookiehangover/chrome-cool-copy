/**
 * Settings page script for Cool Copy extension
 * Handles saving and loading AgentDB and AI Gateway configuration
 */

import { initializeDatabase, getWebpages } from "../../services/database";
import { DEFAULT_MODEL, MODELS_BY_PROVIDER, type AgentDBConfig } from "@repo/shared";

export {};

interface VercelAIGatewayConfig {
  apiKey: string;
  model: string;
}

interface ClipsServerConfig {
  baseUrl: string;
  apiToken: string;
}

interface SettingsStorageData {
  aiGatewayConfig: VercelAIGatewayConfig;
  agentdbConfig?: AgentDBConfig;
  shareServerHostname?: string;
  tts_url?: string;
  clipsServerConfig?: ClipsServerConfig;
}

const AGENTDB_BASE_URL = "https://api.agentdb.dev";
const DEFAULT_TTS_SERVER_URL = "http://localhost:8000";

// SAFETY: The extension owns this DOM/API boundary and guarantees the asserted platform shape.
const form = document.getElementById("settingsForm") as HTMLFormElement;

// AgentDB form elements
// SAFETY: The extension owns this DOM/API boundary and guarantees the asserted platform shape.
const apiKeyInput = document.getElementById("apiKey") as HTMLInputElement;
// SAFETY: The extension owns this DOM/API boundary and guarantees the asserted platform shape.
const tokenInput = document.getElementById("token") as HTMLInputElement;
// SAFETY: The extension owns this DOM/API boundary and guarantees the asserted platform shape.
const dbNameInput = document.getElementById("dbName") as HTMLInputElement;
// SAFETY: The extension owns this DOM/API boundary and guarantees the asserted platform shape.
const dbTypeSelect = document.getElementById("dbType") as HTMLSelectElement;

// Vercel AI Gateway form elements
// SAFETY: The extension owns this DOM/API boundary and guarantees the asserted platform shape.
const aiGatewayApiKeyInput = document.getElementById("aiGatewayApiKey") as HTMLInputElement;
// SAFETY: The extension owns this DOM/API boundary and guarantees the asserted platform shape.
const aiGatewayModelInput = document.getElementById("aiGatewayModel") as HTMLSelectElement;

// Share Server form elements
// SAFETY: The extension owns this DOM/API boundary and guarantees the asserted platform shape.
const shareServerHostnameInput = document.getElementById("shareServerHostname") as HTMLInputElement;

// TTS form elements
// SAFETY: The extension owns this DOM/API boundary and guarantees the asserted platform shape.
const ttsServerUrlInput = document.getElementById("ttsServerUrl") as HTMLInputElement;

// Clips Server form elements
// SAFETY: The extension owns this DOM/API boundary and guarantees the asserted platform shape.
const clipsServerUrlInput = document.getElementById("clipsServerUrl") as HTMLInputElement;
// SAFETY: The extension owns this DOM/API boundary and guarantees the asserted platform shape.
const clipsServerApiTokenInput = document.getElementById("clipsServerApiToken") as HTMLInputElement;

// Common elements
// SAFETY: The extension owns this DOM/API boundary and guarantees the asserted platform shape.
const testConnectionBtn = document.getElementById("testConnectionBtn") as HTMLButtonElement;
// SAFETY: The extension owns this DOM/API boundary and guarantees the asserted platform shape.
const backToPopup = document.getElementById("backToPopup") as HTMLAnchorElement;
// SAFETY: The extension owns this DOM/API boundary and guarantees the asserted platform shape.
const statusMessage = document.getElementById("statusMessage") as HTMLDivElement;

// Load existing settings on page load
document.addEventListener("DOMContentLoaded", () => {
  populateModelOptions();
  loadSettings();
});

// Event listeners
form.addEventListener("submit", saveSettings);
testConnectionBtn.addEventListener("click", testConnection);
backToPopup.addEventListener("click", (e: Event): void => {
  e.preventDefault();
  window.close();
});

/**
 * Populate the model select element with options grouped by provider
 */
function populateModelOptions(): void {
  // Clear existing options
  aiGatewayModelInput.innerHTML = "";

  // Add a default placeholder option
  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = "Select a model...";
  placeholderOption.disabled = true;
  aiGatewayModelInput.appendChild(placeholderOption);

  // Group models by provider and add optgroups
  for (const [provider, models] of Object.entries(MODELS_BY_PROVIDER)) {
    const optgroup = document.createElement("optgroup");
    optgroup.label = provider;

    for (const model of models) {
      const option = document.createElement("option");
      option.value = model.id;
      option.textContent = model.displayName;
      optgroup.appendChild(option);
    }

    aiGatewayModelInput.appendChild(optgroup);
  }
}

/**
 * Load saved settings from chrome.storage.sync
 */
async function loadSettings(): Promise<void> {
  try {
    const result = await chrome.storage.sync.get([
      "agentdbConfig",
      "aiGatewayConfig",
      "shareServerHostname",
      "tts_url",
      "clipsServerConfig",
    ]);

    // Load AgentDB config
    // SAFETY: The extension owns this DOM/API boundary and guarantees the asserted platform shape.
    const agentdbConfig = result.agentdbConfig as AgentDBConfig | undefined;
    if (agentdbConfig) {
      apiKeyInput.value = agentdbConfig.apiKey || "";
      tokenInput.value = agentdbConfig.token || "";
      dbNameInput.value = agentdbConfig.dbName || "webpages";
      dbTypeSelect.value = agentdbConfig.dbType || "sqlite";
    }

    // Load Vercel AI Gateway config
    // SAFETY: The extension owns this DOM/API boundary and guarantees the asserted platform shape.
    const aiGatewayConfig = result.aiGatewayConfig as VercelAIGatewayConfig | undefined;
    if (aiGatewayConfig) {
      aiGatewayApiKeyInput.value = aiGatewayConfig.apiKey || "";
      aiGatewayModelInput.value = aiGatewayConfig.model || DEFAULT_MODEL;
    } else {
      // Set defaults if no config exists
      aiGatewayModelInput.value = DEFAULT_MODEL;
    }

    // Load Share Server hostname
    // SAFETY: The extension owns this DOM/API boundary and guarantees the asserted platform shape.
    const shareServerHostname = result.shareServerHostname as string | undefined;
    if (shareServerHostname) {
      shareServerHostnameInput.value = shareServerHostname;
    } else {
      // Set default if no config exists
      shareServerHostnameInput.value = "localhost:5173";
    }

    // Load TTS Server URL
    // SAFETY: The extension owns this DOM/API boundary and guarantees the asserted platform shape.
    const ttsServerUrl = result.tts_url as string | undefined;
    if (ttsServerUrl) {
      ttsServerUrlInput.value = ttsServerUrl;
    } else {
      ttsServerUrlInput.value = DEFAULT_TTS_SERVER_URL;
    }

    // Load Clips Server config
    // SAFETY: The extension owns this DOM/API boundary and guarantees the asserted platform shape.
    const clipsServerConfig = result.clipsServerConfig as ClipsServerConfig | undefined;
    if (clipsServerConfig) {
      clipsServerUrlInput.value = clipsServerConfig.baseUrl || "";
      clipsServerApiTokenInput.value = clipsServerConfig.apiToken || "";
    }
  } catch (error) {
    console.error("[Settings] Error loading settings:", error);
    showStatus("Failed to load settings", "error");
  }
}

/**
 * Normalize share server hostname by stripping protocol and trailing slashes
 */
function normalizeShareServerHostname(hostname: string): string {
  let normalized = hostname.trim();

  // Strip protocol prefixes
  normalized = normalized.replace(/^https?:\/\//, "");

  // Strip trailing slashes
  normalized = normalized.replace(/\/$/, "");

  return normalized;
}

/**
 * Normalize TTS server URL by trimming and stripping trailing slashes
 */
function normalizeTtsServerUrl(url: string): string {
  let normalized = url.trim();
  normalized = normalized.replace(/\/+$/, "");
  return normalized;
}

/**
 * Validate that a URL starts with http:// or https://
 */
function isValidHttpUrl(url: string): boolean {
  return /^https?:\/\/.+/.test(url);
}

/**
 * Save settings to chrome.storage.sync
 */
async function saveSettings(e: Event): Promise<void> {
  e.preventDefault();

  const agentdbApiKey = apiKeyInput.value.trim();
  const agentdbToken = tokenInput.value.trim();

  // Build AgentDB config - only if credentials are provided
  // AgentDB is optional - clips work locally without it
  const agentdbConfig: AgentDBConfig | null =
    agentdbApiKey && agentdbToken
      ? {
          baseUrl: AGENTDB_BASE_URL,
          apiKey: agentdbApiKey,
          token: agentdbToken,
          dbName: dbNameInput.value.trim() || "webpages",
          // SAFETY: The extension owns this DOM/API boundary and guarantees the asserted platform shape.
          dbType: dbTypeSelect.value as "sqlite" | "duckdb",
        }
      : null;

  // Build Vercel AI Gateway config
  const aiGatewayConfig: VercelAIGatewayConfig = {
    apiKey: aiGatewayApiKeyInput.value.trim(),
    model: aiGatewayModelInput.value.trim() || DEFAULT_MODEL,
  };

  // Get Share Server hostname
  const shareServerHostname = normalizeShareServerHostname(shareServerHostnameInput.value);
  const ttsServerUrl = normalizeTtsServerUrl(ttsServerUrlInput.value);

  // Get Clips Server config
  const clipsServerUrl = clipsServerUrlInput.value.trim();
  const clipsServerApiToken = clipsServerApiTokenInput.value.trim();

  // Only validate AI Gateway - AgentDB is optional
  if (!aiGatewayConfig.apiKey || !aiGatewayConfig.model) {
    showStatus("Please fill in all Vercel AI Gateway required fields", "error");
    return;
  }

  // Validate Clips Server URL if provided
  if (clipsServerUrl && !isValidHttpUrl(clipsServerUrl)) {
    showStatus("Clips Server URL must start with http:// or https://", "error");
    return;
  }

  try {
    const storageData: SettingsStorageData = { aiGatewayConfig };

    // Only save agentdbConfig if it's configured
    if (agentdbConfig) {
      storageData.agentdbConfig = agentdbConfig;
    } else {
      // Remove agentdbConfig if cleared
      await chrome.storage.sync.remove(["agentdbConfig"]);
    }

    // Save Share Server hostname if provided
    if (shareServerHostname) {
      storageData.shareServerHostname = shareServerHostname;
    } else {
      // Remove shareServerHostname if cleared
      await chrome.storage.sync.remove(["shareServerHostname"]);
    }

    // Save TTS server URL if provided
    if (ttsServerUrl) {
      storageData.tts_url = ttsServerUrl;
    } else {
      await chrome.storage.sync.remove(["tts_url"]);
    }

    // Save Clips Server config if URL is provided
    if (clipsServerUrl) {
      const clipsServerConfig: ClipsServerConfig = {
        baseUrl: clipsServerUrl.replace(/\/+$/, ""), // Remove trailing slashes
        apiToken: clipsServerApiToken,
      };
      storageData.clipsServerConfig = clipsServerConfig;
    } else {
      await chrome.storage.sync.remove(["clipsServerConfig"]);
    }

    await chrome.storage.sync.set(storageData);

    const message = agentdbConfig
      ? "Settings saved successfully (clips will sync to AgentDB)"
      : "Settings saved successfully (clips stored locally only)";
    showStatus(message, "success");
  } catch (error) {
    console.error("[Settings] Error saving settings:", error);
    showStatus(
      "Failed to save settings: " + (error instanceof Error ? error.message : String(error)),
      "error",
    );
  }
}

/**
 * Test the database connection with current settings
 */
async function testConnection(): Promise<void> {
  const config: AgentDBConfig = {
    baseUrl: AGENTDB_BASE_URL,
    apiKey: apiKeyInput.value.trim(),
    token: tokenInput.value.trim(),
    dbName: dbNameInput.value.trim() || "webpages",
    // SAFETY: The extension owns this DOM/API boundary and guarantees the asserted platform shape.
    dbType: dbTypeSelect.value as "sqlite" | "duckdb",
  };

  // Validate required fields
  if (!config.apiKey || !config.token) {
    showStatus("Please fill in all required fields before testing", "error");
    return;
  }

  showStatus("Testing connection...", "info");
  testConnectionBtn.disabled = true;

  try {
    await initializeDatabase(config);
    await getWebpages();
    showStatus("Connection successful", "success");
  } catch (error) {
    console.error("[Settings] Connection test failed:", error);
    showStatus(
      "Connection failed: " + (error instanceof Error ? error.message : "Unknown error"),
      "error",
    );
  } finally {
    testConnectionBtn.disabled = false;
  }
}

/**
 * Display a status message
 */
function showStatus(message: string, type: "success" | "error" | "info"): void {
  statusMessage.textContent = message;
  statusMessage.className = "status-message " + type;
  statusMessage.style.display = "block";

  // Auto-hide success messages after 3 seconds
  if (type === "success") {
    setTimeout(() => {
      statusMessage.style.display = "none";
    }, 3000);
  }
}
