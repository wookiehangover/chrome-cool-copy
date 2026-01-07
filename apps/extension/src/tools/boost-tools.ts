/**
 * Boost Agent Tools
 * Tool definitions for the boost authoring agent
 */

import { tool } from "ai";
import { z } from "zod";
import { createBashSandbox } from "./bash-sandbox";
import { anthropic } from "@ai-sdk/anthropic";
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
  lines: z.number().optional().default(20).describe("Number of recent console entries to read"),
});

/**
 * Context required for boost tool execution
 */
export interface BoostToolContext {
  tabId: number;
  boostDrafts: Map<number, string>;
  currentCode?: string;
  pageHtml?: string;
}

/**
 * Creates boost tools with execution context
 * This factory function creates tools that can actually execute boost code
 * and read console output using the provided context.
 * Also initializes bash tools for text processing and code analysis.
 */
export async function createBoostTools(
  context: BoostToolContext,
): Promise<Record<string, unknown>> {
  /**
   * File tool - stores boost code in draft state
   */
  const fileTool = tool({
    description:
      "Store JavaScript code for the boost. This saves the code as a draft that can be executed with the execute_boost tool.",
    inputSchema: fileSchema,
    execute: async (params) => {
      context.boostDrafts.set(context.tabId, params.content);
      console.log(
        "[Boosts] Stored draft for tab",
        context.tabId,
        `(${params.content.length} bytes)`,
      );
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
      const code = context.boostDrafts.get(context.tabId);
      if (!code) {
        return {
          success: false,
          error: "No boost code stored for this tab. Use the file tool first.",
        };
      }

      try {
        // Execute the code in the page context (MAIN world, not isolated)
        const results = await chrome.scripting.executeScript({
          target: { tabId: context.tabId },
          world: "MAIN",
          func: (codeToExecute: string) => {
            try {
              // eslint-disable-next-line no-eval
              const result = eval(codeToExecute);
              return { success: true, result: result !== undefined ? String(result) : undefined };
            } catch (error) {
              return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              };
            }
          },
          args: [code],
        });

        const result = results[0]?.result;
        if (result?.success) {
          console.log("[Boosts] Boost executed successfully on tab", context.tabId);
          return {
            success: true,
            result: result.result || "Boost executed successfully",
          };
        } else {
          console.error("[Boosts] Boost execution failed:", result?.error);
          return {
            success: false,
            error: result?.error || "Unknown execution error",
          };
        }
      } catch (error) {
        console.error("[Boosts] Error executing boost:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
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
      try {
        // Request console entries from the content script
        const response = await new Promise<{ entries?: ConsoleEntry[]; error?: string }>(
          (resolve) => {
            chrome.tabs.sendMessage(
              context.tabId,
              { action: "getConsoleEntries", count: params.lines },
              (res) => {
                if (chrome.runtime.lastError) {
                  resolve({ error: chrome.runtime.lastError.message });
                } else {
                  resolve(res || { entries: [] });
                }
              },
            );
          },
        );

        if (response.error) {
          console.error("[Boosts] Error reading console:", response.error);
          return {
            entries: [] as ConsoleEntry[],
            error: response.error,
          };
        }

        const entries = response.entries || [];
        console.log("[Boosts] Read", entries.length, "console entries from tab", context.tabId);
        return { entries };
      } catch (error) {
        console.error("[Boosts] Error reading console:", error);
        return {
          entries: [] as ConsoleEntry[],
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });

  /**
   * Initialize bash tools for text processing and code analysis
   * Creates a sandbox with the current boost code and page HTML as files
   */
  let bashTools: Record<string, unknown> = {};
  try {
    const bashSandbox = await createBashSandbox({
      "boost.js": context.currentCode || "",
      "page.html": context.pageHtml || "",
    });
    bashTools = bashSandbox.tools;
    console.log("[Boosts] Bash tools initialized successfully");
  } catch (error) {
    console.error("[Boosts] Error initializing bash tools:", error);
    // Continue without bash tools if initialization fails
  }

  const toolsObject: Record<string, unknown> = {
    file: fileTool,
    execute_boost: executeBoostTool,
    read_console: readConsoleTool,
    web_search: anthropic.tools.webSearch_20250305,
    web_fetch: anthropic.tools.webFetch_20250910,
  };

  // Add bash tools if available
  if (bashTools && typeof bashTools === "object") {
    if ("bash" in bashTools) toolsObject.bash = bashTools.bash;
    if ("readFile" in bashTools) toolsObject.readFile = bashTools.readFile;
    if ("writeFile" in bashTools) toolsObject.writeFile = bashTools.writeFile;
  }

  return toolsObject;
}

// Legacy export for backward compatibility (placeholder tools)
// These should not be used directly - use createBoostTools instead
export const boostTools = {
  file: tool({
    description:
      "Store JavaScript code for the boost. This saves the code as a draft that can be executed with the execute_boost tool.",
    inputSchema: fileSchema,
    execute: async (params) => ({
      success: true,
      message: `Boost code updated (${params.content.length} bytes)`,
    }),
  }),
  execute_boost: tool({
    description:
      "Execute the current boost code in the active tab's page context. This runs the code that was stored with the file tool and captures any errors.",
    inputSchema: executeBoostSchema,
    execute: async () => ({
      success: true,
      result: "Boost executed successfully",
    }),
  }),
  read_console: tool({
    description:
      "Read recent console output from the active tab. Use this to debug your boost code and see what's happening when it runs.",
    inputSchema: readConsoleSchema,
    execute: async () => ({
      entries: [] as ConsoleEntry[],
    }),
  }),
};

export { fileSchema, executeBoostSchema, readConsoleSchema };
export type { ConsoleEntry };
