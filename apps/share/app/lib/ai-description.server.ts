/**
 * AI Description Generation for Media Clips
 * Uses Vercel AI SDK with AI Gateway to generate descriptions for uploaded images
 */

import { generateText, createGateway } from "ai";
import { updateMediaClipAIDescription } from "./agentdb.server";

const AI_MODEL = "google/gemini-2.5-flash";
const DESCRIPTION_PROMPT =
  "Describe this image in 1-2 sentences. Focus on the main subject and visual content.";

/**
 * Generate AI description for a media clip (fire-and-forget)
 * Updates the database with the description when complete or error status if failed
 *
 * @param clipId - The media clip ID to update
 * @param imageUrl - The URL of the image to describe
 */
export async function generateAIDescription(clipId: string, imageUrl: string): Promise<void> {
  const apiKey = process.env.AI_GATEWAY_API_KEY;

  if (!apiKey) {
    console.warn("[AI Description] No AI_GATEWAY_API_KEY configured, skipping description generation");
    return;
  }

  try {
    // Mark as processing
    await updateMediaClipAIDescription(clipId, null, "processing");

    console.log("[AI Description] Starting description generation for clip:", clipId);

    const gateway = createGateway({
      apiKey,
    });

    const result = await generateText({
      model: gateway(AI_MODEL),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: DESCRIPTION_PROMPT },
            { type: "image", image: imageUrl },
          ],
        },
      ],
    });

    const description = result.text?.trim() || "";

    if (description) {
      await updateMediaClipAIDescription(clipId, description, "complete");
      console.log("[AI Description] Description generated for clip:", clipId);
    } else {
      await updateMediaClipAIDescription(clipId, null, "error");
      console.warn("[AI Description] Empty description returned for clip:", clipId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[AI Description] Failed to generate description for clip:", clipId, message);

    // Update status to error - don't throw, this is fire-and-forget
    try {
      await updateMediaClipAIDescription(clipId, null, "error");
    } catch (updateError) {
      console.error("[AI Description] Failed to update error status:", updateError);
    }
  }
}

/**
 * Queue AI description generation (fire-and-forget)
 * This function returns immediately and processes in the background
 *
 * @param clipId - The media clip ID to update
 * @param imageUrl - The URL of the image to describe
 */
export function queueAIDescriptionGeneration(clipId: string, imageUrl: string): void {
  // Fire and forget - don't await, let it run in background
  generateAIDescription(clipId, imageUrl).catch((error) => {
    console.error("[AI Description] Unhandled error in background generation:", error);
  });
}

