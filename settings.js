/**
 * Settings page script for Cool Copy extension
 * Handles saving and loading AgentDB configuration
 */

const AGENTDB_BASE_URL = 'https://api.agentdb.dev';

const form = document.getElementById('settingsForm');
const apiKeyInput = document.getElementById('apiKey');
const tokenInput = document.getElementById('token');
const dbNameInput = document.getElementById('dbName');
const dbTypeSelect = document.getElementById('dbType');
const testConnectionBtn = document.getElementById('testConnectionBtn');
const backToPopup = document.getElementById('backToPopup');
const statusMessage = document.getElementById('statusMessage');

// Load existing settings on page load
document.addEventListener('DOMContentLoaded', loadSettings);

// Event listeners
form.addEventListener('submit', saveSettings);
testConnectionBtn.addEventListener('click', testConnection);
backToPopup.addEventListener('click', (e) => {
  e.preventDefault();
  window.close();
});

/**
 * Load saved settings from chrome.storage.sync
 */
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(['agentdbConfig']);
    const config = result.agentdbConfig;

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
async function saveSettings(e) {
  e.preventDefault();

  const config = {
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
    showStatus('Failed to save settings: ' + error.message, 'error');
  }
}

/**
 * Test the database connection with current settings
 */
async function testConnection() {
  const config = {
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
    const { initializeDatabase, getWebpages } = await import('./src/services/database.ts');
    await initializeDatabase(config);
    await getWebpages();
    showStatus('Connection successful', 'success');
  } catch (error) {
    console.error('[Settings] Connection test failed:', error);
    showStatus('Connection failed: ' + (error.message || 'Unknown error'), 'error');
  } finally {
    testConnectionBtn.disabled = false;
  }
}

/**
 * Display a status message
 */
function showStatus(message, type) {
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

