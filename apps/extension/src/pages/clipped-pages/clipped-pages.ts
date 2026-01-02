/**
 * Clipped Pages Viewer
 * Manages display and interaction with locally stored clips
 * With optional AgentDB sync status display
 */

type SyncStatus = "pending" | "synced" | "error" | "local-only";

interface LocalClip {
  id: string;
  url: string;
  title: string;
  dom_content: string;
  text_content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  sync_error?: string;
  agentdb_id?: string;
}

let allClips: LocalClip[] = [];
let pendingDeleteId: string | null = null;
let agentdbConfigured = false;

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

    // Check if AgentDB is configured (for sync status display)
    agentdbConfigured = await checkAgentDBConfigured();

    // Load clips from local storage (primary source)
    const localClipsUrl = chrome.runtime.getURL('services/local-clips.js');
    const { getLocalClips } = await import(localClipsUrl);
    allClips = await getLocalClips();

    // Display clips
    if (allClips.length === 0) {
      showEmptyState();
    } else {
      showClips(allClips);
      hideLoadingState();
    }
  } catch (error) {
    console.error('[Clipped Pages] Error loading clips:', error);
    showErrorState(error instanceof Error ? error.message : String(error));
  }
}

async function checkAgentDBConfigured(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['agentdbConfig'], (result: Record<string, unknown>) => {
      const config = result.agentdbConfig as { baseUrl?: string; apiKey?: string; token?: string; dbName?: string } | undefined;
      resolve(Boolean(config?.baseUrl && config?.apiKey && config?.token && config?.dbName));
    });
  });
}

function showClips(clips: LocalClip[]): void {
  pagesContainer.innerHTML = '';
  hideLoadingState();
  hideErrorState();
  emptyState.style.display = 'none';

  clips.forEach((clip) => {
    const card = createClipCard(clip);
    pagesContainer.appendChild(card);
  });
}

function getSyncStatusBadge(status: SyncStatus, hasAgentDB: boolean): string {
  if (!hasAgentDB) {
    return '<span class="sync-badge sync-local" title="Stored locally">💾 Local</span>';
  }
  switch (status) {
    case 'synced':
      return '<span class="sync-badge sync-synced" title="Synced to AgentDB">☁️ Synced</span>';
    case 'pending':
      return '<span class="sync-badge sync-pending" title="Pending sync to AgentDB">⏳ Pending</span>';
    case 'error':
      return '<span class="sync-badge sync-error" title="Sync failed">⚠️ Error</span>';
    case 'local-only':
      return '<span class="sync-badge sync-local" title="Stored locally only">💾 Local</span>';
    default:
      return '';
  }
}

function createClipCard(clip: LocalClip): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'page-card';

  const timestamp = clip.created_at ? new Date(clip.created_at).toLocaleDateString() : 'Unknown';
  const preview = (clip.text_content || '').substring(0, 150).trim();
  const syncBadge = getSyncStatusBadge(clip.sync_status, agentdbConfigured);

  card.innerHTML = `
    <div class="page-card-header">
      <div style="flex: 1;">
        <div class="page-card-title">${escapeHtml(clip.title || 'Untitled')}</div>
        <div class="page-card-url">${escapeHtml(clip.url)}</div>
      </div>
    </div>
    <div class="page-card-meta">
      <span>📅 ${timestamp}</span>
      ${syncBadge}
    </div>
    ${preview ? `<div class="page-card-preview">${escapeHtml(preview)}...</div>` : ''}
    <div class="page-card-actions">
      <button class="button button-secondary expand-button" data-id="${clip.id}">View</button>
      <button class="button button-danger delete-button" data-id="${clip.id}">Delete</button>
    </div>
  `;

  // Add event listeners
  const expandBtn = card.querySelector('.expand-button') as HTMLButtonElement;
  const deleteBtn = card.querySelector('.delete-button') as HTMLButtonElement;

  expandBtn.addEventListener('click', (e: Event): void => {
    e.stopPropagation();
    expandClip(clip);
  });

  deleteBtn.addEventListener('click', (e: Event): void => {
    e.stopPropagation();
    openConfirmModal(clip.id);
  });

  return card;
}

function expandClip(clip: LocalClip): void {
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
      <title>${escapeHtml(clip.title || 'Clipped Page')}</title>
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
        <h1>${escapeHtml(clip.title || 'Untitled')}</h1>
        <p><a href="${escapeHtml(clip.url)}" target="_blank">${escapeHtml(clip.url)}</a></p>
      </div>
      <div class="content">
        <pre style="white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(clip.text_content || '')}</pre>
      </div>
    </body>
    </html>
  `);
  newWindow.document.close();
}

function filterPages(): void {
  const query = searchInput.value.toLowerCase();
  const filtered = allClips.filter((clip) => {
    const title = (clip.title || '').toLowerCase();
    const url = (clip.url || '').toLowerCase();
    return title.includes(query) || url.includes(query);
  });

  if (filtered.length === 0) {
    pagesContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #6b7280;">No clips match your search.</div>';
  } else {
    showClips(filtered);
  }
}

function openConfirmModal(clipId: string): void {
  pendingDeleteId = clipId;
  confirmModal.style.display = 'flex';
}

function closeConfirmModal(): void {
  confirmModal.style.display = 'none';
  pendingDeleteId = null;
}

async function confirmDelete(): Promise<void> {
  if (!pendingDeleteId) return;

  try {
    // Delete from local storage and optionally from AgentDB
    const clipsSyncUrl = chrome.runtime.getURL('services/clips-sync.js');
    const { deleteClipWithSync } = await import(clipsSyncUrl);
    await deleteClipWithSync(pendingDeleteId);

    closeConfirmModal();
    loadPages();
  } catch (error) {
    console.error('[Clipped Pages] Error deleting clip:', error);
    alert('Failed to delete clip: ' + (error instanceof Error ? error.message : String(error)));
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

