/**
 * Command Palette Web Component Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { resetChromeMocks, mockStorage } from "../test/setup.js";
import {
  COMMAND_PALETTE_TAG,
  CoolCopyCommandPaletteElement,
  openCommandPalette,
  closeCommandPalette,
  isCommandPaletteOpen,
  registerCommands,
  getCommandPaletteShadowRoot,
} from "./command-palette.js";
import type { Command } from "./commands.js";

function getPaletteHost(): HTMLElement {
  const host = document.querySelector(COMMAND_PALETTE_TAG);
  if (!(host instanceof HTMLElement)) {
    throw new Error("Command palette host element not found");
  }
  return host;
}

function getPaletteShadow(): ShadowRoot {
  const shadow = getCommandPaletteShadowRoot(getPaletteHost());
  if (!shadow) {
    throw new Error("Command palette shadow root not found");
  }
  return shadow;
}

function getSearchInput(): HTMLInputElement {
  const input = getPaletteShadow().querySelector(".command-palette-search");
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Command palette search input not found");
  }
  return input;
}

describe("Command Palette Web Component", () => {
  const originalCustomElementsDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "customElements",
  );

  beforeEach(() => {
    resetChromeMocks();
    document.body.innerHTML = "";
    document.head.innerHTML = "";

    mockStorage.local.get.mockImplementation((_keys, callback) => {
      callback({});
    });

    mockStorage.local.set.mockImplementation((_data, callback) => {
      callback?.();
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

  afterEach(() => {
    closeCommandPalette();
    document.querySelectorAll(COMMAND_PALETTE_TAG).forEach((el) => el.remove());
    if (originalCustomElementsDescriptor) {
      Object.defineProperty(globalThis, "customElements", originalCustomElementsDescriptor);
    }
    vi.restoreAllMocks();
  });

  describe("isolation and lifecycle", () => {
    it("mounts a custom element outside document.body with a closed shadow root and no light-DOM leaks", async () => {
      registerCommands([{ id: "test-1", name: "Test Command", action: vi.fn() }]);

      await openCommandPalette();

      const host = getPaletteHost();
      expect(host).toBeInstanceOf(CoolCopyCommandPaletteElement);
      expect(host.parentElement).toBe(document.documentElement);
      expect(host.shadowRoot).toBeNull();
      expect(document.head.querySelector("style")).toBeNull();
      expect(document.body.querySelector("dialog")).toBeNull();
      expect(isCommandPaletteOpen()).toBe(true);

      const shadow = getPaletteShadow();
      const dialog = shadow.querySelector("dialog");
      expect(dialog).toBeInstanceOf(HTMLDialogElement);
      expect(shadow.querySelector("style")).not.toBeNull();
    });

    it("does not mount duplicate palettes when opened while already open", async () => {
      registerCommands([{ id: "test-1", name: "Test Command", action: vi.fn() }]);

      await openCommandPalette();
      const firstHost = getPaletteHost();

      await openCommandPalette();
      const hosts = document.querySelectorAll(COMMAND_PALETTE_TAG);

      expect(hosts).toHaveLength(1);
      expect(hosts[0]).toBe(firstHost);
    });

    it("removes the host element and restores focus on close", async () => {
      const trigger = document.createElement("button");
      document.body.appendChild(trigger);
      trigger.focus();

      registerCommands([{ id: "test-1", name: "Test Command", action: vi.fn() }]);

      await openCommandPalette();
      closeCommandPalette();

      expect(isCommandPaletteOpen()).toBe(false);
      expect(document.querySelector(COMMAND_PALETTE_TAG)).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });

    it("works when window.customElements is null (Chrome MV3 isolated world)", async () => {
      Object.defineProperty(globalThis, "customElements", {
        configurable: true,
        value: null,
      });

      const actionFn = vi.fn();
      registerCommands([{ id: "isolated-1", name: "Isolated Command", action: actionFn }]);

      await openCommandPalette();

      const host = getPaletteHost();
      expect(host.tagName.toLowerCase()).toBe(COMMAND_PALETTE_TAG);
      expect(host.shadowRoot).toBeNull();

      const searchInput = getSearchInput();
      searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(actionFn).toHaveBeenCalledOnce();
      expect(isCommandPaletteOpen()).toBe(false);
    });
  });

  describe("search, filtering, and XSS safety", () => {
    it("filters commands by substring and fuzzy search, showing empty state on zero matches", async () => {
      const commands: Command[] = [
        { id: "copy-url", name: "Copy URL", action: vi.fn() },
        { id: "copy-markdown", name: "Copy Markdown Link", action: vi.fn() },
        { id: "paste", name: "Paste", action: vi.fn() },
      ];
      registerCommands(commands);

      await openCommandPalette();
      const searchInput = getSearchInput();

      searchInput.value = "copy";
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(getPaletteShadow().querySelectorAll(".command-palette-item")).toHaveLength(2);

      searchInput.value = "cml";
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(getPaletteShadow().querySelectorAll(".command-palette-item")).toHaveLength(1);
      expect(getPaletteShadow().querySelector(".command-palette-item-name")?.textContent).toBe(
        "Copy Markdown Link",
      );

      searchInput.value = "zzzzzz";
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(getPaletteShadow().querySelectorAll(".command-palette-item")).toHaveLength(0);
      expect(getPaletteShadow().querySelector(".command-palette-empty")?.textContent).toBe(
        "No matching commands",
      );
    });

    it("escapes HTML characters when highlighting fuzzy matches", async () => {
      registerCommands([
        {
          id: "xss-boost",
          name: "Run <img src=x onerror=alert(1)>",
          action: vi.fn(),
        },
      ]);

      await openCommandPalette();
      const searchInput = getSearchInput();
      searchInput.value = "img";
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 20));

      const shadow = getPaletteShadow();
      expect(shadow.querySelector("img")).toBeNull();
      expect(shadow.querySelector(".command-palette-item-name")?.textContent).toBe(
        "Run <img src=x onerror=alert(1)>",
      );
    });
  });

  describe("keyboard navigation and event isolation", () => {
    it("navigates with arrow keys and executes on Enter", async () => {
      const secondAction = vi.fn();
      registerCommands([
        { id: "test-1", name: "Command 1", action: vi.fn() },
        { id: "test-2", name: "Command 2", action: secondAction },
      ]);

      await openCommandPalette();
      const searchInput = getSearchInput();

      searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      const items = getPaletteShadow().querySelectorAll(".command-palette-item");
      expect(items[1].classList.contains("selected")).toBe(true);

      searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(secondAction).toHaveBeenCalledOnce();
      expect(isCommandPaletteOpen()).toBe(false);
    });

    it("prevents keyboard events inside the shadow root from leaking to host page shortcuts", async () => {
      const hostKeydown = vi.fn();
      window.addEventListener("keydown", hostKeydown);

      try {
        registerCommands([{ id: "test-1", name: "Reader mode", action: vi.fn() }]);
        await openCommandPalette();

        const searchInput = getSearchInput();
        searchInput.dispatchEvent(
          new KeyboardEvent("keydown", { key: "j", bubbles: true, composed: true }),
        );
        searchInput.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }),
        );

        expect(hostKeydown).not.toHaveBeenCalled();
        expect(isCommandPaletteOpen()).toBe(false);
      } finally {
        window.removeEventListener("keydown", hostKeydown);
      }
    });
  });
});
