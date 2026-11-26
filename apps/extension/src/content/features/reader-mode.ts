/**
 * Reader Mode Web Component
 * Provides a clean, distraction-free reading experience isolated in a Web Component
 * with closed Shadow DOM:
 * - Auto-clip on entry
 * - Text highlighting with annotations and live sync
 * - Chunk-by-chunk AI tidying and inline editing
 */

import { isXPage, extractXContent, type XContentResult } from "./extractors/x-extractor.js";
import { renderXContent } from "./extractors/x-renderer.js";
import styles from "./reader-mode.css?raw";
import { getHtmlChunks, parseJSONObject, type Highlight, type JSONValue } from "@repo/shared";
import { showToast } from "../toast.js";
import { copyToClipboard } from "../clipboard.js";
import { isCommandPaletteOpen } from "../command-palette.js";
import { defineCustomElement, isolateKeyboardEvents, mountOverlayHost } from "../web-component.js";
import {
  wrapContentInChunks,
  setChunkLoading,
  setChunkComplete,
  removeChunkUI,
  getCleanedContent,
} from "./tidy-chunks.js";

export const READER_MODE_TAG = "cool-copy-reader-mode";

interface ReaderSettings {
  fontFamily: "sans" | "serif" | "mono";
  fontSize: number;
}

interface SelectionShadowRoot extends ShadowRoot {
  getSelection(): Selection | null;
}

interface ExistingClip {
  id: string;
  title: string;
  dom_content: string;
  highlights?: Highlight[];
}

interface ReaderMountOptions {
  title: string;
  content: Element;
  settings: ReaderSettings;
  clipId: string | null;
  highlights: Highlight[];
  onRequestExit: () => Promise<void>;
}

const DEFAULT_SETTINGS: ReaderSettings = {
  fontFamily: "sans",
  fontSize: 16,
};

const READER_MODE_URLS_KEY = "readerModeUrls";
const LOCAL_CLIPS_STORAGE_KEY = "local_clips";

const MORE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`;
const TIDY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 12h-5"/><path d="M15 8h-5"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V11a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h3"/></svg>`;
const RESET_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;
const CLIP_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"/></svg>`;
const COPY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const SHARE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg>`;
const SPEAKER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
const PENCIL_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;
const TRASH_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`;
const SAVE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
const CANCEL_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

let readerModeActive = false;
let readerModeActivating = false;
let activeHost: HTMLElement | null = null;
let activeController: ReaderModeController | null = null;
let originalPageOverflow = "";
let originalBodyOverflow = "";

const readerControllers = new WeakMap<HTMLElement, ReaderModeController>();
const readerShadows = new WeakMap<HTMLElement, ShadowRoot>();

function hasShadowSelection(root: ShadowRoot): root is SelectionShadowRoot {
  return "getSelection" in root;
}

function readStoredString(value: JSONValue | undefined): string | undefined {
  return Object.prototype.toString.call(value) === "[object String]" ? String(value) : undefined;
}

function readStoredStringArray(value: JSONValue | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => Object.prototype.toString.call(item) === "[object String]",
  );
}

function parseReaderSettings(stored: ReturnType<typeof parseJSONObject>): ReaderSettings {
  if (!stored) return DEFAULT_SETTINGS;

  const fontFamilyValue = readStoredString(stored.fontFamily);
  const fontFamily =
    fontFamilyValue === "serif" || fontFamilyValue === "mono" ? fontFamilyValue : "sans";
  const fontSizeValue = stored.fontSize;
  const fontSize = Number.isFinite(fontSizeValue)
    ? Math.min(22, Math.max(14, Number(fontSizeValue)))
    : DEFAULT_SETTINGS.fontSize;
  return { fontFamily, fontSize };
}

function supportsAnchorPositioning(): boolean {
  return Boolean(globalThis.CSS?.supports?.("anchor-name", "--test"));
}

async function rememberReaderModeUrl(): Promise<void> {
  try {
    const url = window.location.href;
    const result = await chrome.storage.local.get([READER_MODE_URLS_KEY]);
    const storedUrls = parseJSONObject(JSON.stringify({ value: result[READER_MODE_URLS_KEY] }));
    const urls = readStoredStringArray(storedUrls?.value);

    if (!urls.includes(url)) {
      urls.push(url);
      const trimmedUrls = urls.slice(-100);
      await chrome.storage.local.set({ [READER_MODE_URLS_KEY]: trimmedUrls });
    }
  } catch (error) {
    console.error("[Reader Mode] Failed to remember URL:", error);
  }
}

async function forgetReaderModeUrl(): Promise<void> {
  try {
    const url = window.location.href;
    const result = await chrome.storage.local.get([READER_MODE_URLS_KEY]);
    const storedUrls = parseJSONObject(JSON.stringify({ value: result[READER_MODE_URLS_KEY] }));
    const urls = readStoredStringArray(storedUrls?.value);

    const index = urls.indexOf(url);
    if (index !== -1) {
      urls.splice(index, 1);
      await chrome.storage.local.set({ [READER_MODE_URLS_KEY]: urls });
    }
  } catch (error) {
    console.error("[Reader Mode] Failed to forget URL:", error);
  }
}

async function shouldAutoEnterReaderMode(): Promise<boolean> {
  try {
    const url = window.location.href;
    const result = await chrome.storage.local.get([READER_MODE_URLS_KEY]);
    const storedUrls = parseJSONObject(JSON.stringify({ value: result[READER_MODE_URLS_KEY] }));
    const urls = readStoredStringArray(storedUrls?.value);
    return urls.includes(url);
  } catch (error) {
    console.error("[Reader Mode] Failed to check URL:", error);
    return false;
  }
}

export async function initReaderMode(): Promise<void> {
  if (await shouldAutoEnterReaderMode()) {
    const delay = isXPage() ? 500 : 100;
    setTimeout(() => {
      void activateReaderMode();
    }, delay);
  }
}

function waitForSelector(selector: string, timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) {
      resolve(true);
      return;
    }

    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(true);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      resolve(Boolean(document.querySelector(selector)));
    }, timeoutMs);
  });
}

export async function extractArticleContent(): Promise<{
  title: string;
  content: Element;
  images: string[];
}> {
  if (isXPage()) {
    try {
      const tweetsReady = await waitForSelector('[data-testid="tweet"]', 5000);
      if (!tweetsReady) {
        console.warn("[Reader Mode] X.com: timed out waiting for tweet elements");
      }

      const xResult = extractXContent();
      console.log(
        `[Reader Mode] X.com: extracted ${xResult.tweets.length} tweets (${xResult.pageType})`,
      );
      if (xResult.tweets.length > 0) {
        const content = renderXContent(xResult);
        const title = generateXTitle(xResult);
        const images = extractImages(content);
        return { title, content, images };
      }
    } catch (error) {
      console.warn("[Reader Mode] X.com extractor failed, falling back to generic:", error);
    }
  }

  const mainContent = findMainContent();
  const cleanedContent = cleanContent(mainContent);
  const title = extractTitle();
  const images = extractImages(cleanedContent);

  return { title, content: cleanedContent, images };
}

function findMainContent(): Element {
  const substackBody = document.querySelector("article .body.markup");
  if (substackBody) return substackBody;

  const mediumContent = document.querySelector("article[data-post-id]");
  if (mediumContent) return mediumContent;

  if (window.location.hostname.includes("antirez.com")) {
    const antirezContent = document.querySelector("div.topnews");
    if (antirezContent) return antirezContent;
  }

  const main = document.querySelector("main");
  if (main) return main;

  const article = document.querySelector("article");
  if (article) return article;

  const roleMain = document.querySelector('[role="main"]');
  if (roleMain) return roleMain;

  const content =
    document.querySelector("#content") ||
    document.querySelector(".content") ||
    document.querySelector("#main-content") ||
    document.querySelector(".main-content") ||
    document.querySelector(".post-content") ||
    document.querySelector(".entry-content") ||
    document.querySelector(".article-content");
  if (content) return content;

  return document.body;
}

function extractTitle(): string {
  const articleH1 = document.querySelector("article h1, main h1");
  if (articleH1?.textContent) return articleH1.textContent.trim();

  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute("content");
  if (ogTitle) return ogTitle;

  return document.title;
}

function generateXTitle(xResult: XContentResult): string {
  if (xResult.tweets.length === 0) {
    return document.title;
  }

  const firstTweet = xResult.tweets[0];
  const handle = firstTweet.author.handle || firstTweet.author.name;

  if (xResult.pageType === "thread" && xResult.tweets.length > 1) {
    return `Thread by ${handle}`;
  }

  const text = firstTweet.text.trim();
  if (!text) {
    return `@${handle}`;
  }

  const maxLen = 60;
  if (text.length <= maxLen) {
    return `@${handle}: ${text}`;
  }

  const truncated = text.slice(0, maxLen).replace(/\s+\S*$/, "");
  return `@${handle}: ${truncated}...`;
}

function cleanContent(element: Element): Element {
  const clone = element.cloneNode(true);
  if (!(clone instanceof Element)) throw new Error("Cloned reader content is not an element");

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
    ".subscribe-widget",
    '[data-component-name*="Subscribe"]',
    ".post-header",
    ".post-footer",
    ".visibility-check",
    "dialog",
    '[class*="modal"]',
    '[class*="popup"]',
    ".like-button-container",
    ".post-ufi",
    '[class*="ufi-button"]',
  ];

  selectorsToRemove.forEach((selector) => {
    clone.querySelectorAll(selector).forEach((el) => el.remove());
  });

  return clone;
}

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

async function loadSettings(): Promise<ReaderSettings> {
  try {
    const result = await chrome.storage.sync.get(["readerSettings"]);
    const storedSettings = JSON.stringify(result.readerSettings);
    return parseReaderSettings(storedSettings ? parseJSONObject(storedSettings) : undefined);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function checkForExistingClip(): Promise<ExistingClip | null> {
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

function hideOriginalContent(): void {
  originalPageOverflow = document.documentElement.style.overflow;
  originalBodyOverflow = document.body.style.overflow;

  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
}

function restoreOriginalContent(): void {
  document.documentElement.style.overflow = originalPageOverflow;
  document.body.style.overflow = originalBodyOverflow;
}

function findTextAndWrap(
  container: Element,
  searchText: string,
  highlightId: string,
  note?: string,
): boolean {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let candidate: Node | null;

  while ((candidate = walker.nextNode())) {
    if (!(candidate instanceof Text)) continue;
    const node = candidate;
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

  const textNodes: { node: Text; start: number; end: number }[] = [];
  const walker2 = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let pos = 0;

  while ((candidate = walker2.nextNode())) {
    if (!(candidate instanceof Text)) continue;
    const node = candidate;
    const len = node.textContent?.length || 0;
    textNodes.push({ node, start: pos, end: pos + len });
    pos += len;
  }

  const fullText = container.textContent || "";
  const searchIndex = fullText.indexOf(searchText);

  if (searchIndex === -1) {
    return false;
  }

  const searchEnd = searchIndex + searchText.length;
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

    const contents = range.extractContents();
    mark.appendChild(contents);
    range.insertNode(mark);

    return true;
  } catch {
    return false;
  }
}

function wrapHighlightByOffset(container: Element, highlight: Highlight): boolean {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let currentOffset = 0;
  let candidate: Node | null;

  while ((candidate = walker.nextNode())) {
    if (!(candidate instanceof Text)) continue;
    const node = candidate;
    const nodeLength = node.textContent?.length || 0;
    const nodeStart = currentOffset;
    const nodeEnd = currentOffset + nodeLength;

    if (nodeEnd > highlight.startOffset && nodeStart < highlight.endOffset) {
      const mark = document.createElement("mark");
      mark.className = "reader-highlight" + (highlight.note ? " has-note" : "");
      mark.dataset.highlightId = highlight.id;

      const range = document.createRange();
      const startOffset = Math.max(0, highlight.startOffset - nodeStart);
      const endOffset = Math.min(nodeLength, highlight.endOffset - nodeStart);

      range.setStart(node, startOffset);
      range.setEnd(node, endOffset);

      try {
        range.surroundContents(mark);
        return true;
      } catch {
        const fragment = range.extractContents();
        mark.appendChild(fragment);
        range.insertNode(mark);
        return true;
      }
    }

    currentOffset = nodeEnd;
  }

  return findTextAndWrap(container, highlight.text, highlight.id, highlight.note);
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

function applyHighlightToDOM(selection: Selection, highlightId: string): HTMLElement | null {
  const range = selection.getRangeAt(0);

  const mark = document.createElement("mark");
  mark.className = "reader-highlight";
  mark.dataset.highlightId = highlightId;

  try {
    range.surroundContents(mark);
    return mark;
  } catch {
    const fragment = range.extractContents();
    mark.appendChild(fragment);
    range.insertNode(mark);
    return mark;
  }
}

function createToolbarButton(icon: string, title: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "reader-mode-btn";
  btn.innerHTML = icon;
  btn.title = title;
  btn.setAttribute("aria-label", title);
  btn.addEventListener("click", onClick);
  return btn;
}

function createNoteEditor(): HTMLElement {
  const editor = document.createElement("div");
  editor.className = "note-editor";
  editor.innerHTML = `
    <textarea class="note-textarea" placeholder="Add a note..."></textarea>
    <div class="note-actions">
      <button type="button" class="note-copy" title="Copy highlight" aria-label="Copy highlight"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 14h6"/><path d="M12 17v-6"/></svg></button>
      <button type="button" class="note-save">Save</button>
      <button type="button" class="note-delete">Delete</button>
    </div>
  `;
  return editor;
}

class ReaderModeController {
  readonly host: HTMLElement;
  readonly shadow: ShadowRoot;

  private wrapper: HTMLDivElement | null = null;
  private toolbar: HTMLDivElement | null = null;
  private dropdown: HTMLDivElement | null = null;
  private dropdownMenu: HTMLDivElement | null = null;
  private contentWrapper: HTMLDivElement | null = null;
  private noteEditor: HTMLElement | null = null;
  private progressBar: HTMLDivElement | null = null;
  private tidyButton: HTMLButtonElement | null = null;
  private copyHighlightsButton: HTMLButtonElement | null = null;
  private editToolbarContainer: HTMLDivElement | null = null;

  private title = "";
  private currentClipId: string | null = null;
  private currentHighlights: Highlight[] = [];
  private activeHighlightId: string | null = null;
  private tidyModeActive = false;
  private editModeActive = false;
  private originalContent = "";
  private onRequestExit: (() => Promise<void>) | null = null;

  private abortController: AbortController | null = null;
  private storageChangeListener:
    | ((changes: { [key: string]: chrome.storage.StorageChange }) => void)
    | null = null;

  constructor(host: HTMLElement) {
    this.host = host;
    this.shadow = host.attachShadow({ mode: "closed" });
    readerShadows.set(host, this.shadow);

    const styleElement = document.createElement("style");
    styleElement.textContent = styles;
    this.shadow.appendChild(styleElement);
  }

  render(options: ReaderMountOptions): void {
    this.title = options.title;
    this.currentClipId = options.clipId;
    this.currentHighlights = [...options.highlights];
    this.onRequestExit = options.onRequestExit;

    // Clear previous rendered wrapper while keeping the shadow <style>
    this.wrapper?.remove();

    const wrapper = document.createElement("div");
    wrapper.className = `reader-mode-wrapper font-${options.settings.fontFamily}`;
    wrapper.style.setProperty("--cc-reader-font-size-base", `${options.settings.fontSize}px`);
    this.wrapper = wrapper;

    const toolbar = document.createElement("div");
    toolbar.className = "reader-mode-toolbar";
    this.toolbar = toolbar;

    const dropdown = document.createElement("div");
    dropdown.className = "reader-dropdown";
    this.dropdown = dropdown;

    const dropdownMenu = document.createElement("div");
    dropdownMenu.className = "reader-dropdown-menu";
    this.dropdownMenu = dropdownMenu;

    const dropdownBtn = createToolbarButton(MORE_ICON, "More options", () => {
      dropdownMenu.classList.toggle("visible");
    });

    const tidyBtn = document.createElement("button");
    tidyBtn.type = "button";
    tidyBtn.className = "reader-dropdown-item";
    tidyBtn.innerHTML = `${TIDY_ICON} Tidy Content`;
    this.tidyButton = tidyBtn;
    tidyBtn.addEventListener("click", () => {
      dropdownMenu.classList.remove("visible");
      if (this.tidyModeActive) {
        void this.exitTidyMode();
      } else {
        void this.enterTidyMode();
      }
    });

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "reader-dropdown-item";
    editBtn.innerHTML = `${PENCIL_ICON} Edit Content`;
    editBtn.addEventListener("click", () => {
      dropdownMenu.classList.remove("visible");
      this.enterEditMode();
    });

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "reader-dropdown-item";
    resetBtn.innerHTML = `${RESET_ICON} Reset Content`;
    resetBtn.addEventListener("click", () => {
      dropdownMenu.classList.remove("visible");
      window.location.reload();
    });

    const separator = document.createElement("div");
    separator.className = "reader-dropdown-separator";

    const viewClipBtn = document.createElement("button");
    viewClipBtn.type = "button";
    viewClipBtn.className = "reader-dropdown-item";
    viewClipBtn.innerHTML = `${CLIP_ICON} View Clip`;
    viewClipBtn.addEventListener("click", () => {
      dropdownMenu.classList.remove("visible");
      this.openInClipViewer();
    });

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "reader-dropdown-item";
    copyBtn.innerHTML = `${COPY_ICON} Copy Content`;
    copyBtn.addEventListener("click", async () => {
      dropdownMenu.classList.remove("visible");
      const textContent = this.contentWrapper?.textContent || "";
      try {
        await navigator.clipboard.writeText(textContent);
        copyBtn.innerHTML = `${COPY_ICON} Copied!`;
        setTimeout(() => {
          copyBtn.innerHTML = `${COPY_ICON} Copy Content`;
        }, 1500);
      } catch (err) {
        console.error("Failed to copy content:", err);
      }
    });

    const copyHighlightsBtn = document.createElement("button");
    copyHighlightsBtn.type = "button";
    copyHighlightsBtn.className = "reader-dropdown-item";
    copyHighlightsBtn.innerHTML = `${COPY_ICON} Copy highlights`;
    this.copyHighlightsButton = copyHighlightsBtn;
    this.updateCopyHighlightsButtonState();
    copyHighlightsBtn.addEventListener("click", () => {
      dropdownMenu.classList.remove("visible");
      void this.copyAllHighlights();
    });

    const shareBtn = document.createElement("button");
    shareBtn.type = "button";
    shareBtn.className = "reader-dropdown-item";
    shareBtn.innerHTML = `${SHARE_ICON} Share`;
    shareBtn.addEventListener("click", () => {
      dropdownMenu.classList.remove("visible");
      void this.handleShareClip(shareBtn);
    });

    const readAloudBtn = document.createElement("button");
    readAloudBtn.type = "button";
    readAloudBtn.className = "reader-dropdown-item";
    readAloudBtn.innerHTML = `${SPEAKER_ICON} Read Aloud`;
    readAloudBtn.addEventListener("click", () => {
      dropdownMenu.classList.remove("visible");
      const textContent = this.contentWrapper?.textContent || "";
      void chrome.runtime.sendMessage({
        action: "readAloud",
        text: textContent,
        title: this.title,
        url: window.location.href,
      });
    });

    const secondSeparator = document.createElement("div");
    secondSeparator.className = "reader-dropdown-separator";

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "reader-dropdown-item reader-dropdown-item-danger";
    deleteBtn.innerHTML = `${TRASH_ICON} Delete`;
    deleteBtn.addEventListener("click", () => {
      dropdownMenu.classList.remove("visible");
      void this.handleDeleteClip();
    });

    dropdownMenu.append(
      tidyBtn,
      editBtn,
      resetBtn,
      separator,
      viewClipBtn,
      copyBtn,
      copyHighlightsBtn,
      shareBtn,
      readAloudBtn,
      secondSeparator,
      deleteBtn,
    );

    dropdown.append(dropdownBtn, dropdownMenu);

    wrapper.addEventListener("click", (e) => {
      if (e.target instanceof Node && !dropdown.contains(e.target)) {
        dropdownMenu.classList.remove("visible");
      }
    });

    const closeBtn = createToolbarButton("×", "Exit (Esc)", () => {
      void this.onRequestExit?.();
    });

    toolbar.append(dropdown, closeBtn);

    const container = document.createElement("div");
    container.className = "reader-mode-container";

    const header = document.createElement("div");
    header.className = "reader-mode-header";

    const titleElement = document.createElement("h1");
    titleElement.className = "reader-mode-title";
    titleElement.textContent = options.title;

    const clipStatus = document.createElement("a");
    clipStatus.className = "clip-status";
    clipStatus.innerHTML = '<span class="clip-status-dot"></span> Saved locally';
    clipStatus.title = "Open in clip viewer";
    clipStatus.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.openInClipViewer();
    });

    header.append(titleElement, clipStatus);

    const contentWrapper = document.createElement("div");
    contentWrapper.className = "reader-mode-content";
    contentWrapper.appendChild(options.content);
    this.contentWrapper = contentWrapper;

    const noteEditor = createNoteEditor();
    this.noteEditor = noteEditor;

    const progressBar = document.createElement("div");
    progressBar.className = "reader-progress-bar";
    this.progressBar = progressBar;

    container.append(header, contentWrapper);
    wrapper.append(toolbar, container, noteEditor, progressBar);
    this.shadow.appendChild(wrapper);

    this.setupHighlightListeners();
  }

  connect(): void {
    if (this.abortController) return;
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    isolateKeyboardEvents(this.shadow, signal);

    document.addEventListener(
      "keydown",
      (event) => {
        this.handleKeydown(event);
      },
      { signal },
    );

    this.shadow.addEventListener(
      "mouseup",
      (event) => {
        void this.handleSelectionMouseup(event);
      },
      { signal },
    );

    const updateProgress = (): void => {
      this.updateProgressBar();
    };

    this.host.addEventListener("scroll", updateProgress, { passive: true, signal });
    window.addEventListener("resize", updateProgress, { passive: true, signal });
    requestAnimationFrame(updateProgress);

    this.setupHighlightSyncListener();
  }

  disconnect(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.removeHighlightSyncListener();
  }

  setClipData(clipId: string | null, highlights: Highlight[]): void {
    this.currentClipId = clipId;
    this.currentHighlights = [...highlights];
    this.updateCopyHighlightsButtonState();
  }

  restoreHighlightsIfNeeded(): void {
    const existingMarks = this.contentWrapper?.querySelectorAll(".reader-highlight");
    if (!existingMarks || existingMarks.length === 0) {
      this.restoreHighlights();
    }
  }

  restoreHighlights(): void {
    if (!this.contentWrapper || this.currentHighlights.length === 0) return;

    const sortedHighlights = [...this.currentHighlights].sort(
      (a, b) => b.startOffset - a.startOffset,
    );

    for (const highlight of sortedHighlights) {
      try {
        wrapHighlightByOffset(this.contentWrapper, highlight);
      } catch (error) {
        console.error("[Reader Mode] Error restoring highlight:", error);
      }
    }
  }

  async autoClipPage(title: string, content: Element): Promise<void> {
    try {
      const checkResponse = await chrome.runtime.sendMessage({
        action: "checkExistingClip",
        url: window.location.href,
      });

      if (checkResponse?.clip) {
        this.setClipData(checkResponse.clip.id, checkResponse.clip.highlights || []);
        this.restoreHighlights();
        return;
      }

      const saveResponse = await chrome.runtime.sendMessage({
        action: "savePageToDatabase",
        url: window.location.href,
        title,
        domContent: content.outerHTML,
        textContent: content.textContent || "",
        metadata: {
          clippedFrom: "reader-mode",
          clippedAt: new Date().toISOString(),
        },
      });

      if (saveResponse?.success && saveResponse?.clipId) {
        this.setClipData(saveResponse.clipId, []);
      } else {
        console.warn("[Reader Mode] Failed to save clip:", saveResponse?.error);
      }
    } catch (error) {
      console.error("[Reader Mode] Auto-clip failed:", error);
    }
  }

  private setupHighlightSyncListener(): void {
    if (this.storageChangeListener || !chrome.storage?.local?.onChanged) return;

    this.storageChangeListener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (!this.currentClipId || !changes[LOCAL_CLIPS_STORAGE_KEY]) return;

      const { newValue } = changes[LOCAL_CLIPS_STORAGE_KEY];
      if (!Array.isArray(newValue)) return;

      const updatedClip = newValue.find((c: { id: string }) => c.id === this.currentClipId);
      if (!updatedClip) return;

      const newHighlights: Highlight[] = updatedClip.highlights || [];
      const currentIds = new Set(this.currentHighlights.map((h) => h.id));
      const newIds = new Set(newHighlights.map((h) => h.id));

      const addedHighlights = newHighlights.filter((h) => !currentIds.has(h.id));
      const removedIds = [...currentIds].filter((id) => !newIds.has(id));

      if (addedHighlights.length === 0 && removedIds.length === 0) {
        const noteChanges = newHighlights.filter((newHl) => {
          const existing = this.currentHighlights.find((h) => h.id === newHl.id);
          return existing && existing.note !== newHl.note;
        });

        for (const updated of noteChanges) {
          const existing = this.currentHighlights.find((h) => h.id === updated.id);
          if (existing) {
            existing.note = updated.note;
            const markElement = this.shadow.querySelector(`[data-highlight-id="${updated.id}"]`);
            if (markElement) {
              markElement.classList.toggle("has-note", Boolean(updated.note));
            }
          }
        }
        return;
      }

      for (const id of removedIds) {
        const markElement = this.shadow.querySelector(`[data-highlight-id="${id}"]`);
        if (markElement) {
          const parent = markElement.parentNode;
          while (markElement.firstChild) {
            parent?.insertBefore(markElement.firstChild, markElement);
          }
          markElement.remove();
        }
      }

      for (const highlight of addedHighlights) {
        if (this.contentWrapper) {
          wrapHighlightByOffset(this.contentWrapper, highlight);
        }
      }

      this.currentHighlights = newHighlights;
      this.updateCopyHighlightsButtonState();
    };

    chrome.storage.local.onChanged.addListener(this.storageChangeListener);
  }

  private removeHighlightSyncListener(): void {
    if (this.storageChangeListener) {
      chrome.storage?.local?.onChanged?.removeListener(this.storageChangeListener);
      this.storageChangeListener = null;
    }
  }

  private openInClipViewer(): void {
    if (this.currentClipId) {
      void chrome.runtime.sendMessage({
        action: "openClipViewer",
        clipId: this.currentClipId,
      });
    }
  }

  private updateCopyHighlightsButtonState(): void {
    if (!this.copyHighlightsButton) return;
    this.copyHighlightsButton.disabled = this.currentHighlights.length === 0;
  }

  private updateProgressBar(): void {
    if (!this.progressBar) return;

    const scrollTop = this.host.scrollTop || 0;
    const scrollHeight = this.host.scrollHeight || 0;
    const clientHeight = this.host.clientHeight || 0;
    const scrollableHeight = scrollHeight - clientHeight;

    if (scrollableHeight <= 0) {
      this.progressBar.style.setProperty("--cc-reader-scroll-progress", "0%");
      return;
    }

    const progress = Math.min(100, (scrollTop / scrollableHeight) * 100);
    this.progressBar.style.setProperty("--cc-reader-scroll-progress", `${progress}%`);
  }

  private getSelection(): Selection | null {
    if (hasShadowSelection(this.shadow)) {
      const shadowSelection = this.shadow.getSelection();
      if (shadowSelection && !shadowSelection.isCollapsed) {
        return shadowSelection;
      }
    }
    return window.getSelection();
  }

  private async handleSelectionMouseup(event: Event): Promise<void> {
    if (this.editModeActive || this.tidyModeActive) {
      return;
    }

    if (!(event instanceof MouseEvent) || event.shiftKey) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));

    const selection = this.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      return;
    }

    const anchorNode = selection.anchorNode;
    if (!anchorNode || !this.contentWrapper?.contains(anchorNode)) {
      return;
    }

    await this.createHighlightFromSelection(selection);
  }

  private async createHighlightFromSelection(selection: Selection): Promise<void> {
    if (this.editModeActive || this.tidyModeActive) return;

    const text = selection.toString().trim();
    if (!text || !this.currentClipId || !this.contentWrapper) return;

    try {
      const range = selection.getRangeAt(0);
      const startOffset = getTextOffset(
        this.contentWrapper,
        range.startContainer,
        range.startOffset,
      );
      const endOffset = getTextOffset(this.contentWrapper, range.endContainer, range.endOffset);

      const response = await chrome.runtime.sendMessage({
        action: "addHighlight",
        clipId: this.currentClipId,
        highlight: {
          text,
          startOffset,
          endOffset,
          color: "#fff3cd",
        },
      });

      if (response?.success && response?.highlight) {
        this.currentHighlights.push(response.highlight);
        this.updateCopyHighlightsButtonState();
        applyHighlightToDOM(selection, response.highlight.id);
        selection.removeAllRanges();
      }
    } catch (error) {
      console.error("[Reader Mode] Failed to create highlight:", error);
    }
  }

  private setupHighlightListeners(): void {
    if (!this.contentWrapper || !this.noteEditor) return;

    this.contentWrapper.addEventListener("click", (e) => {
      if (!(e.target instanceof Element)) return;
      const markCandidate = e.target.closest(".reader-highlight");
      const markElement = markCandidate instanceof HTMLElement ? markCandidate : null;

      if (!markElement) {
        if (this.activeHighlightId) {
          void this.saveCurrentNote();
        }
        return;
      }

      const highlightId = markElement.dataset.highlightId;
      if (!highlightId) return;

      if (this.activeHighlightId && this.activeHighlightId !== highlightId) {
        void this.saveCurrentNote();
      }

      const highlightData = this.currentHighlights.find((h) => h.id === highlightId);
      this.showNoteEditor(markElement, highlightId, highlightData?.note || "");
    });

    const copyBtn = this.noteEditor.querySelector(".note-copy");
    const saveBtn = this.noteEditor.querySelector(".note-save");
    const deleteBtn = this.noteEditor.querySelector(".note-delete");

    copyBtn?.addEventListener("click", () => {
      void this.copyCurrentHighlight();
    });
    saveBtn?.addEventListener("click", () => {
      void this.saveCurrentNote();
    });
    deleteBtn?.addEventListener("click", () => {
      void this.deleteCurrentHighlight();
    });
  }

  private showNoteEditor(
    markElement: HTMLElement,
    highlightId: string,
    existingNote: string,
  ): void {
    if (!this.noteEditor) return;

    this.activeHighlightId = highlightId;

    this.shadow
      .querySelectorAll(".reader-highlight.active")
      .forEach((el) => el.classList.remove("active"));
    markElement.classList.add("active");

    if (!supportsAnchorPositioning()) {
      const rect = markElement.getBoundingClientRect();
      const containerRect = this.shadow
        .querySelector(".reader-mode-container")
        ?.getBoundingClientRect();

      if (containerRect) {
        const leftPos = containerRect.right + 24;
        this.noteEditor.style.left = `${leftPos}px`;
        this.noteEditor.style.top = `${rect.top}px`;
      }
    }

    const textarea = this.noteEditor.querySelector(".note-textarea");
    if (textarea instanceof HTMLTextAreaElement) {
      textarea.value = existingNote;
      textarea.focus();
    }

    this.noteEditor.classList.add("visible");
  }

  private hideNoteEditor(): void {
    if (!this.noteEditor) return;

    this.noteEditor.classList.remove("visible");
    this.activeHighlightId = null;

    this.shadow
      .querySelectorAll(".reader-highlight.active")
      .forEach((el) => el.classList.remove("active"));
  }

  private async saveCurrentNote(): Promise<void> {
    if (!this.noteEditor || !this.activeHighlightId || !this.currentClipId) return;

    const textarea = this.noteEditor.querySelector(".note-textarea");
    const note = textarea instanceof HTMLTextAreaElement ? textarea.value : "";
    const highlightId = this.activeHighlightId;

    try {
      await chrome.runtime.sendMessage({
        action: "updateHighlightNote",
        clipId: this.currentClipId,
        highlightId,
        note,
      });

      const hl = this.currentHighlights.find((h) => h.id === highlightId);
      if (hl) hl.note = note;

      const markElement = this.shadow.querySelector(`[data-highlight-id="${highlightId}"]`);
      if (markElement) {
        markElement.classList.toggle("has-note", Boolean(note));
      }

      this.hideNoteEditor();
    } catch (error) {
      console.error("[Reader Mode] Failed to save note:", error);
    }
  }

  private async deleteCurrentHighlight(): Promise<void> {
    if (!this.activeHighlightId || !this.currentClipId) return;
    const highlightId = this.activeHighlightId;

    try {
      await chrome.runtime.sendMessage({
        action: "deleteHighlight",
        clipId: this.currentClipId,
        highlightId,
      });

      this.currentHighlights = this.currentHighlights.filter((h) => h.id !== highlightId);
      this.updateCopyHighlightsButtonState();

      const markElement = this.shadow.querySelector(`[data-highlight-id="${highlightId}"]`);
      if (markElement) {
        const parent = markElement.parentNode;
        while (markElement.firstChild) {
          parent?.insertBefore(markElement.firstChild, markElement);
        }
        markElement.remove();
      }

      this.hideNoteEditor();
    } catch (error) {
      console.error("[Reader Mode] Failed to delete highlight:", error);
    }
  }

  private async copyCurrentHighlight(): Promise<void> {
    if (!this.activeHighlightId) return;

    const highlightData = this.currentHighlights.find((h) => h.id === this.activeHighlightId);
    if (!highlightData) return;

    const titleElement = this.shadow.querySelector(".reader-mode-title");
    const title = titleElement?.textContent || document.title;
    const url = window.location.href;

    const lines: string[] = [`[${title}](${url})`, "", `> ${highlightData.text}`, ""];

    if (highlightData.note && highlightData.note.trim()) {
      lines.push(highlightData.note.trim(), "");
    }

    const success = await copyToClipboard(lines.join("\n").trim());
    showToast(success ? "Highlight copied" : "Failed to copy");
  }

  private async copyAllHighlights(): Promise<void> {
    if (!this.currentHighlights.length) {
      showToast("No highlights to copy");
      return;
    }

    const titleElement = this.shadow.querySelector(".reader-mode-title");
    const title = titleElement?.textContent || document.title;
    const url = window.location.href;

    const lines: string[] = [`[${title}](${url})`, ""];
    const sortedHighlights = [...this.currentHighlights].sort(
      (a, b) => a.startOffset - b.startOffset,
    );

    for (const highlight of sortedHighlights) {
      const text = highlight.text?.trim();
      if (!text) continue;

      lines.push(`> ${text}`, "");
      if (highlight.note && highlight.note.trim()) {
        lines.push(highlight.note.trim(), "");
      }
    }

    const markdown = lines.join("\n").trim();
    if (!markdown) {
      showToast("No highlights to copy");
      return;
    }

    const success = await copyToClipboard(markdown);
    showToast(success ? "Highlights copied" : "Failed to copy");
  }

  private enterEditMode(): void {
    if (!this.contentWrapper || !this.wrapper || !this.toolbar || this.editModeActive) return;

    this.originalContent = this.contentWrapper.innerHTML;
    this.editModeActive = true;

    this.contentWrapper.contentEditable = "true";
    this.wrapper.classList.add("edit-mode");

    const editToolbar = document.createElement("div");
    editToolbar.className = "edit-toolbar";
    this.editToolbarContainer = editToolbar;

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "reader-mode-btn edit-save-btn";
    saveBtn.innerHTML = SAVE_ICON;
    saveBtn.title = "Save changes";
    saveBtn.setAttribute("aria-label", "Save changes");
    saveBtn.addEventListener("click", () => {
      void this.exitEditMode();
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "reader-mode-btn edit-cancel-btn";
    cancelBtn.innerHTML = CANCEL_ICON;
    cancelBtn.title = "Cancel editing";
    cancelBtn.setAttribute("aria-label", "Cancel editing");
    cancelBtn.addEventListener("click", () => {
      this.cancelEditMode();
    });

    editToolbar.append(saveBtn, cancelBtn);
    this.toolbar.insertBefore(editToolbar, this.toolbar.lastElementChild);
  }

  private async exitEditMode(): Promise<void> {
    if (!this.contentWrapper || !this.wrapper || !this.editModeActive) return;

    const newContent = this.contentWrapper.innerHTML;

    if (this.currentClipId) {
      try {
        await chrome.runtime.sendMessage({
          action: "updateClipContent",
          clipId: this.currentClipId,
          domContent: newContent,
          textContent: this.contentWrapper.textContent || "",
        });
        showToast("Content saved");
      } catch (err) {
        console.error("Failed to save content:", err);
        showToast("Failed to save content");
      }
    }

    this.contentWrapper.contentEditable = "false";
    this.wrapper.classList.remove("edit-mode");
    this.editModeActive = false;

    this.editToolbarContainer?.remove();
    this.editToolbarContainer = null;
  }

  private cancelEditMode(): void {
    if (!this.contentWrapper || !this.wrapper || !this.editModeActive) return;

    this.contentWrapper.innerHTML = this.originalContent;
    this.contentWrapper.contentEditable = "false";
    this.wrapper.classList.remove("edit-mode");
    this.editModeActive = false;

    this.editToolbarContainer?.remove();
    this.editToolbarContainer = null;
  }

  private async handleChunkTidy(chunkId: string): Promise<void> {
    if (!this.contentWrapper) return;

    const chunkEl = this.shadow.querySelector(`[data-tidy-chunk="${chunkId}"]`);
    if (!chunkEl) {
      console.warn(`[Tidy Content] Chunk not found: ${chunkId}`);
      return;
    }

    const contentEl = chunkEl.querySelector(".tidy-chunk-content");
    if (!contentEl) {
      console.warn(`[Tidy Content] Chunk content not found: ${chunkId}`);
      return;
    }

    const chunkHtml = contentEl.innerHTML;
    setChunkLoading(this.shadow, chunkId);

    try {
      const response = await chrome.runtime.sendMessage({
        action: "tidyContent",
        domContent: chunkHtml,
      });

      if (response?.success && response?.data) {
        setChunkComplete(this.shadow, chunkId, response.data);
      } else {
        setChunkComplete(this.shadow, chunkId, chunkHtml);
        showToast("Tidy failed for this section");
        console.error(`[Tidy Content] Failed to tidy chunk ${chunkId}:`, response?.error);
      }
    } catch (err) {
      console.error(`[Tidy Content] Error tidying chunk ${chunkId}:`, err);
      setChunkComplete(this.shadow, chunkId, chunkHtml);
      showToast("Tidy failed for this section");
    }
  }

  private async enterTidyMode(): Promise<void> {
    if (!this.contentWrapper || !this.wrapper || this.tidyModeActive) return;

    try {
      const originalHtml = this.contentWrapper.innerHTML;
      const chunks = getHtmlChunks(originalHtml);

      if (chunks.length === 0) {
        console.warn("[Tidy Content] No chunks generated from content");
        showToast("Content too short to chunk");
        return;
      }

      const tidyChunks = chunks.map((c) => ({ id: c.id, content: c.html }));
      wrapContentInChunks(this.contentWrapper, tidyChunks, (chunkId) => {
        void this.handleChunkTidy(chunkId);
      });

      this.tidyModeActive = true;
      if (this.tidyButton) {
        this.tidyButton.innerHTML = `${TIDY_ICON} Done Tidying`;
      }
      this.wrapper.classList.add("tidy-mode");
    } catch (err) {
      console.error("[Tidy Content] Failed to enter tidy mode:", err);
      showToast("Failed to enter tidy mode");
    }
  }

  private async exitTidyMode(): Promise<void> {
    if (!this.contentWrapper || !this.wrapper || !this.tidyModeActive) return;

    try {
      const finalHtml = getCleanedContent(this.contentWrapper);
      removeChunkUI(this.contentWrapper);

      if (this.currentClipId) {
        await chrome.runtime.sendMessage({
          action: "updateLocalClip",
          clipId: this.currentClipId,
          updates: { dom_content: finalHtml },
        });
      }

      this.tidyModeActive = false;
      if (this.tidyButton) {
        this.tidyButton.innerHTML = `${TIDY_ICON} Tidy Content`;
      }
      this.wrapper.classList.remove("tidy-mode");

      showToast("Content saved");
    } catch (err) {
      console.error("[Tidy Content] Failed to exit tidy mode:", err);
      showToast("Failed to save content");
    }
  }

  private async handleShareClip(shareBtn: HTMLButtonElement): Promise<void> {
    if (!this.currentClipId) {
      showToast("No clip to share");
      return;
    }

    const originalContent = shareBtn.innerHTML;
    shareBtn.innerHTML = `${SHARE_ICON} Sharing...`;
    shareBtn.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({
        action: "syncSingleClip",
        clipId: this.currentClipId,
        generateShare: true,
      });

      if (!response?.success || !response?.data?.share_id) {
        throw new Error(response?.error || "Failed to sync clip");
      }

      const shareId = response.data.share_id;
      const storedShareSettings = await chrome.storage.sync.get({
        shareServerHostname: "localhost:5173",
      });
      const storedShareHostname = parseJSONObject(
        JSON.stringify({ value: storedShareSettings.shareServerHostname }),
      );
      const shareServerHostname = readStoredString(storedShareHostname?.value) || "localhost:5173";

      const host = shareServerHostname.startsWith("http")
        ? shareServerHostname
        : `https://${shareServerHostname}`;
      const shareUrl = `${host}/share/${shareId}`;

      await navigator.clipboard.writeText(shareUrl);
      showToast("Share link copied");
    } catch (error) {
      console.error("[Reader Mode] Share failed:", error);
      showToast(error instanceof Error ? error.message : "Failed to share");
    } finally {
      shareBtn.innerHTML = originalContent;
      shareBtn.disabled = false;
    }
  }

  private async handleDeleteClip(): Promise<void> {
    if (!this.currentClipId) {
      showToast("No clip to delete");
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: "deleteClipWithSync",
        clipId: this.currentClipId,
      });
      if (response?.success) {
        showToast("Clip deleted");
        await this.onRequestExit?.();
      } else {
        showToast("Failed to delete clip");
      }
    } catch (err) {
      console.error("[Reader Mode] Failed to delete clip:", err);
      showToast("Failed to delete clip");
    }
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;

    // If the command palette is open on top of reader mode, let the palette handle Escape.
    if (isCommandPaletteOpen()) return;

    if (this.noteEditor?.classList.contains("visible")) {
      event.preventDefault();
      event.stopPropagation();
      void this.saveCurrentNote();
      return;
    }

    if (this.dropdownMenu?.classList.contains("visible")) {
      event.preventDefault();
      event.stopPropagation();
      this.dropdownMenu.classList.remove("visible");
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    void this.onRequestExit?.();
  }
}

export class CoolCopyReaderModeElement extends HTMLElement {
  static readonly tagName = READER_MODE_TAG;
  private readonly controller: ReaderModeController;

  constructor() {
    super();
    this.controller = new ReaderModeController(this);
    readerControllers.set(this, this.controller);
  }

  connectedCallback(): void {
    this.controller.connect();
  }

  disconnectedCallback(): void {
    this.controller.disconnect();
  }
}

function createReaderModeHost() {
  const nativeCustomElement = defineCustomElement(READER_MODE_TAG, CoolCopyReaderModeElement);
  const host = document.createElement(READER_MODE_TAG);

  let controller = readerControllers.get(host);
  if (!controller) {
    controller = new ReaderModeController(host);
    readerControllers.set(host, controller);
  }

  return { host, controller, nativeCustomElement };
}

async function stopTTS(): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ action: "stopTTS" });
  } catch (error) {
    console.error("[Reader Mode] Failed to stop TTS:", error);
  }
}

/**
 * Activate reader mode web component
 */
export async function activateReaderMode(): Promise<void> {
  if (readerModeActive || readerModeActivating) {
    return;
  }

  readerModeActivating = true;

  try {
    const existingClip = isXPage() ? null : await checkForExistingClip();

    let title: string;
    let content: Element;
    let initialClipId: string | null = null;
    let initialHighlights: Highlight[] = [];

    if (existingClip) {
      title = existingClip.title;
      content = document.createElement("div");
      content.innerHTML = existingClip.dom_content;
      initialClipId = existingClip.id;
      initialHighlights = existingClip.highlights || [];
    } else {
      const extracted = await extractArticleContent();
      title = extracted.title;
      content = extracted.content;
    }

    const settings = await loadSettings();
    const { host, controller, nativeCustomElement } = createReaderModeHost();

    controller.render({
      title,
      content,
      settings,
      clipId: initialClipId,
      highlights: initialHighlights,
      onRequestExit: deactivateReaderMode,
    });

    activeHost = host;
    activeController = controller;

    mountOverlayHost(host);
    if (!nativeCustomElement) {
      controller.connect();
    }

    hideOriginalContent();

    if (!existingClip) {
      await controller.autoClipPage(title, content);
    } else {
      controller.restoreHighlightsIfNeeded();
    }

    await rememberReaderModeUrl();
    readerModeActive = true;
  } catch (error) {
    activeController?.disconnect();
    activeHost?.remove();
    activeHost = null;
    activeController = null;
    console.error("[Reader Mode] Error activating reader mode:", error);
  } finally {
    readerModeActivating = false;
  }
}

/**
 * Deactivate reader mode web component and restore original content
 */
export async function deactivateReaderMode(): Promise<void> {
  if (!readerModeActive) {
    return;
  }

  try {
    await stopTTS();
    await forgetReaderModeUrl();

    activeController?.disconnect();
    activeHost?.remove();

    restoreOriginalContent();

    readerModeActive = false;
    activeHost = null;
    activeController = null;
  } catch (error) {
    console.error("[Reader Mode] Error deactivating reader mode:", error);
  }
}

/**
 * Toggle reader mode on/off
 */
export function toggleReaderMode(): void {
  if (readerModeActive) {
    void deactivateReaderMode();
  } else {
    void activateReaderMode();
  }
}

/**
 * Check if reader mode is currently active
 */
export function isReaderModeActive(): boolean {
  return readerModeActive;
}

/**
 * Internal helper for test suites to inspect the closed shadow root without
 * exposing it on the DOM host element.
 */
export function getReaderModeShadowRoot(host: HTMLElement): ShadowRoot | undefined {
  return readerShadows.get(host);
}
