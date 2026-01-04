/**
 * Settings page script for Cool Copy extension
 * Handles saving and loading AgentDB and AI Gateway configuration
 */

import { initializeDatabase, getWebpages } from "../../services/database";

export {};

interface AgentDBConfig {
  baseUrl: string;
  apiKey: string;
  token: string;
  dbName: string;
  dbType: string;
}

interface VercelAIGatewayConfig {
  apiKey: string;
  model: string;
}

const AGENTDB_BASE_URL = "https://api.agentdb.dev";

const form = document.getElementById("settingsForm") as HTMLFormElement;

// AgentDB form elements
const apiKeyInput = document.getElementById("apiKey") as HTMLInputElement;
const tokenInput = document.getElementById("token") as HTMLInputElement;
const dbNameInput = document.getElementById("dbName") as HTMLInputElement;
const dbTypeSelect = document.getElementById("dbType") as HTMLSelectElement;

// Vercel AI Gateway form elements
const aiGatewayApiKeyInput = document.getElementById("aiGatewayApiKey") as HTMLInputElement;
const aiGatewayModelInput = document.getElementById("aiGatewayModel") as HTMLInputElement;

// Common elements
const testConnectionBtn = document.getElementById("testConnectionBtn") as HTMLButtonElement;
const backToPopup = document.getElementById("backToPopup") as HTMLAnchorElement;
const statusMessage = document.getElementById("statusMessage") as HTMLDivElement;

// Load existing settings on page load
document.addEventListener("DOMContentLoaded", loadSettings);

// Event listeners
form.addEventListener("submit", saveSettings);
testConnectionBtn.addEventListener("click", testConnection);
backToPopup.addEventListener("click", (e: Event): void => {
  e.preventDefault();
  window.close();
});

/**
 * Load saved settings from chrome.storage.sync
 */
async function loadSettings(): Promise<void> {
  try {
    const result = await chrome.storage.sync.get(["agentdbConfig", "aiGatewayConfig"]);

    // Load AgentDB config
    const agentdbConfig = result.agentdbConfig as AgentDBConfig | undefined;
    if (agentdbConfig) {
      apiKeyInput.value = agentdbConfig.apiKey || "";
      tokenInput.value = agentdbConfig.token || "";
      dbNameInput.value = agentdbConfig.dbName || "webpages";
      dbTypeSelect.value = agentdbConfig.dbType || "sqlite";
    }

    // Load Vercel AI Gateway config
    const aiGatewayConfig = result.aiGatewayConfig as VercelAIGatewayConfig | undefined;
    if (aiGatewayConfig) {
      aiGatewayApiKeyInput.value = aiGatewayConfig.apiKey || "";
      aiGatewayModelInput.value = aiGatewayConfig.model || "anthropic/claude-sonnet-4";
    } else {
      // Set defaults if no config exists
      aiGatewayModelInput.value = "anthropic/claude-sonnet-4";
    }
  } catch (error) {
    console.error("[Settings] Error loading settings:", error);
    showStatus("Failed to load settings", "error");
  }
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
          dbType: dbTypeSelect.value,
        }
      : null;

  // Build Vercel AI Gateway config
  const aiGatewayConfig: VercelAIGatewayConfig = {
    apiKey: aiGatewayApiKeyInput.value.trim(),
    model: aiGatewayModelInput.value.trim() || "anthropic/claude-sonnet-4",
  };

  // Only validate AI Gateway - AgentDB is optional
  if (!aiGatewayConfig.apiKey || !aiGatewayConfig.model) {
    showStatus("Please fill in all Vercel AI Gateway required fields", "error");
    return;
  }

  try {
    const storageData: Record<string, unknown> = { aiGatewayConfig };

    // Only save agentdbConfig if it's configured
    if (agentdbConfig) {
      storageData.agentdbConfig = agentdbConfig;
    } else {
      // Remove agentdbConfig if cleared
      await chrome.storage.sync.remove(["agentdbConfig"]);
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
    dbType: dbTypeSelect.value,
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
