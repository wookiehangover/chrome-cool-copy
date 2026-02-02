/**
 * Vitest Setup File for Chat App
 * Configures testing-library and global test utilities
 */

import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Suppress React error boundary console.error during tests
// We still want to verify errors are logged, but don't need the noise
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});
