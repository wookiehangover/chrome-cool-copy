import { useMemo, useEffect, useState, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { sendMessage } from "@repo/shared";
import type { Boost } from "@repo/shared";
import { BoostTransport } from "@/lib/boost-transport";

interface UseBoostAuthoringOptions {
  domain: string;
  boostId?: string; // If provided, load existing boost for editing
}

export interface UseBoostAuthoringReturn {
  messages: UIMessage[];
  sendMessage: (content: string) => void;
  currentCode: string;
  setCurrentCode: (code: string) => void;
  isLoading: boolean;
  error: Error | null;
  clearMessages: () => void;
  saveBoost: (metadata: Omit<Boost, "id" | "code" | "createdAt" | "updatedAt">) => Promise<void>;
  reasoning: string;
  isReasoningStreaming: boolean;
  isEditMode: boolean;
  existingBoost: Boost | null;
}

/**
 * Hook for boost authoring with streaming AI responses and code tracking
 */
export function useBoostAuthoring(options: UseBoostAuthoringOptions): UseBoostAuthoringReturn {
  const [currentCode, setCurrentCode] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [existingBoost, setExistingBoost] = useState<Boost | null>(null);
  const isEditMode = !!options.boostId;

  // Reasoning state
  const [reasoning, setReasoning] = useState<string>("");
  const [isReasoningStreaming, setIsReasoningStreaming] = useState(false);

  // Create transport for boost agent
  const transport = useMemo(() => new BoostTransport({ domain: options.domain }), [options.domain]);

  // Reasoning callbacks
  const handleReasoningStart = useCallback(() => {
    setReasoning("");
    setIsReasoningStreaming(true);
  }, []);

  const handleReasoningDelta = useCallback((delta: string) => {
    setReasoning((prev) => prev + delta);
  }, []);

  const handleReasoningEnd = useCallback(() => {
    setIsReasoningStreaming(false);
  }, []);

  // Set reasoning callbacks on transport
  useEffect(() => {
    transport.setReasoningCallbacks({
      onReasoningStart: handleReasoningStart,
      onReasoningDelta: handleReasoningDelta,
      onReasoningEnd: handleReasoningEnd,
    });
  }, [transport, handleReasoningStart, handleReasoningDelta, handleReasoningEnd]);

  // Use the chat hook with boost transport
  const {
    messages,
    status,
    error,
    sendMessage: sendChatMessage,
    setMessages,
  } = useChat({
    transport,
  });

  // Load existing boost when editing
  useEffect(() => {
    if (!options.boostId) {
      setExistingBoost(null);
      return;
    }

    sendMessage<Boost[]>({ action: "getBoosts" }, { responseKey: "data" })
      .then((boosts) => {
        const boost = boosts?.find((b: Boost) => b.id === options.boostId);
        if (boost) {
          setExistingBoost(boost);
          setCurrentCode(boost.code);
          // Load chat history if available
          if (boost.chatHistory && Array.isArray(boost.chatHistory)) {
            // SAFETY: Boost.chatHistory is persisted from this hook's UIMessage array.
            setMessages(boost.chatHistory as UIMessage[]);
          }
        }
      })
      .catch(() => {
        // Silently ignore - boost may not exist
      });
  }, [options.boostId, setMessages]);

  // Track code updates from file tool calls
  useEffect(() => {
    // Look for the most recent file tool call with input containing code
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === "assistant") {
        // Find file tool part - can be typed (tool-file) or dynamic (dynamic-tool)
        const filePart = msg.parts.find((part) => {
          const partType = part.type;
          const toolName = "toolName" in part ? part.toolName : undefined;

          // Check for dynamic-tool type with toolName "file"
          if (partType === "dynamic-tool" && toolName === "file") {
            return true;
          }
          // Check for typed tool part "tool-file"
          if (partType === "tool-file") {
            return true;
          }
          // Also check for any tool-* type that has toolName "file"
          if (partType.startsWith("tool-") && toolName === "file") {
            return true;
          }
          return false;
        });

        if (filePart && "input" in filePart) {
          const input = filePart.input;
          const content = Object.getOwnPropertyDescriptor(Object(input), "content")?.value;
          if (Object.prototype.toString.call(content) === "[object String]") {
            setCurrentCode(String(content));
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
    [sendChatMessage],
  );

  const handleSaveBoost = useCallback(
    async (metadata: Omit<Boost, "id" | "code" | "createdAt" | "updatedAt">) => {
      if (!currentCode) {
        throw new Error("No boost code to save");
      }

      setIsSaving(true);
      try {
        if (isEditMode && existingBoost) {
          // Update existing boost
          await sendMessage<Boost>(
            {
              action: "updateBoost",
              id: existingBoost.id,
              updates: {
                ...metadata,
                code: currentCode,
                chatHistory: messages,
              },
            },
            { responseKey: "boost" },
          );
        } else {
          // Create new boost
          await sendMessage<Boost>(
            {
              action: "saveBoost",
              ...metadata,
              code: currentCode,
              chatHistory: messages,
            },
            { responseKey: "boost" },
          );
        }

        // Clear messages after successful save
        setMessages([]);
        setCurrentCode("");
      } finally {
        setIsSaving(false);
      }
    },
    [currentCode, messages, setMessages, isEditMode, existingBoost],
  );

  // Helper to clear messages and reasoning
  const clearMessages = useCallback(() => {
    setMessages([]);
    setReasoning("");
    setIsReasoningStreaming(false);
  }, [setMessages]);

  return {
    messages,
    sendMessage: handleSendMessage,
    currentCode,
    setCurrentCode,
    isLoading: status === "streaming" || status === "submitted" || isSaving,
    error: error || null,
    clearMessages,
    saveBoost: handleSaveBoost,
    reasoning,
    isReasoningStreaming,
    isEditMode,
    existingBoost,
  };
}
