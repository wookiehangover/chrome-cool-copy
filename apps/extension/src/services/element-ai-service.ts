/**
 * Element AI Service
 * Generates AI-powered titles and descriptions for element clips using Gemini 3 Flash
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
 * Generate a title and description for an element clip
 * Uses Gemini 3 Flash via Vercel AI Gateway with two parallel API calls
 *
 * @param clip - The ElementClip to generate title and description for
 * @returns Promise resolving to {title, description} or empty strings on failure
 */
export async function generateElementTitleAndDescription(
  clip: ElementClip,
): Promise<{ title: string; description: string }> {
  try {
    const config = await getAIGatewayConfig();
    if (!config) {
      console.warn("[Element AI Service] No AI Gateway configuration found");
      return { title: "", description: "" };
    }

    console.log(
      "[Element AI Service] Starting title and description generation for clip:",
      clip.id,
    );

    const gateway = createGateway({
      apiKey: config.apiKey,
    });

    // Run title and description generation in parallel
    console.log("[Element AI Service] Sending API requests to Gemini 3 Flash...");
    const [titleResult, descriptionResult] = await Promise.all([
      generateText({
        model: gateway("google/gemini-3-flash"),
        messages: [
          {
            role: "user",
            content: buildTitlePrompt(clip),
          },
        ],
        system:
          "You are a content analyzer. Generate a concise, descriptive title for the given element. Focus on WHAT the content is, not the element type. Respond with ONLY the title text, no quotes, no JSON, no explanation.",
        maxOutputTokens: 500,
        temperature: 0.7,
      }),
      generateText({
        model: gateway("google/gemini-3-flash"),
        messages: [
          {
            role: "user",
            content: buildDescriptionPrompt(clip),
          },
        ],
        system:
          "You are a content analyzer. Generate a brief, specific description (1-2 sentences) of the element's purpose and key information. Respond with ONLY the description text, no quotes, no JSON, no explanation.",
        maxOutputTokens: 1000,
        temperature: 0.7,
      }),
    ]);

    const result = {
      title: titleResult.text.trim(),
      description: descriptionResult.text.trim(),
    };

    console.log("[Element AI Service] Successfully generated title and description:", {
      clipId: clip.id,
      title: result.title,
      description: result.description,
    });

    return result;
  } catch (error) {
    console.error("[Element AI Service] AI title/description generation failed:", error);
    return { title: "", description: "" };
  }
}

/**
 * Build a focused prompt for title generation
 * Emphasizes content over element type
 */
function buildTitlePrompt(clip: ElementClip): string {
  const parts: string[] = [];

  // Add page context
  parts.push(`Page: ${clip.pageTitle || clip.url}`);

  // Add ARIA role if available
  if (clip.elementMeta.role) {
    parts.push(`Element Role: ${clip.elementMeta.role}`);
  }

  // Prefer markdown content as it's more meaningful
  if (clip.markdownContent) {
    parts.push(`Content:\n${clip.markdownContent.substring(0, 400)}`);
  } else if (clip.textContent) {
    parts.push(`Content:\n${clip.textContent.substring(0, 400)}`);
  }

  // Add structured data if available (e.g., product name, article headline)
  if (clip.structuredData) {
    const structuredStr = JSON.stringify(clip.structuredData).substring(0, 200);
    parts.push(`Structured Data: ${structuredStr}`);
  }

  // Add CSS classes for context
  if (clip.elementMeta.classNames.length > 0) {
    parts.push(`CSS Classes: ${clip.elementMeta.classNames.join(", ")}`);
  }

  return `Generate a concise title for this web element:\n\n${parts.join("\n\n")}`;
}

/**
 * Build a focused prompt for description generation
 * Emphasizes purpose and key details
 */
function buildDescriptionPrompt(clip: ElementClip): string {
  const parts: string[] = [];

  // Add page context
  parts.push(`Page: ${clip.pageTitle || clip.url}`);

  // Add ARIA role if available
  if (clip.elementMeta.role) {
    parts.push(`Element Role: ${clip.elementMeta.role}`);
  }

  // Prefer markdown content as it's more meaningful
  if (clip.markdownContent) {
    parts.push(`Content:\n${clip.markdownContent.substring(0, 400)}`);
  } else if (clip.textContent) {
    parts.push(`Content:\n${clip.textContent.substring(0, 400)}`);
  }

  // Add structured data if available (e.g., price, date, author)
  if (clip.structuredData) {
    const structuredStr = JSON.stringify(clip.structuredData).substring(0, 300);
    parts.push(`Structured Data: ${structuredStr}`);
  }

  // Add CSS classes for context
  if (clip.elementMeta.classNames.length > 0) {
    parts.push(`CSS Classes: ${clip.elementMeta.classNames.join(", ")}`);
  }

  return `Generate a brief, specific description of this web element's purpose and key information:\n\n${parts.join("\n\n")}`;
}
