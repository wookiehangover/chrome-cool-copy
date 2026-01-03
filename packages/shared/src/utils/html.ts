/**
 * HTML Utilities
 * Safe HTML escaping and manipulation functions
 */

/**
 * Escape HTML special characters to prevent XSS attacks
 * Converts HTML entities like <, >, &, ", ' to their safe equivalents
 * @param text - The text to escape
 * @returns Escaped HTML-safe string
 */
export function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

