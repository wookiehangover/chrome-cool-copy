/**
 * Clipped Pages Viewer
 * Manages display and interaction with locally stored clips
 */

import type { LocalClip } from "@repo/shared";
import { escapeHtml } from "@repo/shared/utils";
import { getLocalClips } from "../../services/local-clips";
import { deleteClipWithSync } from "../../services/clips-sync";

export {};

let allClips: LocalClip[] = [];
let pendingDeleteId: string | null = null;

const pagesContainer = document.getElementById("pagesContainer") as HTMLDivElement;
const emptyState = document.getElementById("emptyState") as HTMLDivElement;
const loadingState = document.getElementById("loadingState") as HTMLDivElement;
const errorState = document.getElementById("errorState") as HTMLDivElement;
const searchInput = document.getElementById("searchInput") as HTMLInputElement;
const confirmModal = document.getElementById("confirmModal") as HTMLDivElement;
const cancelButton = document.getElementById("cancelButton") as HTMLButtonElement;
const confirmButton = document.getElementById("confirmButton") as HTMLButtonElement;
const retryButton = document.getElementById("retryButton") as HTMLButtonElement;

document.addEventListener("DOMContentLoaded", (): void => {
  loadPages();
  setupEventListeners();
});

function setupEventListeners(): void {
  searchInput.addEventListener("input", filterPages);
  cancelButton.addEventListener("click", closeConfirmModal);
  confirmButton.addEventListener("click", confirmDelete);
  retryButton.addEventListener("click", loadPages);
}

async function loadPages(): Promise<void> {
  try {
    showLoadingState();

    allClips = await getLocalClips();

    if (allClips.length === 0) {
      showEmptyState();
    } else {
      showClips(allClips);
      hideLoadingState();
    }
  } catch (error) {
    console.error("[Clipped Pages] Error loading clips:", error);
    showErrorState(error instanceof Error ? error.message : String(error));
  }
}

function showClips(clips: LocalClip[]): void {
  pagesContainer.innerHTML = "";
  hideLoadingState();
  hideErrorState();
  emptyState.style.display = "none";

  clips.forEach((clip) => {
    const card = createClipCard(clip);
    pagesContainer.appendChild(card);
  });
}

function createClipCard(clip: LocalClip): HTMLDivElement {
  const card = document.createElement("div");
  card.className = "page-card";

  const timestamp = clip.created_at ? new Date(clip.created_at).toLocaleDateString() : "Unknown";
  const preview = (clip.text_content || "").substring(0, 150).trim();

  card.innerHTML = `
    <div class="page-card-header">
      <div class="page-card-title">${escapeHtml(clip.title || "Untitled")}</div>
      <div class="page-card-url">${escapeHtml(clip.url)}</div>
    </div>
    <div class="page-card-meta">
      <span>${timestamp}</span>
    </div>
    ${preview ? `<div class="page-card-preview">${escapeHtml(preview)}...</div>` : ""}
    <div class="page-card-actions">
      <button class="button button-danger delete-button" data-id="${clip.id}">Delete</button>
    </div>
  `;

  card.addEventListener("click", (): void => {
    expandClip(clip);
  });

  const deleteBtn = card.querySelector(".delete-button") as HTMLButtonElement;
  deleteBtn.addEventListener("click", (e: Event): void => {
    e.stopPropagation();
    openConfirmModal(clip.id);
  });

  return card;
}

function expandClip(clip: LocalClip): void {
  // Open the clip viewer page
  const viewerUrl = chrome.runtime.getURL(
    `pages/clip-viewer.html?id=${encodeURIComponent(clip.id)}`,
  );
  window.open(viewerUrl, "_blank");
}

function filterPages(): void {
  const query = searchInput.value.toLowerCase();
  const filtered = allClips.filter((clip) => {
    const title = (clip.title || "").toLowerCase();
    const url = (clip.url || "").toLowerCase();
    return title.includes(query) || url.includes(query);
  });

  if (filtered.length === 0) {
    pagesContainer.innerHTML =
      '<div style="text-align: center; padding: 40px; color: #6b7280;">No clips match your search.</div>';
  } else {
    showClips(filtered);
  }
}

function openConfirmModal(clipId: string): void {
  pendingDeleteId = clipId;
  confirmModal.style.display = "flex";
}

function closeConfirmModal(): void {
  confirmModal.style.display = "none";
  pendingDeleteId = null;
}

async function confirmDelete(): Promise<void> {
  if (!pendingDeleteId) return;

  try {
    // Delete from local storage and optionally from AgentDB
    await deleteClipWithSync(pendingDeleteId);

    closeConfirmModal();
    loadPages();
  } catch (error) {
    console.error("[Clipped Pages] Error deleting clip:", error);
    alert("Failed to delete clip: " + (error instanceof Error ? error.message : String(error)));
  }
}

function showLoadingState(): void {
  loadingState.style.display = "block";
  pagesContainer.innerHTML = "";
  emptyState.style.display = "none";
  errorState.style.display = "none";
}

function hideLoadingState(): void {
  loadingState.style.display = "none";
}

function showEmptyState(): void {
  emptyState.style.display = "block";
  pagesContainer.innerHTML = "";
  errorState.style.display = "none";
  loadingState.style.display = "none";
}

function showErrorState(message: string): void {
  errorState.style.display = "block";
  const errorMessageEl = document.getElementById("errorMessage") as HTMLDivElement;
  errorMessageEl.textContent = message;
  pagesContainer.innerHTML = "";
  emptyState.style.display = "none";
  loadingState.style.display = "none";
}

function hideErrorState(): void {
  errorState.style.display = "none";
}
