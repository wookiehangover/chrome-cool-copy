/**
 * Reader Mode
 * Provides a clean, distraction-free reading experience with:
 * - Auto-clip on entry
 * - Text highlighting with annotations
 * - Customizable typography settings
 * Uses Shadow DOM for complete style isolation
 */

import styles from "./reader-mode.css";
import type { LocalClip, Highlight } from "../../services/local-clips.js";
import { showToast } from "../toast.js";

// Reader mode state
let readerModeActive = false;
let readerModeContainer: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let originalPageDisplay: string = "";
let originalBodyOverflow: string = "";

// Current clip data
let currentClipId: string | null = null;
let currentHighlights: Highlight[] = [];

// UI elements (inside shadow DOM)
let contentWrapper: HTMLElement | null = null;
let settingsPanel: HTMLElement | null = null;
let noteEditor: HTMLElement | null = null;
let activeHighlightId: string | null = null;
let editModeActive = false;
let editModeBtn: HTMLButtonElement | null = null;

// Settings defaults
interface ReaderSettings {
  fontFamily: "sans" | "serif" | "mono";
  fontSize: number; // 14-22
}

const DEFAULT_SETTINGS: ReaderSettings = {
  fontFamily: "sans",
  fontSize: 16,
};

// Storage key for remembering reader mode URLs
const READER_MODE_URLS_KEY = "readerModeUrls";

/**
 * Add current URL to reader mode memory
 */
async function rememberReaderModeUrl(): Promise<void> {
  try {
    const url = window.location.href;
    const result = await chrome.storage.local.get([READER_MODE_URLS_KEY]);
    const urls = (result[READER_MODE_URLS_KEY] as string[] | undefined) || [];

    if (!urls.includes(url)) {
      urls.push(url);
      // Keep only the last 100 URLs to avoid storage bloat
      const trimmedUrls = urls.slice(-100);
      await chrome.storage.local.set({ [READER_MODE_URLS_KEY]: trimmedUrls });
    }
  } catch (error) {
    console.error("[Reader Mode] Failed to remember URL:", error);
  }
}

/**
 * Remove current URL from reader mode memory
 */
async function forgetReaderModeUrl(): Promise<void> {
  try {
    const url = window.location.href;
    const result = await chrome.storage.local.get([READER_MODE_URLS_KEY]);
    const urls = (result[READER_MODE_URLS_KEY] as string[] | undefined) || [];

    const index = urls.indexOf(url);
    if (index !== -1) {
      urls.splice(index, 1);
      await chrome.storage.local.set({ [READER_MODE_URLS_KEY]: urls });
    }
  } catch (error) {
    console.error("[Reader Mode] Failed to forget URL:", error);
  }
}

/**
 * Check if current URL should auto-enter reader mode
 */
async function shouldAutoEnterReaderMode(): Promise<boolean> {
  try {
    const url = window.location.href;
    const result = await chrome.storage.local.get([READER_MODE_URLS_KEY]);
    const urls = (result[READER_MODE_URLS_KEY] as string[] | undefined) || [];
    return urls.includes(url);
  } catch (error) {
    console.error("[Reader Mode] Failed to check URL:", error);
    return false;
  }
}

/**
 * Initialize reader mode - check if we should auto-enter
 */
export async function initReaderMode(): Promise<void> {
  if (await shouldAutoEnterReaderMode()) {
    // Small delay to let the page finish loading
    setTimeout(() => {
      activateReaderMode();
    }, 100);
  }
}

/**
 * Extract the main article content from the page
 */
function extractArticleContent(): { title: string; content: Element; images: string[] } {
  // Try to find the main content using semantic HTML and common patterns
  const mainContent = findMainContent();
  const cleanedContent = cleanContent(mainContent);

  // Extract title
  const title = extractTitle();

  // Extract images from the article
  const images = extractImages(cleanedContent);

  return { title, content: cleanedContent, images };
}

/**
 * Find the main content element on the page
 */
function findMainContent(): Element {
  // Try semantic elements first
  const main = document.querySelector("main");
  if (main) return main;

  const article = document.querySelector("article");
  if (article) return article;

  const roleMain = document.querySelector('[role="main"]');
  if (roleMain) return roleMain;

  // Try common content containers
  const content =
    document.querySelector("#content") ||
    document.querySelector(".content") ||
    document.querySelector("#main-content") ||
    document.querySelector(".main-content") ||
    document.querySelector(".post-content") ||
    document.querySelector(".entry-content") ||
    document.querySelector(".article-content");
  if (content) return content;

  // Fall back to body
  return document.body;
}

/**
 * Extract the article title
 */
function extractTitle(): string {
  // Try h1 in article or main
  const articleH1 = document.querySelector("article h1, main h1");
  if (articleH1?.textContent) return articleH1.textContent.trim();

  // Try meta tags
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute("content");
  if (ogTitle) return ogTitle;

  // Fall back to document title
  return document.title;
}

/**
 * Clone element and remove non-content elements
 */
function cleanContent(element: Element): Element {
  const clone = element.cloneNode(true) as Element;

  // Remove non-content elements
  const selectorsToRemove = [
    "script",
    "style",
    "noscript",
    "iframe",
    "nav",
    "footer",
    "header:not(article header):not(main header)",
    "aside",
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    '[role="complementary"]',
    ".sidebar",
    ".nav",
    ".navigation",
    ".menu",
    ".advertisement",
    ".ad",
    ".ads",
    ".adsbygoogle",
    ".comments",
    ".comment-section",
    ".social-share",
    ".share-buttons",
    ".related-posts",
    ".recommended",
    ".newsletter",
    ".popup",
    ".modal",
    ".cookie-notice",
    ".breadcrumb",
    ".tags",
    ".categories",
  ];

  selectorsToRemove.forEach((selector) => {
    clone.querySelectorAll(selector).forEach((el) => el.remove());
  });

  return clone;
}

/**
 * Extract images from content
 */
function extractImages(content: Element): string[] {
  const images: string[] = [];
  content.querySelectorAll("img").forEach((img) => {
    const src = img.src || img.getAttribute("data-src");
    if (src && !src.includes("icon") && !src.includes("logo")) {
      images.push(src);
    }
  });
  return images;
}

/**
 * Load reader settings from storage
 */
async function loadSettings(): Promise<ReaderSettings> {
  try {
    const result = await chrome.storage.sync.get(["readerSettings"]);
    const stored = result.readerSettings as ReaderSettings | undefined;
    if (stored && typeof stored === "object") {
      return {
        fontFamily: stored.fontFamily || DEFAULT_SETTINGS.fontFamily,
        fontSize: stored.fontSize || DEFAULT_SETTINGS.fontSize,
      };
    }
    return DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save reader settings to storage
 */
async function saveSettings(settings: ReaderSettings): Promise<void> {
  try {
    await chrome.storage.sync.set({ readerSettings: settings });
  } catch (error) {
    console.error("[Reader Mode] Failed to save settings:", error);
  }
}

/**
 * Auto-clip the page when entering reader mode
 */
async function autoClipPage(title: string, content: Element): Promise<void> {
  try {
    // Check if already clipped via message to background
    const checkResponse = await chrome.runtime.sendMessage({
      action: "checkExistingClip",
      url: window.location.href,
    });

    if (checkResponse?.clip) {
      currentClipId = checkResponse.clip.id;
      currentHighlights = checkResponse.clip.highlights || [];

      // Restore saved highlights to the DOM
      restoreHighlights();
      return;
    }

    // Save new clip via message to background
    const saveResponse = await chrome.runtime.sendMessage({
      action: "savePageToDatabase",
      url: window.location.href,
      title: title,
      domContent: content.outerHTML,
      textContent: content.textContent || "",
      metadata: {
        clippedFrom: "reader-mode",
        clippedAt: new Date().toISOString(),
      },
    });

    if (saveResponse?.success && saveResponse?.clipId) {
      currentClipId = saveResponse.clipId;
      currentHighlights = [];
    } else {
      console.warn("[Reader Mode] Failed to save clip:", saveResponse?.error);
    }
  } catch (error) {
    console.error("[Reader Mode] Auto-clip failed:", error);
    // Don't fail reader mode if clip fails
  }
}

/**
 * Restore saved highlights to the DOM
 */
function restoreHighlights(): void {
  if (!contentWrapper || currentHighlights.length === 0) return;

  // Sort highlights by startOffset (process from end to start to preserve offsets)
  const sortedHighlights = [...currentHighlights].sort((a, b) => b.startOffset - a.startOffset);

  for (const highlight of sortedHighlights) {
    try {
      // Find the text in the content and wrap it
      findTextAndWrap(contentWrapper, highlight.text, highlight.id, highlight.note);
    } catch (error) {
      console.error("[Reader Mode] Error restoring highlight:", error);
    }
  }
}

/**
 * Find text in the DOM and wrap it with a mark element
 * Handles text that spans multiple text nodes
 */
function findTextAndWrap(
  container: Element,
  searchText: string,
  highlightId: string,
  note?: string,
): boolean {
  // First, try to find in a single text node (fast path)
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let node: Text | null;

  while ((node = walker.nextNode() as Text | null)) {
    const nodeText = node.textContent || "";
    const index = nodeText.indexOf(searchText);

    if (index !== -1) {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + searchText.length);

      const mark = document.createElement("mark");
      mark.className = "reader-highlight" + (note ? " has-note" : "");
      mark.dataset.highlightId = highlightId;

      range.surroundContents(mark);
      return true;
    }
  }

  // Text spans multiple nodes - build a text node map
  const textNodes: { node: Text; start: number; end: number }[] = [];
  const walker2 = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let pos = 0;

  while ((node = walker2.nextNode() as Text | null)) {
    const len = node.textContent?.length || 0;
    textNodes.push({ node, start: pos, end: pos + len });
    pos += len;
  }

  // Find where searchText starts in the combined text
  const fullText = container.textContent || "";
  const searchIndex = fullText.indexOf(searchText);

  if (searchIndex === -1) {
    return false;
  }

  const searchEnd = searchIndex + searchText.length;

  // Find the nodes that contain the start and end of our search text
  const startNodeInfo = textNodes.find((n) => searchIndex >= n.start && searchIndex < n.end);
  const endNodeInfo = textNodes.find((n) => searchEnd > n.start && searchEnd <= n.end);

  if (!startNodeInfo || !endNodeInfo) {
    return false;
  }

  const startOffset = searchIndex - startNodeInfo.start;
  const endOffset = searchEnd - endNodeInfo.start;

  try {
    const range = document.createRange();
    range.setStart(startNodeInfo.node, startOffset);
    range.setEnd(endNodeInfo.node, endOffset);

    const mark = document.createElement("mark");
    mark.className = "reader-highlight" + (note ? " has-note" : "");
    mark.dataset.highlightId = highlightId;

    // For cross-node ranges, we need to extract and wrap
    const contents = range.extractContents();
    mark.appendChild(contents);
    range.insertNode(mark);

    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Activate reader mode
 */
export async function activateReaderMode(): Promise<void> {
  if (readerModeActive) {
    return;
  }

  try {
    // Check if page is already clipped - use saved content if so
    const existingClip = await checkForExistingClip();

    let title: string;
    let content: Element;

    if (existingClip) {
      // Use saved content from clip
      title = existingClip.title;
      content = document.createElement("div");
      content.innerHTML = existingClip.dom_content;
      currentClipId = existingClip.id;
      currentHighlights = existingClip.highlights || [];
    } else {
      // Extract fresh content from the page
      const extracted = extractArticleContent();
      title = extracted.title;
      content = extracted.content;
    }

    // Load settings
    const settings = await loadSettings();

    // Create reader mode container with Shadow DOM
    await createReaderModeUI(title, content, settings);

    // Hide the original page content
    hideOriginalContent();

    // If no existing clip, save a new one
    if (!existingClip) {
      await autoClipPage(title, content);
    } else {
      // Check if highlights are already in the DOM (from edited content)
      const existingMarks = contentWrapper?.querySelectorAll(".reader-highlight");
      if (!existingMarks || existingMarks.length === 0) {
        // Restore highlights from the saved clip
        restoreHighlights();
      }
    }

    // Remember this URL for auto-enter on refresh
    await rememberReaderModeUrl();

    readerModeActive = true;
  } catch (error) {
    console.error("[Reader Mode] Error activating reader mode:", error);
  }
}

/**
 * Check if page is already clipped and return the clip data
 */
async function checkForExistingClip(): Promise<{
  id: string;
  title: string;
  dom_content: string;
  highlights?: Highlight[];
} | null> {
  try {
    const response = await chrome.runtime.sendMessage({
      action: "checkExistingClip",
      url: window.location.href,
    });

    if (response?.clip) {
      return response.clip;
    }
    return null;
  } catch (error) {
    console.error("[Reader Mode] Error checking for existing clip:", error);
    return null;
  }
}

/**
 * Hide original page content
 */
function hideOriginalContent(): void {
  // Store original styles
  originalPageDisplay = document.documentElement.style.overflow;
  originalBodyOverflow = document.body.style.overflow;

  // Hide scrollbars on original content
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
}

/**
 * Restore original page content visibility
 */
function restoreOriginalContent(): void {
  document.documentElement.style.overflow = originalPageDisplay;
  document.body.style.overflow = originalBodyOverflow;
}

/**
 * Create toolbar button
 */
function createToolbarButton(icon: string, title: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "reader-mode-btn";
  btn.innerHTML = icon;
  btn.title = title;
  btn.addEventListener("click", onClick);
  return btn;
}

/**
 * Create the settings panel
 */
function createSettingsPanel(settings: ReaderSettings): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "reader-settings-panel";

  // Font family group
  const fontGroup = document.createElement("div");
  fontGroup.className = "settings-group";
  const fontLabel = document.createElement("label");
  fontLabel.className = "settings-label";
  fontLabel.textContent = "Font";
  const fontButtons = document.createElement("div");
  fontButtons.className = "font-buttons";

  const fonts: Array<{ id: ReaderSettings["fontFamily"]; label: string }> = [
    { id: "sans", label: "Aa" },
    { id: "serif", label: "Aa" },
    { id: "mono", label: "Aa" },
  ];

  fonts.forEach((font) => {
    const btn = document.createElement("button");
    btn.className = `font-btn ${settings.fontFamily === font.id ? "active" : ""}`;
    btn.textContent = font.label;
    btn.style.fontFamily =
      font.id === "sans" ? "sans-serif" : font.id === "serif" ? "Georgia, serif" : "monospace";
    btn.addEventListener("click", () => updateFontFamily(font.id));
    fontButtons.appendChild(btn);
  });

  fontGroup.appendChild(fontLabel);
  fontGroup.appendChild(fontButtons);

  // Font size group
  const sizeGroup = document.createElement("div");
  sizeGroup.className = "settings-group";
  const sizeLabel = document.createElement("label");
  sizeLabel.className = "settings-label";
  sizeLabel.textContent = "Size";

  const sizeSlider = document.createElement("input");
  sizeSlider.type = "range";
  sizeSlider.className = "size-slider";
  sizeSlider.min = "14";
  sizeSlider.max = "22";
  sizeSlider.value = settings.fontSize.toString();
  sizeSlider.addEventListener("input", () => updateFontSize(parseInt(sizeSlider.value)));

  const sizeValue = document.createElement("div");
  sizeValue.className = "size-value";
  sizeValue.textContent = `${settings.fontSize}px`;
  sizeValue.id = "size-value-display";

  sizeGroup.appendChild(sizeLabel);
  sizeGroup.appendChild(sizeSlider);
  sizeGroup.appendChild(sizeValue);

  panel.appendChild(fontGroup);
  panel.appendChild(sizeGroup);

  return panel;
}

/**
 * Update font family setting
 */
async function updateFontFamily(family: ReaderSettings["fontFamily"]): Promise<void> {
  if (!shadowRoot) return;

  const wrapper = shadowRoot.querySelector(".reader-mode-wrapper");
  if (!wrapper) return;

  // Update class
  wrapper.classList.remove("font-sans", "font-serif", "font-mono");
  wrapper.classList.add(`font-${family}`);

  // Update button states
  const buttons = shadowRoot.querySelectorAll(".font-btn");
  const families: ReaderSettings["fontFamily"][] = ["sans", "serif", "mono"];
  buttons.forEach((btn, i) => {
    btn.classList.toggle("active", families[i] === family);
  });

  // Save setting
  const settings = await loadSettings();
  await saveSettings({ ...settings, fontFamily: family });
}

/**
 * Update font size setting
 */
async function updateFontSize(size: number): Promise<void> {
  if (!shadowRoot) return;

  const wrapper = shadowRoot.querySelector(".reader-mode-wrapper") as HTMLElement;
  if (!wrapper) return;

  wrapper.style.setProperty("--font-size-base", `${size}px`);

  // Update display
  const display = shadowRoot.getElementById("size-value-display");
  if (display) display.textContent = `${size}px`;

  // Save setting
  const settings = await loadSettings();
  await saveSettings({ ...settings, fontSize: size });
}

/**
 * Toggle settings panel visibility
 */
function toggleSettings(): void {
  if (settingsPanel) {
    settingsPanel.classList.toggle("visible");
  }
}

/**
 * Toggle edit mode on/off
 */
function toggleEditMode(): void {
  if (!contentWrapper || !shadowRoot) return;

  if (editModeActive) {
    // Exiting edit mode - save the content
    saveEditedContent();
  } else {
    // Entering edit mode
    editModeActive = true;

    // Toggle contentEditable on the content wrapper
    contentWrapper.contentEditable = "true";

    // Update button icon to checkmark
    if (editModeBtn) {
      editModeBtn.innerHTML = "✓";
      editModeBtn.title = "Save Edits";
      editModeBtn.setAttribute("aria-pressed", "true");
    }

    // Add edit-mode class on wrapper for visual indication
    const wrapper = shadowRoot.querySelector(".reader-mode-wrapper");
    if (wrapper) {
      wrapper.classList.add("edit-mode");
    }

    // Hide note editor if open
    if (noteEditor?.classList.contains("visible")) {
      saveCurrentNote();
    }
  }
}

/**
 * Save edited content and exit edit mode
 */
async function saveEditedContent(): Promise<void> {
  if (!contentWrapper || !shadowRoot || !currentClipId) return;

  try {
    // Get the edited content
    const domContent = contentWrapper.innerHTML;
    const textContent = contentWrapper.textContent || "";

    // Send update to background script
    const response = await chrome.runtime.sendMessage({
      action: "updateClipContent",
      clipId: currentClipId,
      domContent,
      textContent,
    });

    if (response?.success) {
      showToast("Edits saved");
    } else {
      showToast("Failed to save edits");
      console.error("[Reader Mode] Failed to save edits:", response?.error);
    }
  } catch (error) {
    console.error("[Reader Mode] Error saving edits:", error);
    showToast("Failed to save edits");
  }

  // Exit edit mode regardless of save success
  editModeActive = false;
  contentWrapper.contentEditable = "false";

  // Update button icon back to edit
  if (editModeBtn) {
    editModeBtn.innerHTML = "✎";
    editModeBtn.title = "Edit Mode";
    editModeBtn.setAttribute("aria-pressed", "false");
  }

  // Remove edit-mode class
  const wrapper = shadowRoot.querySelector(".reader-mode-wrapper");
  if (wrapper) {
    wrapper.classList.remove("edit-mode");
  }
}

/**
 * Check if edit mode is active (used by selection listener)
 */
function isEditMode(): boolean {
  return editModeActive;
}

/**
 * Create note editor element (positioned to the right of highlights)
 */
function createNoteEditor(): HTMLElement {
  const editor = document.createElement("div");
  editor.className = "note-editor";
  editor.innerHTML = `
    <textarea class="note-textarea" placeholder="Add a note..."></textarea>
    <div class="note-actions">
      <button class="note-save">Save</button>
      <button class="note-delete">Delete</button>
    </div>
  `;
  return editor;
}

/**
 * Create the reader mode UI with Shadow DOM
 */
async function createReaderModeUI(
  title: string,
  content: Element,
  settings: ReaderSettings,
): Promise<void> {
  readerModeContainer = document.createElement("div");
  readerModeContainer.id = "reader-mode-root";

  shadowRoot = readerModeContainer.attachShadow({ mode: "closed" });

  // Inject styles
  const styleElement = document.createElement("style");
  styleElement.textContent = styles;
  shadowRoot.appendChild(styleElement);

  // Create wrapper with font class
  const wrapper = document.createElement("div");
  wrapper.className = `reader-mode-wrapper font-${settings.fontFamily}`;
  wrapper.style.setProperty("--font-size-base", `${settings.fontSize}px`);

  // Create toolbar
  const toolbar = document.createElement("div");
  toolbar.className = "reader-mode-toolbar";

  const settingsBtn = createToolbarButton("Aa", "Settings", toggleSettings);
  editModeBtn = createToolbarButton("✎", "Edit Mode", toggleEditMode);
  const closeBtn = createToolbarButton("×", "Exit (Esc)", deactivateReaderMode);

  toolbar.appendChild(settingsBtn);
  toolbar.appendChild(editModeBtn);
  toolbar.appendChild(closeBtn);

  // Create settings panel
  settingsPanel = createSettingsPanel(settings);

  // Create main container
  const container = document.createElement("div");
  container.className = "reader-mode-container";

  // Create header
  const header = document.createElement("div");
  header.className = "reader-mode-header";

  const titleElement = document.createElement("h1");
  titleElement.className = "reader-mode-title";
  titleElement.textContent = title;

  // Add clip status indicator (clickable to open in viewer)
  const clipStatus = document.createElement("a");
  clipStatus.className = "clip-status";
  clipStatus.innerHTML = '<span class="clip-status-dot"></span> Saved locally';
  clipStatus.title = "Open in clip viewer";
  clipStatus.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentClipId) {
      chrome.runtime.sendMessage({
        action: "openClipViewer",
        clipId: currentClipId,
      });
    }
  });

  header.appendChild(titleElement);
  header.appendChild(clipStatus);

  // Create content wrapper
  contentWrapper = document.createElement("div");
  contentWrapper.className = "reader-mode-content";
  contentWrapper.appendChild(content);

  // Create note editor (will be positioned next to active highlight)
  noteEditor = createNoteEditor();

  // Assemble UI
  container.appendChild(header);
  container.appendChild(contentWrapper);
  wrapper.appendChild(toolbar);
  wrapper.appendChild(settingsPanel);
  wrapper.appendChild(container);
  wrapper.appendChild(noteEditor);
  shadowRoot.appendChild(wrapper);

  document.body.appendChild(readerModeContainer);

  // Setup event listeners
  document.addEventListener("keydown", handleReaderModeKeydown);
  setupSelectionListener();
  setupHighlightListeners();
}

/**
 * Get current selection (works within shadow DOM)
 */
function getSelection(): Selection | null {
  // Try shadowRoot.getSelection first (for shadow DOM)
  if (shadowRoot && typeof (shadowRoot as any).getSelection === "function") {
    const shadowSelection = (shadowRoot as any).getSelection();
    if (shadowSelection && !shadowSelection.isCollapsed) {
      return shadowSelection;
    }
  }

  // Fallback to window.getSelection
  return window.getSelection();
}

/**
 * Setup text selection listener for highlighting
 */
function setupSelectionListener(): void {
  if (!shadowRoot || !contentWrapper) return;

  // Listen on the shadowRoot for mouseup events
  shadowRoot.addEventListener("mouseup", async (e) => {
    // Skip highlighting in edit mode - allow normal text editing
    if (isEditMode()) {
      return;
    }

    // Small delay to let the selection finalize
    await new Promise((resolve) => setTimeout(resolve, 10));

    const selection = getSelection();

    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      return;
    }

    // Check if selection is within our content wrapper
    const anchorNode = selection.anchorNode;
    if (!anchorNode || !contentWrapper?.contains(anchorNode)) {
      return;
    }

    // Immediately create highlight
    await createHighlightFromSelection(selection);
  });
}

/**
 * Create highlight from current selection
 */
async function createHighlightFromSelection(selection: Selection): Promise<void> {
  const text = selection.toString().trim();

  if (!text || !currentClipId) {
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      action: "addHighlight",
      clipId: currentClipId,
      highlight: {
        text,
        startOffset: 0,
        endOffset: text.length,
        color: "#fff3cd",
      },
    });

    if (response?.success && response?.highlight) {
      currentHighlights.push(response.highlight);
      applyHighlightToDOM(selection, response.highlight.id);
      selection.removeAllRanges();
    }
  } catch (error) {
    console.error("[Reader Mode] Failed to create highlight:", error);
  }
}

/**
 * Apply highlight styling to selection, returns the mark element
 */
function applyHighlightToDOM(selection: Selection, highlightId: string): HTMLElement | null {
  const range = selection.getRangeAt(0);

  const mark = document.createElement("mark");
  mark.className = "reader-highlight";
  mark.dataset.highlightId = highlightId;

  try {
    range.surroundContents(mark);
    return mark;
  } catch {
    // Can't surround if selection spans multiple elements
    const fragment = range.extractContents();
    mark.appendChild(fragment);
    range.insertNode(mark);
    return mark;
  }
}

/**
 * Check if CSS anchor positioning is supported
 */
function supportsAnchorPositioning(): boolean {
  return CSS.supports("anchor-name", "--test");
}

/**
 * Show note editor positioned to the right of a highlight
 */
function showNoteEditor(markElement: HTMLElement, highlightId: string, existingNote: string): void {
  if (!noteEditor || !shadowRoot) return;

  activeHighlightId = highlightId;

  // Clear previous active highlights and set new one
  shadowRoot
    .querySelectorAll(".reader-highlight.active")
    .forEach((el) => el.classList.remove("active"));
  markElement.classList.add("active");

  // Fallback positioning for browsers without CSS anchor positioning
  if (!supportsAnchorPositioning()) {
    const rect = markElement.getBoundingClientRect();
    const containerRect = shadowRoot
      .querySelector(".reader-mode-container")
      ?.getBoundingClientRect();

    if (containerRect) {
      // Position to the right of the content container
      const leftPos = containerRect.right + 24;
      noteEditor.style.left = `${leftPos}px`;
      noteEditor.style.top = `${rect.top + window.scrollY}px`;
    }
  }

  // Set existing note value
  const textarea = noteEditor.querySelector(".note-textarea") as HTMLTextAreaElement;
  if (textarea) {
    textarea.value = existingNote;
    textarea.focus();
  }

  noteEditor.classList.add("visible");
}

/**
 * Hide note editor
 */
function hideNoteEditor(): void {
  if (!noteEditor || !shadowRoot) return;

  noteEditor.classList.remove("visible");
  activeHighlightId = null;

  shadowRoot
    .querySelectorAll(".reader-highlight.active")
    .forEach((el) => el.classList.remove("active"));
}

/**
 * Save the current note
 */
async function saveCurrentNote(): Promise<void> {
  if (!noteEditor || !activeHighlightId || !currentClipId || !shadowRoot) return;

  const textarea = noteEditor.querySelector(".note-textarea") as HTMLTextAreaElement;
  const note = textarea?.value || "";

  try {
    await chrome.runtime.sendMessage({
      action: "updateHighlightNote",
      clipId: currentClipId,
      highlightId: activeHighlightId,
      note,
    });

    // Update local state
    const hl = currentHighlights.find((h) => h.id === activeHighlightId);
    if (hl) hl.note = note;

    // Update has-note class on the mark element
    const markElement = shadowRoot.querySelector(`[data-highlight-id="${activeHighlightId}"]`);
    if (markElement) {
      if (note) {
        markElement.classList.add("has-note");
      } else {
        markElement.classList.remove("has-note");
      }
    }

    hideNoteEditor();
  } catch (error) {
    console.error("[Reader Mode] Failed to save note:", error);
  }
}

/**
 * Delete the current highlight
 */
async function deleteCurrentHighlight(): Promise<void> {
  if (!activeHighlightId || !currentClipId || !shadowRoot) return;

  try {
    await chrome.runtime.sendMessage({
      action: "deleteHighlight",
      clipId: currentClipId,
      highlightId: activeHighlightId,
    });

    // Remove from local state
    currentHighlights = currentHighlights.filter((h) => h.id !== activeHighlightId);

    // Unwrap the mark element
    const markElement = shadowRoot.querySelector(`[data-highlight-id="${activeHighlightId}"]`);
    if (markElement) {
      const parent = markElement.parentNode;
      while (markElement.firstChild) {
        parent?.insertBefore(markElement.firstChild, markElement);
      }
      markElement.remove();
    }

    hideNoteEditor();
  } catch (error) {
    console.error("[Reader Mode] Failed to delete highlight:", error);
  }
}

/**
 * Setup highlight interaction listeners
 */
function setupHighlightListeners(): void {
  if (!contentWrapper || !noteEditor) return;

  // Click on highlight to edit note
  contentWrapper.addEventListener("click", (e) => {
    const target = e.target as Element;
    const markElement = target.closest(".reader-highlight") as HTMLElement;

    if (!markElement) {
      // Clicked outside highlight - save and hide editor
      if (activeHighlightId) {
        saveCurrentNote();
      }
      return;
    }

    const highlightId = markElement.dataset.highlightId;
    if (!highlightId) return;

    // If clicking a different highlight, save current first
    if (activeHighlightId && activeHighlightId !== highlightId) {
      saveCurrentNote();
    }

    const highlightData = currentHighlights.find((h) => h.id === highlightId);
    showNoteEditor(markElement, highlightId, highlightData?.note || "");
  });

  // Setup note editor buttons
  const saveBtn = noteEditor.querySelector(".note-save");
  const deleteBtn = noteEditor.querySelector(".note-delete");

  saveBtn?.addEventListener("click", () => saveCurrentNote());
  deleteBtn?.addEventListener("click", () => deleteCurrentHighlight());
}

/**
 * Handle keyboard events in reader mode
 */
function handleReaderModeKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && readerModeActive) {
    // First close note editor if open
    if (noteEditor?.classList.contains("visible")) {
      saveCurrentNote();
      return;
    }
    // Then close settings panel if open
    if (settingsPanel?.classList.contains("visible")) {
      settingsPanel.classList.remove("visible");
      return;
    }
    event.preventDefault();
    deactivateReaderMode();
  }
}

/**
 * Deactivate reader mode and restore original content
 */
export async function deactivateReaderMode(): Promise<void> {
  if (!readerModeActive) {
    return;
  }

  try {
    // Forget this URL so it won't auto-enter on refresh
    await forgetReaderModeUrl();

    document.removeEventListener("keydown", handleReaderModeKeydown);

    if (readerModeContainer && readerModeContainer.parentNode) {
      readerModeContainer.parentNode.removeChild(readerModeContainer);
    }

    restoreOriginalContent();

    // Reset state
    readerModeActive = false;
    readerModeContainer = null;
    shadowRoot = null;
    contentWrapper = null;
    settingsPanel = null;
    noteEditor = null;
    activeHighlightId = null;
    currentClipId = null;
    currentHighlights = [];
    editModeActive = false;
    editModeBtn = null;
  } catch (error) {
    console.error("[Reader Mode] Error deactivating reader mode:", error);
  }
}

/**
 * Toggle reader mode on/off
 */
export function toggleReaderMode(): void {
  if (readerModeActive) {
    deactivateReaderMode();
  } else {
    activateReaderMode();
  }
}

/**
 * Check if reader mode is currently active
 */
export function isReaderModeActive(): boolean {
  return readerModeActive;
}
