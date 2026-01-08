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

/**
 * Type declarations for just-bash browser module
 */
declare module "just-bash/browser" {
  export interface BashOptions {
    files?: Record<string, string>;
    cwd?: string;
  }

  export class Bash {
    constructor(options?: BashOptions);
    run(command: string): Promise<{
      stdout: string;
      stderr: string;
      exitCode: number;
    }>;
    writeFile(path: string, content: string): void;
    readFile(path: string): string;
    ls(path?: string): string[];
  }
}

/**
 * Type declarations for @ai-sdk/anthropic
 */
declare module "@ai-sdk/anthropic" {
  export const anthropic: {
    tools: {
      webSearch_20250305: unknown;
      webFetch_20250910: unknown;
    };
  };
}
