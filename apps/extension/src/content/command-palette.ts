/**
 * Command Palette Web Component
 * Provides an isolated Shadow DOM overlay for searching and executing extension commands
 */

import type { Command } from "./commands.js";
import { showToast } from "./toast.js";
import { defineCustomElement, isolateKeyboardEvents, mountOverlayHost } from "./web-component.js";
import styles from "./command-palette.css?raw";

export const COMMAND_PALETTE_TAG = "cool-copy-command-palette";

const COMMAND_USAGE_TIMESTAMPS_KEY = "command_usage_timestamps";

interface CommandUsageTimestamps {
  [commandId: string]: number;
}

let allCommands: Command[] = [];
let activeHost: HTMLElement | null = null;
let activeController: CommandPaletteController | null = null;
let isOpening = false;

const paletteControllers = new WeakMap<HTMLElement, CommandPaletteController>();
const paletteShadows = new WeakMap<HTMLElement, ShadowRoot>();

async function loadCommandUsageTimestamps(): Promise<Record<string, number>> {
  return new Promise((resolve) => {
    chrome.storage.local.get([COMMAND_USAGE_TIMESTAMPS_KEY], (result) => {
      const timestamps: CommandUsageTimestamps = {};
      const stored = result[COMMAND_USAGE_TIMESTAMPS_KEY];
      if (stored && Object(stored) === stored && !Array.isArray(stored)) {
        for (const [commandId, timestamp] of Object.entries(stored)) {
          if (Number.isFinite(timestamp)) timestamps[commandId] = Number(timestamp);
        }
      }
      resolve(timestamps);
    });
  });
}

async function saveCommandUsageTimestamps(timestamps: Record<string, number>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [COMMAND_USAGE_TIMESTAMPS_KEY]: timestamps }, () => {
      resolve();
    });
  });
}

async function recordCommandUsage(commandId: string): Promise<void> {
  const timestamps = await loadCommandUsageTimestamps();
  timestamps[commandId] = Date.now();
  await saveCommandUsageTimestamps(timestamps);
}

function fuzzyMatch(query: string, text: string): boolean {
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  let queryIndex = 0;

  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      queryIndex++;
    }
  }

  return queryIndex === queryLower.length;
}

function buildHighlightedLabel(text: string, query: string): DocumentFragment {
  const fragment = document.createDocumentFragment();

  if (!query.trim()) {
    fragment.appendChild(document.createTextNode(text));
    return fragment;
  }

  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  const matchIndices: number[] = [];
  let queryIndex = 0;

  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      matchIndices.push(i);
      queryIndex++;
    }
  }

  if (matchIndices.length === 0) {
    fragment.appendChild(document.createTextNode(text));
    return fragment;
  }

  const matchSet = new Set(matchIndices);
  let plainBuffer = "";

  const flushPlain = (): void => {
    if (plainBuffer) {
      fragment.appendChild(document.createTextNode(plainBuffer));
      plainBuffer = "";
    }
  };

  for (let i = 0; i < text.length; i++) {
    if (matchSet.has(i)) {
      flushPlain();
      const span = document.createElement("span");
      span.className = "command-palette-match";
      span.textContent = text[i];
      fragment.appendChild(span);
    } else {
      plainBuffer += text[i];
    }
  }

  flushPlain();
  return fragment;
}

async function getVisibleCommands(commands: Command[]): Promise<Command[]> {
  const visibleCommands = commands.filter((cmd) => !cmd.isVisible || cmd.isVisible());
  const timestamps = await loadCommandUsageTimestamps();

  const usedCommands = visibleCommands.filter((cmd) => timestamps[cmd.id] !== undefined);
  const unusedCommands = visibleCommands.filter((cmd) => timestamps[cmd.id] === undefined);

  usedCommands.sort((a, b) => (timestamps[b.id] || 0) - (timestamps[a.id] || 0));

  return [...usedCommands, ...unusedCommands];
}

async function filterCommands(commands: Command[], query: string): Promise<Command[]> {
  const visibleCommands = await getVisibleCommands(commands);

  if (!query.trim()) {
    return visibleCommands;
  }

  const results: Command[] = [];

  const exactMatch = visibleCommands.find((cmd) =>
    cmd.name.toLowerCase().includes(query.toLowerCase()),
  );

  if (exactMatch) {
    results.push(exactMatch);
  }

  const fuzzyMatches = visibleCommands.filter((cmd) => fuzzyMatch(query, cmd.name));

  const descriptionMatches = visibleCommands.filter(
    (cmd) => cmd.description && fuzzyMatch(query, cmd.description),
  );

  return [...new Set([...results, ...fuzzyMatches, ...descriptionMatches])];
}

class CommandPaletteController {
  readonly host: HTMLElement;
  readonly shadow: ShadowRoot;
  private readonly dialog: HTMLDialogElement;
  private readonly searchInput: HTMLInputElement;
  private readonly commandList: HTMLDivElement;

  private abortController: AbortController | null = null;
  private commands: Command[] = [];
  private filteredCommands: Command[] = [];
  private selectedIndex = 0;
  private searchQuery = "";
  private filterRevision = 0;
  private openState = false;
  private previouslyFocused: HTMLElement | null = null;
  private onDismiss: (() => void) | null = null;

  constructor(host: HTMLElement) {
    this.host = host;
    this.shadow = host.attachShadow({ mode: "closed" });
    paletteShadows.set(host, this.shadow);

    const styleEl = document.createElement("style");
    styleEl.textContent = styles;

    this.dialog = document.createElement("dialog");
    this.dialog.className = "command-palette-dialog";
    this.dialog.setAttribute("aria-label", "Command palette");

    this.searchInput = document.createElement("input");
    this.searchInput.type = "text";
    this.searchInput.className = "command-palette-search";
    this.searchInput.placeholder = "Search commands...";
    this.searchInput.autocomplete = "off";
    this.searchInput.spellcheck = false;
    this.searchInput.setAttribute("aria-label", "Search commands");
    this.searchInput.setAttribute("role", "combobox");
    this.searchInput.setAttribute("aria-expanded", "true");
    this.searchInput.setAttribute("aria-autocomplete", "list");
    this.searchInput.setAttribute("aria-controls", "command-palette-list");

    this.commandList = document.createElement("div");
    this.commandList.id = "command-palette-list";
    this.commandList.className = "command-palette-list";
    this.commandList.setAttribute("role", "listbox");

    this.dialog.append(this.searchInput, this.commandList);
    this.shadow.append(styleEl, this.dialog);
  }

  get isOpen(): boolean {
    return this.openState;
  }

  connect(): void {
    if (this.abortController) return;
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    isolateKeyboardEvents(this.shadow, signal);

    this.searchInput.addEventListener(
      "input",
      () => {
        void this.handleSearchInput();
      },
      { signal },
    );

    this.searchInput.addEventListener(
      "keydown",
      (event) => {
        this.handleKeydown(event);
      },
      { signal },
    );

    this.dialog.addEventListener(
      "click",
      (event) => {
        if (event.target === this.dialog) {
          this.dismiss(true);
        }
      },
      { signal },
    );

    this.dialog.addEventListener(
      "cancel",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.dismiss(true);
      },
      { signal },
    );
  }

  disconnect(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.openState = false;
    if (this.dialog.open) {
      this.dialog.close();
    }
  }

  async open(commands: Command[], onDismiss: () => void): Promise<void> {
    this.commands = commands;
    this.onDismiss = onDismiss;
    this.searchQuery = "";
    this.selectedIndex = 0;
    this.searchInput.value = "";
    this.previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const revision = ++this.filterRevision;
    this.filteredCommands = await getVisibleCommands(this.commands);
    if (revision !== this.filterRevision || !this.host.isConnected) {
      return;
    }

    this.renderList();
    this.openState = true;
    this.dialog.showModal();
    this.searchInput.focus();
  }

  close(restoreFocus = false): void {
    const wasOpen = this.openState;
    this.openState = false;
    this.filterRevision += 1;

    if (this.dialog.open) {
      this.dialog.close();
    }

    const focusTarget = this.previouslyFocused;
    this.previouslyFocused = null;

    if (wasOpen && restoreFocus && focusTarget && focusTarget.isConnected) {
      focusTarget.focus();
    }
  }

  private dismiss(restoreFocus: boolean): void {
    this.close(restoreFocus);
    const callback = this.onDismiss;
    this.onDismiss = null;
    callback?.();
  }

  private async handleSearchInput(): Promise<void> {
    const query = this.searchInput.value;
    this.searchQuery = query;
    const revision = ++this.filterRevision;
    const matches = await filterCommands(this.commands, query);

    if (revision !== this.filterRevision || !this.openState) {
      return;
    }

    this.filteredCommands = matches;
    this.selectedIndex = 0;
    this.renderList();
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (this.filteredCommands.length === 0) return;
      this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredCommands.length - 1);
      this.updateSelection();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (this.filteredCommands.length === 0) return;
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      this.updateSelection();
    } else if (event.key === "Enter") {
      event.preventDefault();
      void this.executeSelected();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.dismiss(true);
    }
  }

  private updateSelection(): void {
    const items = this.commandList.querySelectorAll(".command-palette-item");
    items.forEach((item, index) => {
      const isSelected = index === this.selectedIndex;
      item.classList.toggle("selected", isSelected);
      item.setAttribute("aria-selected", String(isSelected));
      if (isSelected && item instanceof HTMLElement) {
        this.searchInput.setAttribute("aria-activedescendant", item.id);
        item.scrollIntoView?.({ block: "nearest" });
      }
    });
  }

  private renderList(): void {
    this.commandList.textContent = "";

    if (this.filteredCommands.length === 0) {
      const empty = document.createElement("div");
      empty.className = "command-palette-empty";
      empty.textContent = "No matching commands";
      this.commandList.appendChild(empty);
      this.searchInput.removeAttribute("aria-activedescendant");
      return;
    }

    const fragment = document.createDocumentFragment();

    this.filteredCommands.forEach((cmd, index) => {
      const isSelected = index === this.selectedIndex;
      const item = document.createElement("div");
      item.id = `command-palette-option-${index}`;
      item.className = isSelected ? "command-palette-item selected" : "command-palette-item";
      item.dataset.index = String(index);
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(isSelected));

      const nameEl = document.createElement("div");
      nameEl.className = "command-palette-item-name";
      nameEl.appendChild(buildHighlightedLabel(cmd.name, this.searchQuery));

      const shortcutEl = document.createElement("div");
      shortcutEl.className = "command-palette-item-shortcut";
      shortcutEl.textContent = cmd.shortcut || "";

      item.append(nameEl, shortcutEl);

      item.addEventListener("click", () => {
        this.selectedIndex = index;
        void this.executeSelected();
      });

      item.addEventListener("mouseenter", () => {
        if (this.selectedIndex !== index) {
          this.selectedIndex = index;
          this.updateSelection();
        }
      });

      fragment.appendChild(item);
    });

    this.commandList.appendChild(fragment);
    this.searchInput.setAttribute(
      "aria-activedescendant",
      `command-palette-option-${this.selectedIndex}`,
    );
  }

  private async executeSelected(): Promise<void> {
    if (this.selectedIndex < 0 || this.selectedIndex >= this.filteredCommands.length) {
      return;
    }

    const command = this.filteredCommands[this.selectedIndex];
    this.dismiss(false);

    try {
      await recordCommandUsage(command.id);
      await command.action();
    } catch (error) {
      console.error("[Command Palette] Error executing command:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      showToast(`× Error: ${errorMessage}`);
    }
  }
}

export class CoolCopyCommandPaletteElement extends HTMLElement {
  static readonly tagName = COMMAND_PALETTE_TAG;
  private readonly controller: CommandPaletteController;

  constructor() {
    super();
    this.controller = new CommandPaletteController(this);
    paletteControllers.set(this, this.controller);
  }

  connectedCallback(): void {
    this.controller.connect();
  }

  disconnectedCallback(): void {
    this.controller.disconnect();
  }

  get isOpen(): boolean {
    return this.controller.isOpen;
  }

  close(): void {
    this.controller.close(true);
  }
}

function createCommandPaletteHost() {
  const nativeCustomElement = defineCustomElement(
    COMMAND_PALETTE_TAG,
    CoolCopyCommandPaletteElement,
  );
  const host = document.createElement(COMMAND_PALETTE_TAG);

  let controller = paletteControllers.get(host);
  if (!controller) {
    controller = new CommandPaletteController(host);
    paletteControllers.set(host, controller);
  }

  return { host, controller, nativeCustomElement };
}

function cleanupActivePalette(restoreFocus = false): void {
  const host = activeHost;
  const controller = activeController;
  activeHost = null;
  activeController = null;
  isOpening = false;

  controller?.close(restoreFocus);
  controller?.disconnect();
  host?.remove();
}

export function isCommandPaletteOpen(): boolean {
  return isOpening || Boolean(activeController?.isOpen);
}

/**
 * Open the command palette web component
 */
export async function openCommandPalette(): Promise<void> {
  if (isCommandPaletteOpen()) return;

  isOpening = true;

  try {
    const { host, controller, nativeCustomElement } = createCommandPaletteHost();
    activeHost = host;
    activeController = controller;

    mountOverlayHost(host);
    if (!nativeCustomElement) {
      controller.connect();
    }

    await controller.open(allCommands, () => {
      if (activeHost === host) {
        cleanupActivePalette(false);
      }
    });
  } catch (error) {
    cleanupActivePalette(false);
    throw error;
  } finally {
    isOpening = false;
  }
}

/**
 * Close the command palette web component
 */
export function closeCommandPalette(): void {
  cleanupActivePalette(true);
}

/**
 * Register commands for the palette
 */
export function registerCommands(commands: Command[]): void {
  allCommands = commands;
}

/**
 * Internal helper for test suites to inspect the closed shadow root without
 * exposing it on the DOM host element.
 */
export function getCommandPaletteShadowRoot(host: HTMLElement): ShadowRoot | undefined {
  return paletteShadows.get(host);
}
