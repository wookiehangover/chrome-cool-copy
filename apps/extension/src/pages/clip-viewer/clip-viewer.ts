/**
 * Clip Viewer - Reader Mode Style
 * Displays a saved clip with the same UX as reader mode
 */

interface ClipHighlight {
  id: string;
  text: string;
  startOffset: number;
  endOffset: number;
  color?: string;
  note?: string;
  created_at: string;
}

interface LocalClip {
  id: string;
  url: string;
  title: string;
  dom_content: string;
  text_content: string;
  metadata?: Record<string, unknown>;
  highlights?: ClipHighlight[];
  created_at: string;
  updated_at: string;
}

// State
let currentClip: LocalClip | null = null;
let activeHighlightId: string | null = null;

// DOM Elements
const loadingState = document.getElementById("loadingState") as HTMLDivElement;
const errorState = document.getElementById("errorState") as HTMLDivElement;
const errorMessage = document.getElementById("errorMessage") as HTMLParagraphElement;
const clipTitle = document.getElementById("clipTitle") as HTMLHeadingElement;
const clipUrl = document.getElementById("clipUrl") as HTMLAnchorElement;
const clipMeta = document.getElementById("clipMeta") as HTMLDivElement;
const clipContent = document.getElementById("clipContent") as HTMLDivElement;
const settingsPanel = document.getElementById("settingsPanel") as HTMLDivElement;
const noteEditor = document.getElementById("noteEditor") as HTMLDivElement;
const noteTextarea = document.getElementById("noteTextarea") as HTMLTextAreaElement;

// Initialize
document.addEventListener("DOMContentLoaded", init);

async function init(): Promise<void> {
  const clipId = new URLSearchParams(window.location.search).get("id");

  if (!clipId) {
    showError("No clip ID provided");
    return;
  }

  try {
    await loadClip(clipId);
    setupEventListeners();
    loadSettings();
  } catch (error) {
    console.error("[Clip Viewer] Error:", error);
    showError(error instanceof Error ? error.message : "Failed to load clip");
  }
}

async function loadClip(clipId: string): Promise<void> {
  const localClipsUrl = chrome.runtime.getURL("services/local-clips.js");
  const { getLocalClip } = await import(localClipsUrl);
  const clip = await getLocalClip(clipId);

  if (!clip) {
    showError("Clip not found");
    return;
  }

  currentClip = clip;
  renderClip(clip);
  hideLoading();
}

function renderClip(clip: LocalClip): void {
  // Set header
  clipTitle.textContent = clip.title || "Untitled";
  clipUrl.href = clip.url;
  clipUrl.textContent = clip.url;

  const date = clip.created_at ? new Date(clip.created_at).toLocaleDateString() : "Unknown date";
  clipMeta.textContent = `Saved ${date}`;

  // Render content
  if (clip.dom_content) {
    clipContent.innerHTML = clip.dom_content;
  } else {
    // Fallback to plain text
    clipContent.innerHTML = `<pre style="white-space: pre-wrap;">${escapeHtml(clip.text_content || "")}</pre>`;
  }

  // Restore highlights
  if (clip.highlights && clip.highlights.length > 0) {
    restoreHighlights(clip.highlights);
  }

  document.title = clip.title || "Clip Viewer";
}

function restoreHighlights(highlights: ClipHighlight[]): void {
  const sorted = [...highlights].sort((a, b) => b.startOffset - a.startOffset);

  for (const hl of sorted) {
    try {
      findAndWrapText(hl.text, hl.id, hl.note);
    } catch (error) {
      console.warn("[Clip Viewer] Could not restore highlight:", hl.text.slice(0, 30));
    }
  }
}

function findAndWrapText(searchText: string, highlightId: string, note?: string): boolean {
  const walker = document.createTreeWalker(clipContent, NodeFilter.SHOW_TEXT, null);
  let node: Text | null;
  let accumulated = "";
  const textNodes: { node: Text; start: number; end: number }[] = [];

  while ((node = walker.nextNode() as Text | null)) {
    const start = accumulated.length;
    accumulated += node.textContent || "";
    textNodes.push({ node, start, end: accumulated.length });
  }

  const searchLower = searchText.toLowerCase();
  const foundIndex = accumulated.toLowerCase().indexOf(searchLower);
  if (foundIndex === -1) return false;

  const foundEnd = foundIndex + searchText.length;

  // Find affected text nodes
  for (const { node, start, end } of textNodes) {
    if (end <= foundIndex || start >= foundEnd) continue;

    const nodeStart = Math.max(0, foundIndex - start);
    const nodeEnd = Math.min(node.textContent?.length || 0, foundEnd - start);

    if (nodeStart < nodeEnd) {
      const range = document.createRange();
      range.setStart(node, nodeStart);
      range.setEnd(node, nodeEnd);

      const mark = document.createElement("mark");
      mark.className = "viewer-highlight" + (note ? " has-note" : "");
      mark.dataset.highlightId = highlightId;
      range.surroundContents(mark);
      return true;
    }
  }

  return false;
}

function setupEventListeners(): void {
  // Back button
  document.getElementById("backBtn")?.addEventListener("click", () => {
    window.location.href = chrome.runtime.getURL("pages/clipped-pages/clipped-pages.html");
  });

  document.getElementById("errorBackBtn")?.addEventListener("click", () => {
    window.location.href = chrome.runtime.getURL("pages/clipped-pages/clipped-pages.html");
  });

  // Open URL button
  document.getElementById("openUrlBtn")?.addEventListener("click", () => {
    if (currentClip?.url) {
      window.open(currentClip.url, "_blank");
    }
  });

  // Settings button
  document.getElementById("settingsBtn")?.addEventListener("click", () => {
    settingsPanel.classList.toggle("visible");
  });

  // Font buttons
  document.querySelectorAll("[data-font]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const font = (btn as HTMLElement).dataset.font;
      if (font) setFont(font);
    });
  });

  // Font size slider
  const fontSizeSlider = document.getElementById("fontSizeSlider") as HTMLInputElement;
  fontSizeSlider?.addEventListener("input", () => {
    setFontSize(parseInt(fontSizeSlider.value, 10));
  });

  // Click on highlights to edit note
  clipContent.addEventListener("click", handleHighlightClick);

  // Note editor buttons
  document.getElementById("noteSave")?.addEventListener("click", saveNote);
  document.getElementById("noteDelete")?.addEventListener("click", deleteHighlight);

  // Close panels on outside click
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".settings-panel") && !target.closest("#settingsBtn")) {
      settingsPanel.classList.remove("visible");
    }
    if (!target.closest(".note-editor") && !target.closest(".viewer-highlight")) {
      if (activeHighlightId) {
        saveNote();
      }
    }
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (noteEditor.classList.contains("visible")) {
        saveNote();
      } else if (settingsPanel.classList.contains("visible")) {
        settingsPanel.classList.remove("visible");
      }
    }
  });

  // Text selection for new highlights
  clipContent.addEventListener("mouseup", handleTextSelection);
}

function handleHighlightClick(e: Event): void {
  const target = e.target as HTMLElement;
  const mark = target.closest(".viewer-highlight") as HTMLElement;

  if (!mark) return;

  const highlightId = mark.dataset.highlightId;
  if (!highlightId || !currentClip) return;

  e.stopPropagation();

  // Clear previous active
  document.querySelectorAll(".viewer-highlight.active").forEach((el) => {
    el.classList.remove("active");
  });

  mark.classList.add("active");
  activeHighlightId = highlightId;

  const highlight = currentClip.highlights?.find((h) => h.id === highlightId);
  noteTextarea.value = highlight?.note || "";

  showNoteEditor(mark);
}

function handleTextSelection(): void {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !currentClip) return;

  const text = selection.toString().trim();
  if (!text || text.length < 3) return;

  // Check if selection is within content area
  const range = selection.getRangeAt(0);
  if (!clipContent.contains(range.commonAncestorContainer)) return;

  createHighlight(selection, text);
}

async function createHighlight(selection: Selection, text: string): Promise<void> {
  if (!currentClip) return;

  const range = selection.getRangeAt(0);
  const startOffset = getTextOffset(clipContent, range.startContainer, range.startOffset);

  const highlight: ClipHighlight = {
    id: crypto.randomUUID(),
    text,
    startOffset,
    endOffset: startOffset + text.length,
    created_at: new Date().toISOString(),
  };

  // Add to clip
  try {
    await chrome.runtime.sendMessage({
      action: "addHighlight",
      clipId: currentClip.id,
      highlight,
    });

    if (!currentClip.highlights) currentClip.highlights = [];
    currentClip.highlights.push(highlight);

    // Wrap selection
    const mark = document.createElement("mark");
    mark.className = "viewer-highlight";
    mark.dataset.highlightId = highlight.id;
    range.surroundContents(mark);

    selection.removeAllRanges();
  } catch (error) {
    console.error("[Clip Viewer] Failed to create highlight:", error);
  }
}

function getTextOffset(container: Node, targetNode: Node, offset: number): number {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let accumulated = 0;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    if (node === targetNode) {
      return accumulated + offset;
    }
    accumulated += node.textContent?.length || 0;
  }

  return accumulated + offset;
}

function showNoteEditor(mark: HTMLElement): void {
  noteEditor.classList.add("visible");

  // Fallback positioning for browsers without anchor positioning
  if (!CSS.supports("anchor-name: --test")) {
    const rect = mark.getBoundingClientRect();
    noteEditor.style.top = `${rect.top + window.scrollY}px`;
    noteEditor.style.left = `${rect.right + 24}px`;
  }

  noteTextarea.focus();
}

function hideNoteEditor(): void {
  noteEditor.classList.remove("visible");
  document.querySelectorAll(".viewer-highlight.active").forEach((el) => {
    el.classList.remove("active");
  });
  activeHighlightId = null;
}

async function saveNote(): Promise<void> {
  if (!activeHighlightId || !currentClip) {
    hideNoteEditor();
    return;
  }

  const note = noteTextarea.value;

  try {
    await chrome.runtime.sendMessage({
      action: "updateHighlightNote",
      clipId: currentClip.id,
      highlightId: activeHighlightId,
      note,
    });

    // Update local state
    const hl = currentClip.highlights?.find((h) => h.id === activeHighlightId);
    if (hl) hl.note = note;

    // Update has-note class
    const mark = document.querySelector(`[data-highlight-id="${activeHighlightId}"]`);
    if (mark) {
      if (note) {
        mark.classList.add("has-note");
      } else {
        mark.classList.remove("has-note");
      }
    }

    hideNoteEditor();
  } catch (error) {
    console.error("[Clip Viewer] Failed to save note:", error);
  }
}

async function deleteHighlight(): Promise<void> {
  if (!activeHighlightId || !currentClip) return;

  try {
    await chrome.runtime.sendMessage({
      action: "deleteHighlight",
      clipId: currentClip.id,
      highlightId: activeHighlightId,
    });

    // Remove from DOM
    const mark = document.querySelector(`[data-highlight-id="${activeHighlightId}"]`);
    if (mark) {
      const parent = mark.parentNode;
      while (mark.firstChild) {
        parent?.insertBefore(mark.firstChild, mark);
      }
      mark.remove();
    }

    // Remove from local state
    if (currentClip.highlights) {
      currentClip.highlights = currentClip.highlights.filter((h) => h.id !== activeHighlightId);
    }

    hideNoteEditor();
  } catch (error) {
    console.error("[Clip Viewer] Failed to delete highlight:", error);
  }
}

// Settings
function loadSettings(): void {
  chrome.storage.sync.get(["readerFont", "readerFontSize"], (result) => {
    const font = (result.readerFont as string) || "sans";
    const fontSize = (result.readerFontSize as number) || 16;

    setFont(font, false);
    setFontSize(fontSize, false);

    const slider = document.getElementById("fontSizeSlider") as HTMLInputElement;
    if (slider) slider.value = String(fontSize);
  });
}

function setFont(font: string, save = true): void {
  document.body.classList.remove("font-serif", "font-mono");
  if (font === "serif") document.body.classList.add("font-serif");
  if (font === "mono") document.body.classList.add("font-mono");

  document.querySelectorAll("[data-font]").forEach((btn) => {
    btn.classList.toggle("active", (btn as HTMLElement).dataset.font === font);
  });

  if (save) chrome.storage.sync.set({ readerFont: font });
}

function setFontSize(size: number, save = true): void {
  document.documentElement.style.setProperty("--font-size", `${size}px`);
  if (save) chrome.storage.sync.set({ readerFontSize: size });
}

// UI helpers
function hideLoading(): void {
  loadingState.style.display = "none";
}

function showError(message: string): void {
  loadingState.style.display = "none";
  errorState.style.display = "flex";
  errorMessage.textContent = message;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
