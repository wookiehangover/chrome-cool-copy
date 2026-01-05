/**
 * Console Capture Module
 * Intercepts console methods to capture debug information
 */

/**
 * Console entry interface for captured console output
 */
export interface ConsoleEntry {
  type: "log" | "warn" | "error" | "info" | "debug";
  message: string;
  timestamp: string; // ISO timestamp
}

// Circular buffer to store console entries (max 100)
const MAX_ENTRIES = 100;
let consoleBuffer: ConsoleEntry[] = [];

// Store original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
};

/**
 * Convert arguments to a string message
 */
function stringifyArgs(...args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === "string") {
        return arg;
      }
      if (arg === null) {
        return "null";
      }
      if (arg === undefined) {
        return "undefined";
      }
      try {
        return JSON.stringify(arg);
      } catch {
        // Handle circular references and other stringify errors
        return String(arg);
      }
    })
    .join(" ");
}

/**
 * Add an entry to the circular buffer
 */
function addEntry(type: ConsoleEntry["type"], message: string): void {
  const entry: ConsoleEntry = {
    type,
    message,
    timestamp: new Date().toISOString(),
  };

  consoleBuffer.push(entry);

  // Maintain circular buffer size
  if (consoleBuffer.length > MAX_ENTRIES) {
    consoleBuffer.shift();
  }
}

/**
 * Initialize console capture by wrapping console methods
 */
export function initConsoleCapture(): void {
  // Wrap console.log
  console.log = function (...args: unknown[]): void {
    const message = stringifyArgs(...args);
    addEntry("log", message);
    originalConsole.log.apply(console, args);
  };

  // Wrap console.warn
  console.warn = function (...args: unknown[]): void {
    const message = stringifyArgs(...args);
    addEntry("warn", message);
    originalConsole.warn.apply(console, args);
  };

  // Wrap console.error
  console.error = function (...args: unknown[]): void {
    const message = stringifyArgs(...args);
    addEntry("error", message);
    originalConsole.error.apply(console, args);
  };

  // Wrap console.info
  console.info = function (...args: unknown[]): void {
    const message = stringifyArgs(...args);
    addEntry("info", message);
    originalConsole.info.apply(console, args);
  };

  // Wrap console.debug
  console.debug = function (...args: unknown[]): void {
    const message = stringifyArgs(...args);
    addEntry("debug", message);
    originalConsole.debug.apply(console, args);
  };
}

/**
 * Get recent console entries
 * @param limit - Maximum number of entries to return (default: all)
 * @returns Array of console entries
 */
export function getConsoleEntries(limit?: number): ConsoleEntry[] {
  if (limit === undefined) {
    return [...consoleBuffer];
  }
  return consoleBuffer.slice(-limit);
}

/**
 * Clear the console buffer
 */
export function clearConsoleEntries(): void {
  consoleBuffer = [];
}
