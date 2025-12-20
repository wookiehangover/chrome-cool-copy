/**
 * Settings page script for Cool Copy extension
 * Handles saving and loading AgentDB configuration
 */

interface AgentDBConfig {
  baseUrl: string;
  apiKey: string;
  token: string;
  dbName: string;
  dbType: string;
}

const AGENTDB_BASE_URL = 'https://api.agentdb.dev';

const form = document.getElementById('settingsForm') as HTMLFormElement;
const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
const tokenInput = document.getElementById('token') as HTMLInputElement;
const dbNameInput = document.getElementById('dbName') as HTMLInputElement;
const dbTypeSelect = document.getElementById('dbType') as HTMLSelectElement;
const testConnectionBtn = document.getElementById('testConnectionBtn') as HTMLButtonElement;
const backToPopup = document.getElementById('backToPopup') as HTMLAnchorElement;
const statusMessage = document.getElementById('statusMessage') as HTMLDivElement;

// Load existing settings on page load
document.addEventListener('DOMContentLoaded', loadSettings);

// Event listeners
form.addEventListener('submit', saveSettings);
testConnectionBtn.addEventListener('click', testConnection);
backToPopup.addEventListener('click', (e: Event): void => {
  e.preventDefault();
  window.close();
});

/**
 * Load saved settings from chrome.storage.sync
 */
async function loadSettings(): Promise<void> {
  try {
    const result = await chrome.storage.sync.get(['agentdbConfig']);
    const config = result.agentdbConfig as AgentDBConfig | undefined;

    if (config) {
      apiKeyInput.value = config.apiKey || '';
      tokenInput.value = config.token || '';
      dbNameInput.value = config.dbName || 'webpages';
      dbTypeSelect.value = config.dbType || 'sqlite';
    }
  } catch (error) {
    console.error('[Settings] Error loading settings:', error);
    showStatus('Failed to load settings', 'error');
  }
}

/**
 * Save settings to chrome.storage.sync
 */
async function saveSettings(e: Event): Promise<void> {
  e.preventDefault();

  const config: AgentDBConfig = {
    baseUrl: AGENTDB_BASE_URL,
    apiKey: apiKeyInput.value.trim(),
    token: tokenInput.value.trim(),
    dbName: dbNameInput.value.trim() || 'webpages',
    dbType: dbTypeSelect.value,
  };

  // Validate required fields
  if (!config.apiKey || !config.token) {
    showStatus('Please fill in all required fields', 'error');
    return;
  }

  try {
    await chrome.storage.sync.set({ agentdbConfig: config });
    showStatus('Settings saved successfully', 'success');
  } catch (error) {
    console.error('[Settings] Error saving settings:', error);
    showStatus('Failed to save settings: ' + (error instanceof Error ? error.message : String(error)), 'error');
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
    dbName: dbNameInput.value.trim() || 'webpages',
    dbType: dbTypeSelect.value,
  };

  // Validate required fields
  if (!config.apiKey || !config.token) {
    showStatus('Please fill in all required fields before testing', 'error');
    return;
  }

  showStatus('Testing connection...', 'info');
  testConnectionBtn.disabled = true;

  try {
    const databaseUrl = chrome.runtime.getURL('services/database.js');
    const { initializeDatabase, getWebpages } = await import(databaseUrl);
    await initializeDatabase(config);
    await getWebpages();
    showStatus('Connection successful', 'success');
  } catch (error) {
    console.error('[Settings] Connection test failed:', error);
    showStatus('Connection failed: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
  } finally {
    testConnectionBtn.disabled = false;
  }
}

/**
 * Display a status message
 */
function showStatus(message: string, type: 'success' | 'error' | 'info'): void {
  statusMessage.textContent = message;
  statusMessage.className = 'status-message ' + type;
  statusMessage.style.display = 'block';

  // Auto-hide success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      statusMessage.style.display = 'none';
    }, 3000);
  }
}

