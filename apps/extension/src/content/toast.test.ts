/**
 * Toast Component Tests
 * Tests for toast display, auto-dismiss behavior, and multiple toast handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { showToast } from "./toast.js";

describe("showToast", () => {
  beforeEach(() => {
    // Clear the document body and reset timers
    document.body.innerHTML = "";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Toast creation and display", () => {
    it("should create a toast element with the correct id and class", () => {
      showToast("Test message");

      const toast = document.getElementById("clean-link-copy-toast");
      expect(toast).not.toBeNull();
      expect(toast?.className).toBe("clean-link-copy-toast");
    });

    it("should display the provided message", () => {
      showToast("Hello, World!");

      const toast = document.getElementById("clean-link-copy-toast");
      expect(toast?.textContent).toBe("Hello, World!");
    });

    it("should append toast to document body", () => {
      showToast("Test message");

      const toast = document.getElementById("clean-link-copy-toast");
      expect(toast?.parentNode).toBe(document.body);
    });

    it("should add 'show' class after fade-in delay", () => {
      showToast("Test message");

      const toast = document.getElementById("clean-link-copy-toast");
      expect(toast?.classList.contains("show")).toBe(false);

      // Advance past the 10ms fade-in delay
      vi.advanceTimersByTime(10);

      expect(toast?.classList.contains("show")).toBe(true);
    });
  });

  describe("Auto-dismiss timing", () => {
    it("should remove 'show' class after 2500ms", () => {
      showToast("Test message");

      const toast = document.getElementById("clean-link-copy-toast");

      // Add show class
      vi.advanceTimersByTime(10);
      expect(toast?.classList.contains("show")).toBe(true);

      // Advance to just before dismiss (2500ms from start)
      vi.advanceTimersByTime(2489);
      expect(toast?.classList.contains("show")).toBe(true);

      // Advance to trigger dismiss
      vi.advanceTimersByTime(1);
      expect(toast?.classList.contains("show")).toBe(false);
    });

    it("should remove toast from DOM after fade-out animation (300ms after dismiss)", () => {
      showToast("Test message");

      // Advance past fade-in and dismiss (2500ms + 10ms)
      vi.advanceTimersByTime(2510);

      const toast = document.getElementById("clean-link-copy-toast");
      expect(toast).not.toBeNull(); // Still in DOM during fade-out

      // Advance through fade-out animation (300ms)
      vi.advanceTimersByTime(300);

      expect(document.getElementById("clean-link-copy-toast")).toBeNull();
    });

    it("should complete full lifecycle: create, show, dismiss, remove", () => {
      showToast("Lifecycle test");

      // Initial state
      let toast = document.getElementById("clean-link-copy-toast");
      expect(toast).not.toBeNull();
      expect(toast?.classList.contains("show")).toBe(false);

      // After fade-in delay
      vi.advanceTimersByTime(10);
      expect(toast?.classList.contains("show")).toBe(true);

      // After dismiss delay (2500ms from start)
      vi.advanceTimersByTime(2490);
      expect(toast?.classList.contains("show")).toBe(false);

      // After fade-out animation (300ms more)
      vi.advanceTimersByTime(300);
      expect(document.getElementById("clean-link-copy-toast")).toBeNull();
    });
  });

  describe("Multiple toast handling", () => {
    it("should remove existing toast before creating new one", () => {
      showToast("First toast");

      const firstToast = document.getElementById("clean-link-copy-toast");
      expect(firstToast?.textContent).toBe("First toast");

      showToast("Second toast");

      const allToasts = document.querySelectorAll("#clean-link-copy-toast");
      expect(allToasts.length).toBe(1);

      const currentToast = document.getElementById("clean-link-copy-toast");
      expect(currentToast?.textContent).toBe("Second toast");
    });

    it("should handle rapid consecutive toasts", () => {
      showToast("Toast 1");
      showToast("Toast 2");
      showToast("Toast 3");

      const allToasts = document.querySelectorAll("#clean-link-copy-toast");
      expect(allToasts.length).toBe(1);

      const currentToast = document.getElementById("clean-link-copy-toast");
      expect(currentToast?.textContent).toBe("Toast 3");
    });
  });

  describe("Error handling", () => {
    it("should handle missing document body gracefully", () => {
      const originalBody = document.body;
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Remove body temporarily
      Object.defineProperty(document, "body", {
        value: null,
        writable: true,
        configurable: true,
      });

      // Should not throw
      expect(() => showToast("Test")).not.toThrow();

      // Restore body
      Object.defineProperty(document, "body", {
        value: originalBody,
        writable: true,
        configurable: true,
      });

      consoleSpy.mockRestore();
    });
  });
});

