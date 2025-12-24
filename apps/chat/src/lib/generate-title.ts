import type { UIMessage } from "ai";

/**
 * Maximum number of user messages after which title becomes fixed
 */
export const TITLE_LOCK_THRESHOLD = 3;

/**
 * Generate a title for a conversation using AI
 * Based on the pattern from mcpbob/apps/web/app/lib/ai/generate-title.ts
 */
export async function generateTitle(messages: UIMessage[]): Promise<string> {
  console.log("[Title Generation] Starting with", messages.length, "messages");

  // Extract text content from messages for context
  const conversationText = messages
    .slice(0, 6) // Use first few messages for title generation
    .map((msg) => {
      const textParts = msg.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text);
      return `${msg.role}: ${textParts.join(" ")}`;
    })
    .join("\n");

  console.log("[Title Generation] Conversation text:", conversationText.substring(0, 200));

  if (!conversationText.trim()) {
    console.log("[Title Generation] Empty conversation, returning default");
    return "New Chat";
  }

  try {
    console.log("[Title Generation] Sending request to background...");
    // Send title generation request to background script
    const response = await chrome.runtime.sendMessage({
      action: "aiRequest",
      enableTools: false, // No tools needed for title generation
      maxTokens: 50,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `You are a title generator. Generate a brief, descriptive title (3-6 words) for the following conversation.
The title should capture the main topic or intent.
Respond with ONLY the title, no quotes, no explanation, no punctuation at the end.`,
        },
        {
          role: "user",
          content: conversationText,
        },
      ],
    });

    console.log("[Title Generation] Response:", response);

    if (response?.success && response.content) {
      // Clean up the title - remove quotes, trim, etc.
      let title = response.content
        .trim()
        .replace(/^["']|["']$/g, "") // Remove surrounding quotes
        .replace(/\.+$/, ""); // Remove trailing periods

      // Ensure title isn't too long
      if (title.length > 50) {
        title = title.substring(0, 47) + "...";
      }

      console.log("[Title Generation] Final title:", title);
      return title || "New Chat";
    }

    console.log("[Title Generation] No valid response, returning default");
    return "New Chat";
  } catch (error) {
    console.error("[Title Generation] Error:", error);
    return "New Chat";
  }
}

/**
 * Determine if title should be regenerated based on message count
 * Title is regenerated for the first 3 user messages, then locked
 */
export function shouldRegenerateTitle(userMessageCount: number): boolean {
  return userMessageCount > 0 && userMessageCount <= TITLE_LOCK_THRESHOLD;
}

