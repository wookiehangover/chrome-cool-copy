/**
 * Reader Mode Web Component Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resetChromeMocks, mockRuntime, mockStorage } from "../../test/setup.js";
import {
  READER_MODE_TAG,
  CoolCopyReaderModeElement,
  activateReaderMode,
  deactivateReaderMode,
  isReaderModeActive,
  getReaderModeShadowRoot,
} from "./reader-mode.js";
import {
  openCommandPalette,
  closeCommandPalette,
  isCommandPaletteOpen,
  registerCommands,
  COMMAND_PALETTE_TAG,
  getCommandPaletteShadowRoot,
} from "../command-palette.js";

function getReaderHost(): HTMLElement {
  const host = document.querySelector(READER_MODE_TAG);
  if (!(host instanceof HTMLElement)) {
    throw new Error("Reader mode host element not found");
  }
  return host;
}

function getReaderShadow(): ShadowRoot {
  const shadow = getReaderModeShadowRoot(getReaderHost());
  if (!shadow) {
    throw new Error("Reader mode shadow root not found");
  }
  return shadow;
}

describe("Reader Mode Web Component", () => {
  const originalCustomElementsDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "customElements",
  );

  beforeEach(() => {
    resetChromeMocks();
    document.body.innerHTML = `
      <main>
        <h1>Sample Article Title</h1>
        <p>First paragraph of article content for testing reader mode isolation.</p>
        <p>Second paragraph with additional text.</p>
      </main>
    `;
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "scroll";

    mockStorage.sync.get.mockResolvedValue({
      readerSettings: { fontFamily: "serif", fontSize: 18 },
    });
    mockStorage.local.get.mockImplementation((_keys, callback) => {
      if (callback) {
        callback({});
        return;
      }
      return Promise.resolve({});
    });
    mockStorage.local.set.mockImplementation((_data, callback) => {
      if (callback) {
        callback();
        return;
      }
      return Promise.resolve();
    });

    mockRuntime.sendMessage.mockImplementation(async (message: { action?: string }) => {
      if (message.action === "checkExistingClip") {
        return { clip: null };
      }
      if (message.action === "savePageToDatabase") {
        return { success: true, clipId: "clip-123" };
      }
      return { success: true };
    });

    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.open = true;
      }),
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.open = false;
      }),
    });
  });

  afterEach(async () => {
    closeCommandPalette();
    await deactivateReaderMode();
    document.querySelectorAll(READER_MODE_TAG).forEach((el) => el.remove());
    document.querySelectorAll(COMMAND_PALETTE_TAG).forEach((el) => el.remove());
    if (originalCustomElementsDescriptor) {
      Object.defineProperty(globalThis, "customElements", originalCustomElementsDescriptor);
    }
    vi.restoreAllMocks();
  });

  it("mounts a custom element outside document.body with a closed shadow root and restores overflow on exit", async () => {
    await activateReaderMode();

    expect(isReaderModeActive()).toBe(true);
    const host = getReaderHost();
    expect(host).toBeInstanceOf(CoolCopyReaderModeElement);
    expect(host.parentElement).toBe(document.documentElement);
    expect(host.shadowRoot).toBeNull();
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");

    const shadow = getReaderShadow();
    expect(shadow.querySelector(".reader-mode-title")?.textContent).toBe("Sample Article Title");
    expect(shadow.querySelector(".reader-mode-wrapper")?.classList.contains("font-serif")).toBe(
      true,
    );

    await deactivateReaderMode();

    expect(isReaderModeActive()).toBe(false);
    expect(document.querySelector(READER_MODE_TAG)).toBeNull();
    expect(document.documentElement.style.overflow).toBe("auto");
    expect(document.body.style.overflow).toBe("scroll");
  });

  it("isolates keyboard events inside the reader shadow root from host page listeners", async () => {
    const hostKeydown = vi.fn();
    window.addEventListener("keydown", hostKeydown);

    try {
      await activateReaderMode();
      const shadow = getReaderShadow();
      const textarea = shadow.querySelector(".note-textarea");
      if (!(textarea instanceof HTMLTextAreaElement)) {
        throw new Error("Note textarea not found");
      }

      textarea.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", bubbles: true, composed: true }),
      );

      expect(hostKeydown).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("keydown", hostKeydown);
    }
  });

  it("keeps reader mode open when Escape dismisses an overlapping command palette", async () => {
    registerCommands([{ id: "copy-url", name: "Copy URL", action: vi.fn() }]);

    await activateReaderMode();
    await openCommandPalette();

    expect(isReaderModeActive()).toBe(true);
    expect(isCommandPaletteOpen()).toBe(true);

    const paletteHost = document.querySelector(COMMAND_PALETTE_TAG);
    if (!(paletteHost instanceof HTMLElement)) throw new Error("Palette host missing");
    const paletteShadow = getCommandPaletteShadowRoot(paletteHost);
    const searchInput = paletteShadow?.querySelector(".command-palette-search");
    if (!(searchInput instanceof HTMLInputElement)) throw new Error("Search input missing");

    searchInput.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }),
    );

    expect(isCommandPaletteOpen()).toBe(false);
    expect(isReaderModeActive()).toBe(true);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(isReaderModeActive()).toBe(false);
  });

  it("restores saved highlights, supports note editing, and handles edit mode cancel/save", async () => {
    mockRuntime.sendMessage.mockImplementation(async (message: { action?: string }) => {
      if (message.action === "checkExistingClip") {
        return {
          clip: {
            id: "clip-existing",
            title: "Saved Article",
            dom_content: "<p>Highlight this phrase inside reader mode.</p>",
            highlights: [
              {
                id: "hl-1",
                text: "this phrase",
                startOffset: 10,
                endOffset: 21,
                color: "#fff3cd",
                note: "Existing note",
              },
            ],
          },
        };
      }
      return { success: true };
    });

    await activateReaderMode();
    const shadow = getReaderShadow();

    const mark = shadow.querySelector('[data-highlight-id="hl-1"]');
    expect(mark).not.toBeNull();
    expect(mark?.classList.contains("has-note")).toBe(true);

    mark?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const noteEditor = shadow.querySelector(".note-editor");
    expect(noteEditor?.classList.contains("visible")).toBe(true);

    const textarea = shadow.querySelector(".note-textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error("Textarea missing");
    expect(textarea.value).toBe("Existing note");

    textarea.value = "Updated note";
    const saveNoteBtn = shadow.querySelector(".note-save");
    saveNoteBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(mockRuntime.sendMessage).toHaveBeenCalledWith({
      action: "updateHighlightNote",
      clipId: "clip-existing",
      highlightId: "hl-1",
      note: "Updated note",
    });

    // Enter edit mode and cancel to confirm original content is preserved
    const editBtn = Array.from(shadow.querySelectorAll(".reader-dropdown-item")).find((el) =>
      el.textContent?.includes("Edit Content"),
    );
    editBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const content = shadow.querySelector(".reader-mode-content");
    if (!(content instanceof HTMLElement)) throw new Error("Content wrapper missing");
    expect(content.contentEditable).toBe("true");
    content.innerHTML = "<p>Unsaved draft</p>";

    const cancelBtn = shadow.querySelector(".edit-cancel-btn");
    cancelBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(content.contentEditable).toBe("false");
    expect(content.textContent).toContain("Highlight this phrase inside reader mode.");
  });

  it("works when window.customElements is null (Chrome MV3 isolated world)", async () => {
    Object.defineProperty(globalThis, "customElements", {
      configurable: true,
      value: null,
    });

    await activateReaderMode();

    const host = getReaderHost();
    expect(host.tagName.toLowerCase()).toBe(READER_MODE_TAG);
    expect(host.shadowRoot).toBeNull();
    expect(isReaderModeActive()).toBe(true);

    await deactivateReaderMode();
    expect(isReaderModeActive()).toBe(false);
    expect(document.querySelector(READER_MODE_TAG)).toBeNull();
  });
});
