import { createGateway } from "ai";

type GatewayFactory = typeof createGateway;

/**
 * Vercel AI Gateway configuration
 */
export interface VercelAIGatewayConfig {
  apiKey: string;
  model: string;
}

/**
 * Shared system prompt for HTML content cleaning.
 * Used by both tidyContent and tidyContentChunked handlers.
 */
export const HTML_CLEANING_SYSTEM_PROMPT = `You are an HTML content cleaner. Given HTML content from a web page, return ONLY the cleaned HTML.

Remove these types of elements:
- Advertisements and promotional content
- Navigation menus and sidebars
- Social sharing buttons
- Comment sections
- Related articles sections
- Newsletter signup forms
- Cookie banners
- Floating elements and popups
- Empty or decorative containers

Preserve:
- Main article text and paragraphs
- Headings and subheadings
- Images with their alt text and captions
- Code blocks and pre-formatted text
- Block quotes
- Lists (ordered and unordered)
- Tables with data
- Links within the content

Return ONLY valid HTML, no explanations or markdown.`;

/**
 * Extended version of the system prompt that also warns against markdown code fences.
 * Used by tidyContentChunked where AI sometimes wraps output in fences.
 */
export const HTML_CLEANING_SYSTEM_PROMPT_STRICT = `${HTML_CLEANING_SYSTEM_PROMPT.replace(
  "Return ONLY valid HTML, no explanations or markdown.",
  "IMPORTANT: Return ONLY raw HTML. Do NOT wrap in markdown code fences like \\`\\`\\`html. Do NOT add any explanation text. Just the HTML tags directly.",
)}`;

/**
 * Fetch the AI gateway configuration from chrome.storage.sync and create a gateway instance.
 * Throws if configuration is missing.
 */
export async function getAIGateway(createGatewayInstance: GatewayFactory = createGateway): Promise<{
  gateway: ReturnType<typeof createGateway>;
  config: VercelAIGatewayConfig;
}> {
  const storageData = await new Promise<{
    aiGatewayConfig?: VercelAIGatewayConfig;
  }>((resolve) => {
    chrome.storage.sync.get(["aiGatewayConfig"], (result) => {
      resolve(result);
    });
  });

  const config = storageData.aiGatewayConfig;
  if (!config || !config.apiKey || !config.model) {
    throw new Error("Vercel AI Gateway configuration not found. Please configure settings.");
  }

  const gateway = createGatewayInstance({
    apiKey: config.apiKey,
  });

  return { gateway, config };
}

/**
 * Strip markdown code fences if AI accidentally adds them.
 */
export function stripCodeFences(text: string): string {
  let result = text.trim();
  // Remove opening ```html or ```
  if (result.startsWith("```html")) {
    result = result.slice(7);
  } else if (result.startsWith("```")) {
    result = result.slice(3);
  }
  // Remove closing ```
  if (result.endsWith("```")) {
    result = result.slice(0, -3);
  }
  return result.trim();
}
