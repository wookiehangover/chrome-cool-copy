import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import type { PageContext, ModelId } from "@repo/shared";
import { ChromeExtensionTransport } from "@/lib/chrome-extension-transport";

interface UseExtensionChatOptions {
  pageContext?: PageContext | null;
  model?: ModelId;
  initialMessages?: UIMessage[];
  onFinish?: (messages: UIMessage[]) => void;
}

export function useExtensionChat(options: UseExtensionChatOptions = {}) {
  // Reasoning state
  const [reasoning, setReasoning] = useState<string>("");
  const [isReasoningStreaming, setIsReasoningStreaming] = useState(false);

  // Store onFinish in a ref to avoid stale closures
  const onFinishRef = useRef(options.onFinish);
  useEffect(() => {
    onFinishRef.current = options.onFinish;
  }, [options.onFinish]);

  // Create the transport with page context
  const transport = useMemo(
    () => new ChromeExtensionTransport({ pageContext: options.pageContext }),
    // Only recreate transport on mount, we'll update pageContext via setter
    [],
  );

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

  // Update page context and model when they change
  useEffect(() => {
    transport.setPageContext(options.pageContext ?? null);
    transport.setModel(options.model);
  }, [transport, options.pageContext, options.model]);

  // Set reasoning callbacks on transport
  useEffect(() => {
    transport.setReasoningCallbacks({
      onReasoningStart: handleReasoningStart,
      onReasoningDelta: handleReasoningDelta,
      onReasoningEnd: handleReasoningEnd,
    });
  }, [transport, handleReasoningStart, handleReasoningDelta, handleReasoningEnd]);

  const { messages, status, error, sendMessage, setMessages } = useChat({
    transport,
  });

  // Initialize messages from initialMessages prop (only on mount or when initialMessages identity changes)
  const initialMessagesRef = useRef(options.initialMessages);
  useEffect(() => {
    if (options.initialMessages && options.initialMessages !== initialMessagesRef.current) {
      initialMessagesRef.current = options.initialMessages;
      setMessages(options.initialMessages);
    }
  }, [options.initialMessages, setMessages]);

  // Track previous status to detect when streaming finishes
  const prevStatusRef = useRef(status);
  const hasTriggeredFinishRef = useRef(false);

  useEffect(() => {
    const wasActive =
      prevStatusRef.current === "streaming" || prevStatusRef.current === "submitted";
    const isNowReady = status === "ready";

    // Trigger onFinish when transitioning from active state to ready, with messages
    if (wasActive && isNowReady && messages.length > 0 && !hasTriggeredFinishRef.current) {
      hasTriggeredFinishRef.current = true;
      // Streaming just finished, trigger onFinish callback
      console.log("[useExtensionChat] Stream finished, persisting messages:", messages.length);
      onFinishRef.current?.(messages);
    }

    // Reset the trigger flag when starting a new submission
    if (status === "submitted") {
      hasTriggeredFinishRef.current = false;
    }

    prevStatusRef.current = status;
  }, [status, messages]);

  // Helper to clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    setReasoning("");
    setIsReasoningStreaming(false);
  }, [setMessages]);

  // Helper to extract text content from message parts
  const getMessageContent = (message: (typeof messages)[number]): string => {
    return message.parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("");
  };

  return {
    messages,
    sendMessage,
    status,
    error,
    clearMessages,
    getMessageContent,
    isLoading: status === "submitted" || status === "streaming",
    // Reasoning state
    reasoning,
    isReasoningStreaming,
  };
}
