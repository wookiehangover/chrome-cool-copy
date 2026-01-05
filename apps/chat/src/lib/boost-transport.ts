import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import type { StreamTextRequest, AIMessage } from "@repo/shared";
import { boostSystemPrompt } from "@repo/shared/boost-system-prompt";

interface BoostTransportOptions {
  domain: string;
}

/**
 * Custom ChatTransport for boost authoring.
 * Similar to ChromeExtensionTransport but uses boost-specific system prompt
 * and boost tools (file, execute_boost, read_console).
 */
export class BoostTransport implements ChatTransport<UIMessage> {
  private domain: string;

  constructor(options: BoostTransportOptions) {
    this.domain = options.domain;
  }

  async sendMessages(options: {
    trigger: "submit-message" | "regenerate-message";
    chatId: string;
    messageId: string | undefined;
    messages: UIMessage[];
    abortSignal: AbortSignal | undefined;
  }): Promise<ReadableStream<UIMessageChunk>> {
    const { messages, abortSignal } = options;

    // Build messages array for AI request
    const aiMessages: AIMessage[] = [];

    // Add boost system prompt
    aiMessages.push({
      role: "system",
      content: boostSystemPrompt,
    });

    // Convert UIMessage[] to AIMessage format
    for (const msg of messages) {
      if (msg.role === "system" || msg.role === "user" || msg.role === "assistant") {
        const textContent = msg.parts
          .filter((part): part is { type: "text"; text: string } => part.type === "text")
          .map((part) => part.text)
          .join("");

        if (textContent) {
          aiMessages.push({ role: msg.role, content: textContent });
        }
      }
    }

    const assistantMessageId = crypto.randomUUID();

    return new ReadableStream<UIMessageChunk>({
      start: (controller) => {
        const port = chrome.runtime.connect({ name: "boostStream" });
        let isClosed = false;
        let hasStarted = false;
        let hasTextStarted = false;
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

        if (abortSignal) {
          abortSignal.addEventListener("abort", () => {
            cleanup();
            if (hasStarted) {
              enqueue({ type: "abort" });
            }
            closeStream();
          });
        }

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

          if (msg.type === "tool-input-start" && msg.toolCallId && msg.toolName) {
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
            if (!hasStarted) {
              hasStarted = true;
              enqueue({ type: "start", messageId: assistantMessageId });
            }
            enqueue({
              type: "tool-input-available",
              toolCallId: msg.toolCallId,
              toolName: msg.toolName,
              input: msg.input,
            });
            activeToolCalls.delete(msg.toolCallId);
          } else if (msg.type === "tool-result" && msg.toolCallId) {
            enqueue({
              type: "tool-output-available",
              toolCallId: msg.toolCallId,
              output: msg.output,
            });
          } else if (msg.type === "tool-error" && msg.toolCallId) {
            enqueue({
              type: "tool-output-error",
              toolCallId: msg.toolCallId,
              errorText: msg.errorText || "Tool execution failed",
            });
          } else if (msg.type === "chunk" && msg.content) {
            if (!hasStarted) {
              hasStarted = true;
              enqueue({ type: "start", messageId: assistantMessageId });
            }
            if (!hasTextStarted) {
              hasTextStarted = true;
              enqueue({ type: "text-start", id: assistantMessageId });
            }
            enqueue({
              type: "text-delta",
              id: assistantMessageId,
              delta: msg.content,
            });
          } else if (msg.type === "done") {
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
          if (hasStarted && !isClosed) {
            if (hasTextStarted) {
              enqueue({ type: "text-end", id: assistantMessageId });
            }
            enqueue({ type: "finish", finishReason: "stop" });
          }
          closeStream();
        });

        const request: StreamTextRequest = {
          action: "streamText",
          messages: aiMessages,
          providerOptions: {
            anthropic: {
              modelId: "claude-opus-4-1",
            },
          },
        };
        port.postMessage(request);
      },
    });
  }

  async reconnectToStream(_options: {
    chatId: string;
  }): Promise<ReadableStream<UIMessageChunk> | null> {
    return null;
  }
}

