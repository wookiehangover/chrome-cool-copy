import type { ChatTransport } from "ai";
import type { UIMessage, UIMessageChunk } from "ai";
import type { PageContext, StreamTextRequest, AIMessage, ModelId } from "@repo/shared";

interface ChromeExtensionTransportOptions {
  pageContext?: PageContext | null;
  model?: ModelId;
  onReasoningStart?: () => void;
  onReasoningDelta?: (delta: string) => void;
  onReasoningEnd?: () => void;
}

/**
 * Custom ChatTransport implementation for Chrome extensions.
 * Uses chrome.runtime.connect for port-based streaming communication
 * with the extension's background script.
 */
export class ChromeExtensionTransport implements ChatTransport<UIMessage> {
  private pageContext: PageContext | null;
  private model?: ModelId;
  private onReasoningStart?: () => void;
  private onReasoningDelta?: (delta: string) => void;
  private onReasoningEnd?: () => void;

  constructor(options: ChromeExtensionTransportOptions = {}) {
    this.pageContext = options.pageContext ?? null;
    this.model = options.model;
    this.onReasoningStart = options.onReasoningStart;
    this.onReasoningDelta = options.onReasoningDelta;
    this.onReasoningEnd = options.onReasoningEnd;
  }

  setPageContext(context: PageContext | null) {
    this.pageContext = context;
  }

  setModel(model: ModelId | undefined) {
    this.model = model;
  }

  setReasoningCallbacks(callbacks: {
    onReasoningStart?: () => void;
    onReasoningDelta?: (delta: string) => void;
    onReasoningEnd?: () => void;
  }) {
    this.onReasoningStart = callbacks.onReasoningStart;
    this.onReasoningDelta = callbacks.onReasoningDelta;
    this.onReasoningEnd = callbacks.onReasoningEnd;
  }

  async sendMessages(options: {
    trigger: "submit-message" | "regenerate-message";
    chatId: string;
    messageId: string | undefined;
    messages: UIMessage[];
    abortSignal: AbortSignal | undefined;
  }): Promise<ReadableStream<UIMessageChunk>> {
    const { messages, abortSignal } = options;

    // Build messages array for AI request, converting UIMessage format to AIMessage format
    const aiMessages: AIMessage[] = [];

    // Add system message with page context URL if available
    if (this.pageContext) {
      aiMessages.push({
        role: "system",
        content: `You are a helpful assistant. The user is currently viewing a webpage:

Title: ${this.pageContext.title}
URL: ${this.pageContext.url}

If the user asks about this page, use the browse tool to fetch and analyze its content.`,
      });
    }

    // Convert UIMessage[] to AIMessage format
    for (const msg of messages) {
      if (msg.role === "system" || msg.role === "user" || msg.role === "assistant") {
        // Extract text content from parts
        const textContent = msg.parts
          .filter((part): part is { type: "text"; text: string } => part.type === "text")
          .map((part) => part.text)
          .join("");

        if (textContent) {
          aiMessages.push({ role: msg.role, content: textContent });
        }
      }
    }

    // Generate a message ID for the assistant response
    const assistantMessageId = crypto.randomUUID();

    // Capture callbacks for use in the stream
    const onReasoningStart = this.onReasoningStart;
    const onReasoningDelta = this.onReasoningDelta;
    const onReasoningEnd = this.onReasoningEnd;

    return new ReadableStream<UIMessageChunk>({
      start: (controller) => {
        const port = chrome.runtime.connect({ name: "aiStream" });
        let isClosed = false;
        let hasStarted = false;
        let hasTextStarted = false;
        // Track active tool calls by their IDs
        const activeToolCalls = new Map<string, { toolName: string; inputDelta: string }>();

        const enqueue = (chunk: UIMessageChunk) => {
          if (isClosed) return;
          try {
            controller.enqueue(chunk);
          } catch {
            // Stream may have been closed
          }
        };

        const closeStream = () => {
          if (isClosed) return;
          isClosed = true;
          try {
            controller.close();
          } catch {
            // Controller may already be closed
          }
        };

        const cleanup = () => {
          try {
            port.disconnect();
          } catch {
            // Port may already be disconnected
          }
        };

        // Handle abort signal
        if (abortSignal) {
          abortSignal.addEventListener("abort", () => {
            cleanup();
            if (hasStarted) {
              enqueue({ type: "abort" });
            }
            closeStream();
          });
        }

        // Define message type for port messages
        interface PortMessage {
          type: string;
          content?: string;
          error?: string;
          toolCallId?: string;
          toolName?: string;
          inputTextDelta?: string;
          input?: unknown;
          output?: unknown;
          errorText?: string;
        }

        port.onMessage.addListener((msg: PortMessage) => {
          if (isClosed) return;

          if (msg.type === "reasoning-start") {
            // Start of reasoning - emit message start if not already started
            if (!hasStarted) {
              hasStarted = true;
              enqueue({ type: "start", messageId: assistantMessageId });
            }
            onReasoningStart?.();
          } else if (msg.type === "reasoning" && msg.content) {
            // Reasoning delta - pass to callback
            onReasoningDelta?.(msg.content);
          } else if (msg.type === "reasoning-end") {
            // End of reasoning
            onReasoningEnd?.();
          } else if (msg.type === "tool-input-start" && msg.toolCallId && msg.toolName) {
            // Tool input streaming started
            if (!hasStarted) {
              hasStarted = true;
              enqueue({ type: "start", messageId: assistantMessageId });
            }
            activeToolCalls.set(msg.toolCallId, { toolName: msg.toolName, inputDelta: "" });
            enqueue({
              type: "tool-input-start",
              toolCallId: msg.toolCallId,
              toolName: msg.toolName,
            });
          } else if (msg.type === "tool-input-delta" && msg.toolCallId && msg.inputTextDelta) {
            // Tool input streaming delta
            const toolCall = activeToolCalls.get(msg.toolCallId);
            if (toolCall) {
              toolCall.inputDelta += msg.inputTextDelta;
            }
            enqueue({
              type: "tool-input-delta",
              toolCallId: msg.toolCallId,
              inputTextDelta: msg.inputTextDelta,
            });
          } else if (msg.type === "tool-call" && msg.toolCallId && msg.toolName) {
            // Tool call with full input available - emit tool-input-available
            if (!hasStarted) {
              hasStarted = true;
              enqueue({ type: "start", messageId: assistantMessageId });
            }
            // Emit tool-input-available with the full input
            enqueue({
              type: "tool-input-available",
              toolCallId: msg.toolCallId,
              toolName: msg.toolName,
              input: msg.input,
            });
            activeToolCalls.delete(msg.toolCallId);
          } else if (msg.type === "tool-result" && msg.toolCallId) {
            // Tool result available
            enqueue({
              type: "tool-output-available",
              toolCallId: msg.toolCallId,
              output: msg.output,
            });
          } else if (msg.type === "tool-error" && msg.toolCallId) {
            // Tool error
            enqueue({
              type: "tool-output-error",
              toolCallId: msg.toolCallId,
              errorText: msg.errorText || "Tool execution failed",
            });
          } else if (msg.type === "chunk" && msg.content) {
            // On first text chunk, emit message start and text start
            if (!hasStarted) {
              hasStarted = true;
              enqueue({ type: "start", messageId: assistantMessageId });
            }
            if (!hasTextStarted) {
              hasTextStarted = true;
              enqueue({ type: "text-start", id: assistantMessageId });
            }
            // Emit text delta
            enqueue({
              type: "text-delta",
              id: assistantMessageId,
              delta: msg.content,
            });
          } else if (msg.type === "done") {
            // End text and finish message
            if (hasStarted) {
              if (hasTextStarted) {
                enqueue({ type: "text-end", id: assistantMessageId });
              }
              enqueue({ type: "finish", finishReason: "stop" });
            }
            cleanup();
            closeStream();
          } else if (msg.type === "error") {
            cleanup();
            enqueue({ type: "error", errorText: msg.error || "Unknown streaming error" });
            closeStream();
          }
        });

        port.onDisconnect.addListener(() => {
          // Unexpected disconnect - close the stream
          if (hasStarted && !isClosed) {
            if (hasTextStarted) {
              enqueue({ type: "text-end", id: assistantMessageId });
            }
            enqueue({ type: "finish", finishReason: "stop" });
          }
          closeStream();
        });

        // Send the request with typed StreamTextRequest
        const request: StreamTextRequest = {
          action: "streamText",
          messages: aiMessages,
          ...(this.model && { model: this.model }),
        };
        port.postMessage(request);
      },
    });
  }

  async reconnectToStream(_options: {
    chatId: string;
  }): Promise<ReadableStream<UIMessageChunk> | null> {
    // Chrome extension streaming doesn't support reconnection
    return null;
  }
}
