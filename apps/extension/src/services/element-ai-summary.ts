/**
 * Element AI Summary Service
 * Generates AI-powered summaries for element clips using Gemini 3 Flash
 */

import { generateText, createGateway } from "ai";
import type { ElementClip } from "@repo/shared";

/**
 * Vercel AI Gateway configuration interface
 */
interface VercelAIGatewayConfig {
  apiKey: string;
  model: string;
}

/**
 * Get AI Gateway configuration from chrome.storage.sync
 */
async function getAIGatewayConfig(): Promise<VercelAIGatewayConfig | null> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["aiGatewayConfig"], (result) => {
      const config = result.aiGatewayConfig as VercelAIGatewayConfig | undefined;
      if (config?.apiKey && config?.model) {
        resolve(config);
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Generate a concise AI summary for an element clip
 * Uses Gemini 3 Flash via Vercel AI Gateway
 *
 * @param clip - The ElementClip to summarize
 * @returns Promise resolving to the summary text, or empty string on failure
 */
export async function generateElementSummary(clip: ElementClip): Promise<string> {
  try {
    const config = await getAIGatewayConfig();
    if (!config) {
      console.warn("[Element AI Summary] No AI Gateway configuration found");
      return "";
    }

    const gateway = createGateway({
      apiKey: config.apiKey,
    });

    // Build a comprehensive prompt with element context
    const prompt = buildSummaryPrompt(clip);

    const result = await generateText({
      model: gateway("google/gemini-3-flash"),
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      system:
        "You are a concise content summarizer. Generate a brief, informative summary (1-2 sentences) of the element's purpose and content.",
      maxOutputTokens: 150,
      temperature: 0.7,
    });

    return result.text.trim();
  } catch (error) {
    console.error("[Element AI Summary] Error generating summary:", error);
    return "";
  }
}

/**
 * Build a comprehensive prompt for the AI summarizer
 * Includes element text, metadata, and structured data
 */
function buildSummaryPrompt(clip: ElementClip): string {
  const parts: string[] = [];

  parts.push(`Element Type: ${clip.elementMeta.tagName}`);

  if (clip.elementMeta.role) {
    parts.push(`ARIA Role: ${clip.elementMeta.role}`);
  }

  if (clip.textContent) {
    parts.push(`Text Content:\n${clip.textContent.substring(0, 500)}`);
  }

  if (clip.elementMeta.classNames.length > 0) {
    parts.push(`CSS Classes: ${clip.elementMeta.classNames.join(", ")}`);
  }

  if (clip.structuredData) {
    parts.push(`Structured Data: ${JSON.stringify(clip.structuredData).substring(0, 300)}`);
  }

  parts.push(`Page: ${clip.pageTitle || clip.url}`);

  return `Please summarize this web element:\n\n${parts.join("\n\n")}`;
}
