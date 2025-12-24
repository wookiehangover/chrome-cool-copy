/**
 * Clipped Pages Viewer
 * Manages display and interaction with clipped pages from AgentDB
 */

interface Page {
  id: string;
  title?: string;
  url: string;
  text_content?: string;
  created_at?: string;
}

interface AgentDBConfig {
  baseUrl: string;
  apiKey: string;
  token: string;
  dbName: string;
  dbType: string;
}

let allPages: Page[] = [];
let pendingDeleteId: string | null = null;

// DOM Elements
const pagesContainer = document.getElementById('pagesContainer') as HTMLDivElement;
const emptyState = document.getElementById('emptyState') as HTMLDivElement;
const loadingState = document.getElementById('loadingState') as HTMLDivElement;
const errorState = document.getElementById('errorState') as HTMLDivElement;
const searchInput = document.getElementById('searchInput') as HTMLInputElement;
const confirmModal = document.getElementById('confirmModal') as HTMLDivElement;
const cancelButton = document.getElementById('cancelButton') as HTMLButtonElement;
const confirmButton = document.getElementById('confirmButton') as HTMLButtonElement;
const retryButton = document.getElementById('retryButton') as HTMLButtonElement;

// Initialize
document.addEventListener('DOMContentLoaded', (): void => {
  loadPages();
  setupEventListeners();
});

function setupEventListeners(): void {
  searchInput.addEventListener('input', filterPages);
  cancelButton.addEventListener('click', closeConfirmModal);
  confirmButton.addEventListener('click', confirmDelete);
  retryButton.addEventListener('click', loadPages);
}

async function loadPages(): Promise<void> {
  try {
    showLoadingState();

    // Get AgentDB config from chrome.storage.sync
    const config = await getAgentDBConfig();
    if (!config) {
      throw new Error('AgentDB configuration not found. Please configure AgentDB settings.');
    }

    // Dynamically import and initialize database service
    const databaseUrl = chrome.runtime.getURL('services/database.js');
    const { initializeDatabase, getWebpages } = await import(databaseUrl);
    await initializeDatabase(config);

    // Fetch all webpages
    allPages = await getWebpages();

    // Display pages
    if (allPages.length === 0) {
      showEmptyState();
    } else {
      showPages(allPages);
      hideLoadingState();
    }
  } catch (error) {
    console.error('[Clipped Pages] Error loading pages:', error);
    showErrorState(error instanceof Error ? error.message : String(error));
  }
}

function getAgentDBConfig(): Promise<AgentDBConfig | null> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['agentdbConfig'], (result: Record<string, unknown>) => {
      resolve((result.agentdbConfig as AgentDBConfig | undefined) || null);
    });
  });
}

function showPages(pages: Page[]): void {
  pagesContainer.innerHTML = '';
  hideLoadingState();
  hideErrorState();
  emptyState.style.display = 'none';

  pages.forEach((page) => {
    const card = createPageCard(page);
    pagesContainer.appendChild(card);
  });
}

function createPageCard(page: Page): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'page-card';

  const timestamp = page.created_at ? new Date(page.created_at).toLocaleDateString() : 'Unknown';
  const preview = (page.text_content || '').substring(0, 150).trim();

  card.innerHTML = `
    <div class="page-card-header">
      <div style="flex: 1;">
        <div class="page-card-title">${escapeHtml(page.title || 'Untitled')}</div>
        <div class="page-card-url">${escapeHtml(page.url)}</div>
      </div>
    </div>
    <div class="page-card-meta">
      <span>📅 ${timestamp}</span>
    </div>
    ${preview ? `<div class="page-card-preview">${escapeHtml(preview)}...</div>` : ''}
    <div class="page-card-actions">
      <button class="button button-secondary expand-button" data-id="${page.id}">View</button>
      <button class="button button-danger delete-button" data-id="${page.id}">Delete</button>
    </div>
  `;

  // Add event listeners
  const expandBtn = card.querySelector('.expand-button') as HTMLButtonElement;
  const deleteBtn = card.querySelector('.delete-button') as HTMLButtonElement;

  expandBtn.addEventListener('click', (e: Event): void => {
    e.stopPropagation();
    expandPage(page);
  });

  deleteBtn.addEventListener('click', (e: Event): void => {
    e.stopPropagation();
    openConfirmModal(page.id);
  });

  return card;
}

function expandPage(page: Page): void {
  // Create a new window/tab to display full content
  const newWindow = window.open('', '_blank');
  if (!newWindow) {
    alert('Failed to open page. Please check your popup blocker settings.');
    return;
  }

  newWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${escapeHtml(page.title || 'Clipped Page')}</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; margin: 20px; line-height: 1.6; }
        .header { border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 24px; }
        .header h1 { margin: 0 0 8px 0; }
        .header p { margin: 0; color: #6b7280; font-size: 14px; }
        .content { max-width: 800px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${escapeHtml(page.title || 'Untitled')}</h1>
        <p><a href="${escapeHtml(page.url)}" target="_blank">${escapeHtml(page.url)}</a></p>
      </div>
      <div class="content">
        <pre style="white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(page.text_content || '')}</pre>
      </div>
    </body>
    </html>
  `);
  newWindow.document.close();
}

function filterPages(): void {
  const query = searchInput.value.toLowerCase();
  const filtered = allPages.filter((page) => {
    const title = (page.title || '').toLowerCase();
    const url = (page.url || '').toLowerCase();
    return title.includes(query) || url.includes(query);
  });

  if (filtered.length === 0) {
    pagesContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #6b7280;">No pages match your search.</div>';
  } else {
    showPages(filtered);
  }
}

function openConfirmModal(pageId: string): void {
  pendingDeleteId = pageId;
  confirmModal.style.display = 'flex';
}

function closeConfirmModal(): void {
  confirmModal.style.display = 'none';
  pendingDeleteId = null;
}

async function confirmDelete(): Promise<void> {
  if (!pendingDeleteId) return;

  try {
    const config = await getAgentDBConfig();
    if (!config) throw new Error('AgentDB configuration not found.');

    const databaseUrl = chrome.runtime.getURL('services/database.js');
    const { initializeDatabase, deleteWebpage } = await import(databaseUrl);
    await initializeDatabase(config);
    await deleteWebpage(pendingDeleteId);

    closeConfirmModal();
    loadPages();
  } catch (error) {
    console.error('[Clipped Pages] Error deleting page:', error);
    alert('Failed to delete page: ' + (error instanceof Error ? error.message : String(error)));
  }
}

function showLoadingState(): void {
  loadingState.style.display = 'block';
  pagesContainer.innerHTML = '';
  emptyState.style.display = 'none';
  errorState.style.display = 'none';
}

function hideLoadingState(): void {
  loadingState.style.display = 'none';
}

function showEmptyState(): void {
  emptyState.style.display = 'block';
  pagesContainer.innerHTML = '';
  errorState.style.display = 'none';
  loadingState.style.display = 'none';
}

function showErrorState(message: string): void {
  errorState.style.display = 'block';
  const errorMessageEl = document.getElementById('errorMessage') as HTMLDivElement;
  errorMessageEl.textContent = message;
  pagesContainer.innerHTML = '';
  emptyState.style.display = 'none';
  loadingState.style.display = 'none';
}

function hideErrorState(): void {
  errorState.style.display = 'none';
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

