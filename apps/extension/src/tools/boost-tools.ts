/**
 * Boost Agent Tools
 * Tool definitions for the boost authoring agent
 */

import { tool } from "ai";
import { z } from "zod";
import type { ConsoleEntry } from "../content/features/console-capture";

/**
 * Schema for the file tool - stores boost code in draft state
 */
const fileSchema = z.object({
  content: z.string().describe("The JavaScript code for the boost"),
});

/**
 * Schema for the execute_boost tool - injects and runs the boost code
 */
const executeBoostSchema = z.object({});

/**
 * Schema for the read_console tool - fetches recent console entries
 */
const readConsoleSchema = z.object({
  lines: z
    .number()
    .optional()
    .default(20)
    .describe("Number of recent console entries to read"),
});

/**
 * File tool - stores boost code in draft state
 */
const fileTool = tool({
  description:
    "Store JavaScript code for the boost. This saves the code as a draft that can be executed with the execute_boost tool.",
  inputSchema: fileSchema,
  execute: async (params) => {
    // This will be handled by the background service worker
    // Return a placeholder response
    return {
      success: true,
      message: `Boost code updated (${params.content.length} bytes)`,
    };
  },
});

/**
 * Execute boost tool - injects code into the page context
 */
const executeBoostTool = tool({
  description:
    "Execute the current boost code in the active tab's page context. This runs the code that was stored with the file tool and captures any errors.",
  inputSchema: executeBoostSchema,
  execute: async () => {
    // This will be handled by the background service worker
    // Return a placeholder response
    return {
      success: true,
      result: "Boost executed successfully",
    };
  },
});

/**
 * Read console tool - fetches recent console entries
 */
const readConsoleTool = tool({
  description:
    "Read recent console output from the active tab. Use this to debug your boost code and see what's happening when it runs.",
  inputSchema: readConsoleSchema,
  execute: async (params) => {
    // This will be handled by the background service worker
    // Return a placeholder response
    return {
      entries: [] as ConsoleEntry[],
    };
  },
});

/**
 * Export all boost tools as a map
 */
export const boostTools = {
  file: fileTool,
  execute_boost: executeBoostTool,
  read_console: readConsoleTool,
};

export { fileSchema, executeBoostSchema, readConsoleSchema };
export type { ConsoleEntry };

