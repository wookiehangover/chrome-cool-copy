import type { AIMessage } from "@repo/shared";

interface LegacyAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface PromptRequest {
  instructions?: string;
  system?: string;
  messages: LegacyAIMessage[];
}

interface NormalizedPrompt {
  instructions?: string;
  messages: AIMessage[];
}

export function normalizeAIRequest(request: PromptRequest): NormalizedPrompt {
  const instructionParts = [request.instructions, request.system];
  const messages: AIMessage[] = [];

  for (const message of request.messages) {
    if (message.role === "system") {
      instructionParts.push(message.content);
    } else {
      messages.push({ role: message.role, content: message.content });
    }
  }

  const instructions = instructionParts
    .filter((part): part is string => part !== undefined)
    .join("\n\n");
  return { messages, ...(instructions && { instructions }) };
}
