/**
 * Global type declarations for external libraries loaded via script tags
 */

/**
 * TurndownService - HTML to Markdown converter
 * Loaded via separate script tag in manifest.json
 */
declare const TurndownService: {
  new (): {
    turndown(html: string): string;
  };
};
