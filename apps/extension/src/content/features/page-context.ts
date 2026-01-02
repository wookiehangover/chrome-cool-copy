/**
 * Page Context Extraction Utility
 * Extracts lightweight page context for AI prompts with size limits
 */

// 10k character limit for context
const MAX_CONTEXT_CHARS = 10_000;

export interface PageContext {
  title: string;
  url: string;
  textContent: string;
  selectedText: string;
  characterCount: number;
}

/**
 * Get the currently selected text on the page
 */
function getSelectedText(): string {
  const selection = window.getSelection();
  return selection ? selection.toString().trim() : "";
}

/**
 * Extract and truncate text content to fit within character limit
 */
function extractTextContent(): string {
  const textContent = document.body?.innerText || "";

  // If text is already under limit, return as-is
  if (textContent.length <= MAX_CONTEXT_CHARS) {
    return textContent;
  }

  // Truncate to limit and add ellipsis
  return textContent.substring(0, MAX_CONTEXT_CHARS - 3) + "...";
}

/**
 * Build page context for AI prompts
 * Includes title, URL, text content, and selected text
 */
export function buildPageContext(): PageContext {
  const selectedText = getSelectedText();
  const textContent = extractTextContent();

  const context: PageContext = {
    title: document.title,
    url: window.location.href,
    textContent,
    selectedText,
    characterCount: textContent.length,
  };

  return context;
}

/**
 * Format page context as a system message for AI prompts
 */
export function formatContextAsSystemMessage(context: PageContext): string {
  let message = `You are assisting with content from a web page.\n\n`;
  message += `Page Title: ${context.title}\n`;
  message += `Page URL: ${context.url}\n`;

  if (context.selectedText) {
    message += `\nUser Selected Text:\n${context.selectedText}\n`;
  }

  message += `\nPage Content:\n${context.textContent}`;

  return message;
}

/**
 * Format page context as a user message prefix
 */
export function formatContextAsUserPrefix(context: PageContext): string {
  let prefix = `[Page Context]\n`;
  prefix += `Title: ${context.title}\n`;
  prefix += `URL: ${context.url}\n`;

  if (context.selectedText) {
    prefix += `Selected: ${context.selectedText}\n`;
  }

  prefix += `\n`;

  return prefix;
}
