/**
 * ErrorBoundary Component Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

// Component that throws an error when rendered
function ThrowingComponent({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error message");
  }
  return <div>No error</div>;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("error catching behavior", () => {
    it("renders children when there is no error", () => {
      render(
        <ErrorBoundary>
          <div>Child content</div>
        </ErrorBoundary>,
      );

      expect(screen.getByText("Child content")).toBeInTheDocument();
    });

    it("catches errors and logs them to console", () => {
      const consoleSpy = vi.spyOn(console, "error");

      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>,
      );

      expect(consoleSpy).toHaveBeenCalledWith("[ErrorBoundary] Caught error:", expect.any(Error));
      expect(consoleSpy).toHaveBeenCalledWith("[ErrorBoundary] Error info:", expect.any(String));
    });
  });

  describe("error display UI", () => {
    it("renders fallback UI when an error occurs", () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>,
      );

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument();
      expect(screen.getByText("Try Again")).toBeInTheDocument();
    });

    it("displays error details in expandable section", () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>,
      );

      expect(screen.getByText("Error details")).toBeInTheDocument();
      expect(screen.getByText("Test error message")).toBeInTheDocument();
    });
  });

  describe("retry functionality", () => {
    it("resets error state when 'Try Again' is clicked", () => {
      let shouldThrow = true;

      function ConditionalThrower() {
        if (shouldThrow) {
          throw new Error("Initial error");
        }
        return <div>Recovery successful</div>;
      }

      const { rerender } = render(
        <ErrorBoundary>
          <ConditionalThrower />
        </ErrorBoundary>,
      );

      // Error UI should be displayed
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();

      // Fix the error condition before retrying
      shouldThrow = false;

      // Click retry button
      fireEvent.click(screen.getByText("Try Again"));

      // Rerender to trigger the retry with fixed state
      rerender(
        <ErrorBoundary>
          <ConditionalThrower />
        </ErrorBoundary>,
      );

      // Should now show the recovered content
      expect(screen.getByText("Recovery successful")).toBeInTheDocument();
    });
  });

  describe("custom fallback support", () => {
    it("uses custom fallback when provided", () => {
      const customFallback = <div>Custom error UI</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowingComponent />
        </ErrorBoundary>,
      );

      expect(screen.getByText("Custom error UI")).toBeInTheDocument();
      expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    });

    it("renders complex custom fallback correctly", () => {
      const customFallback = (
        <div role="alert">
          <h1>Oops!</h1>
          <button>Reload</button>
        </div>
      );

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowingComponent />
        </ErrorBoundary>,
      );

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Oops!")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    });
  });
});
