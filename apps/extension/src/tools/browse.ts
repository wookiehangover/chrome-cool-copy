/**
 * Browse Tool
 * Fetches a URL and extracts content for question answering
 */

import { tool } from "ai";
import { z } from "zod";
import { fetchContent, isFetchError } from "./content-fetcher";
import { truncateAndGetChunks } from "./chunk";
import type { BrowseResult } from "./types";

/**
 * Schema for browse tool input
 */
const browseInputSchema = z.object({
  url: z.string().url().describe("The URL to browse and extract content from"),
  question: z.string().optional().describe("A specific question to answer about the page content"),
});

/**
 * Browse tool description for the AI
 */
const browseDescription = `Browse a webpage and extract its content to answer questions.

Use this tool when:
- The user asks you to visit or look at a webpage
- You need to get information from a specific URL
- The user provides a link and asks about its content

The tool fetches the page, extracts readable text, and returns it in chunks.
After receiving the result, use the chunks to answer the user's question.`;

/**
 * Execute the browse operation
 */
async function executeBrowse(
  params: z.infer<typeof browseInputSchema>,
  options?: { abortSignal?: AbortSignal },
): Promise<BrowseResult> {
  const { url, question } = params;

  console.log("[Browse Tool] Fetching:", url);
  const fetchResult = await fetchContent(url, { signal: options?.abortSignal });

  if (isFetchError(fetchResult)) {
    console.log("[Browse Tool] Fetch error:", fetchResult.error);
    return {
      success: false,
      error: fetchResult.error,
      url,
    };
  }

  const { chunks, truncated } = truncateAndGetChunks(fetchResult.content);
  console.log("[Browse Tool] Got", chunks.length, "chunks, truncated:", truncated);

  return {
    success: true,
    chunks,
    answer: question
      ? `Content from ${url}. Answer this question: "${question}"`
      : `Content from ${url}`,
    metadata: fetchResult.metadata,
    truncated,
  };
}

/**
 * Format browse result as a string for the LLM
 */
function formatBrowseResult(result: BrowseResult): string {
  if (result.success === false) {
    return `Failed to browse ${result.url}: ${result.error}`;
  }

  const lines: string[] = [`# ${result.metadata.title}`, `URL: ${result.metadata.url}`];

  if (result.metadata.siteName) {
    lines.push(`Site: ${result.metadata.siteName}`);
  }

  if (result.truncated) {
    lines.push(`(Content truncated due to length)`);
  }

  lines.push("", "## Page Content", "");

  result.chunks.forEach((chunk, i) => {
    lines.push(`[${i + 1}] ${chunk.text}`);
    lines.push("");
  });

  return lines.join("\n");
}

/**
 * The browse tool for use with AI SDK
 */
export const browseTool = tool({
  description: browseDescription,
  inputSchema: browseInputSchema,
  execute: async (params, { abortSignal }) => {
    const result = await executeBrowse(params, { abortSignal });
    return formatBrowseResult(result);
  },
});

/**
 * Export all tools as a map
 */
export const tools = {
  browse: browseTool,
};

export { executeBrowse, formatBrowseResult };
export type { BrowseResult };
