import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import type { Boost } from "@repo/shared";
import { BoostTransport } from "@/lib/boost-transport";

interface UseBoostAuthoringOptions {
  domain: string;
}

export interface UseBoostAuthoringReturn {
  messages: UIMessage[];
  sendMessage: (content: string) => void;
  currentCode: string | null;
  isLoading: boolean;
  error: Error | null;
  clearMessages: () => void;
  saveBoost: (metadata: Omit<Boost, "id" | "code" | "createdAt" | "updatedAt">) => Promise<void>;
}

/**
 * Hook for boost authoring with streaming AI responses and code tracking
 */
export function useBoostAuthoring(options: UseBoostAuthoringOptions): UseBoostAuthoringReturn {
  const [currentCode, setCurrentCode] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Create transport for boost agent
  const transport = useMemo(
    () => new BoostTransport({ domain: options.domain }),
    [options.domain]
  );

  // Use the chat hook with boost transport
  const { messages, status, error, sendMessage: sendChatMessage, setMessages } = useChat({
    transport,
  });

  // Track code updates from file tool calls
  useEffect(() => {
    // Look for the most recent file tool call with output
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === "assistant") {
        const filePart = msg.parts.find(
          (part) =>
            (part.type === "tool-file" || part.type === "dynamic-tool") &&
            (part as any).toolName === "file"
        );
        if (filePart && (filePart as any).input) {
          const input = (filePart as any).input;
          if (input.content && typeof input.content === "string") {
            setCurrentCode(input.content);
            return;
          }
        }
      }
    }
  }, [messages]);

  const handleSendMessage = useCallback(
    (content: string) => {
      if (!content.trim()) return;
      sendChatMessage({ parts: [{ type: "text", text: content }] });
    },
    [sendChatMessage]
  );

  const handleSaveBoost = useCallback(
    async (metadata: Omit<Boost, "id" | "code" | "createdAt" | "updatedAt">) => {
      if (!currentCode) {
        throw new Error("No boost code to save");
      }

      setIsSaving(true);
      try {
        // Import saveBoost from extension services
        const { saveBoost } = await import("@repo/shared");
        // Note: This will need to be handled via chrome.runtime.sendMessage
        // For now, we'll send a message to the background script
        const result = await new Promise<Boost>((resolve, reject) => {
          chrome.runtime.sendMessage(
            {
              type: "saveBoost",
              payload: {
                ...metadata,
                code: currentCode,
              },
            },
            (response) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else if (response?.success) {
                resolve(response.boost);
              } else {
                reject(new Error(response?.error || "Failed to save boost"));
              }
            }
          );
        });

        // Clear messages after successful save
        setMessages([]);
        setCurrentCode(null);
      } finally {
        setIsSaving(false);
      }
    },
    [currentCode, setMessages]
  );

  return {
    messages,
    sendMessage: handleSendMessage,
    currentCode,
    isLoading: status === "streaming" || status === "submitted" || isSaving,
    error: error || null,
    clearMessages: () => setMessages([]),
    saveBoost: handleSaveBoost,
  };
}

