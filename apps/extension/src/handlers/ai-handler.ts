import { generateText } from "ai";
import { tools } from "../tools/browse";
import {
  getAIGateway,
  HTML_CLEANING_SYSTEM_PROMPT,
  HTML_CLEANING_SYSTEM_PROMPT_STRICT,
  stripCodeFences,
} from "./ai-gateway";
import type { VercelAIGatewayConfig } from "./ai-gateway";
import type { GenerateTextRequest, GenerateTextResponse } from "@repo/shared";
import type { HandlerMap } from "./types";
import { z } from "zod";

export interface AIHandlerDependencies {
  generateText: typeof generateText;
  getAIGateway: typeof getAIGateway;
  tools: typeof tools;
}

const generateTextRequestSchema: z.ZodType<GenerateTextRequest> = z.object({
  action: z.literal("generateText"),
  messages: z.array(
    z.object({ role: z.enum(["system", "user", "assistant"]), content: z.string() }),
  ),
  system: z.string().optional(),
  toolChoice: z.enum(["auto", "none", "required"]).optional(),
  enableTools: z.boolean().optional(),
  maxSteps: z.number().int().positive().optional(),
  providerOptions: z.record(z.string(), z.record(z.string(), z.json().optional())).optional(),
  model: z.string().optional(),
  maxOutputTokens: z.number().optional(),
  temperature: z.number().optional(),
  topP: z.number().optional(),
  topK: z.number().optional(),
  presencePenalty: z.number().optional(),
  frequencyPenalty: z.number().optional(),
  stopSequences: z.array(z.string()).optional(),
  seed: z.number().optional(),
  maxRetries: z.number().optional(),
  headers: z.record(z.string(), z.string().optional()).optional(),
});

export function createAIHandlers(dependencies: AIHandlerDependencies): HandlerMap {
  const { generateText: generate, getAIGateway: getGateway, tools: availableTools } = dependencies;
  return {
    generateText: (message, _sender, sendResponse) => {
      (async () => {
        try {
          const parsedRequest = generateTextRequestSchema.safeParse(message);
          if (!parsedRequest.success) {
            throw new Error("Invalid request: messages array is required");
          }
          const request = parsedRequest.data;
          const { gateway, config } = await getGateway();

          const enableTools = request.enableTools !== false;
          const modelToUse = request.model || config.model;

          const result = await generate({
            model: gateway(modelToUse),
            messages: request.messages,
            ...(request.system && { system: request.system }),
            temperature: request.temperature ?? 0.7,
            maxOutputTokens: request.maxOutputTokens ?? 2000,
            topP: request.topP,
            topK: request.topK,
            presencePenalty: request.presencePenalty,
            frequencyPenalty: request.frequencyPenalty,
            stopSequences: request.stopSequences,
            seed: request.seed,
            maxRetries: request.maxRetries,
            headers: request.headers,
            ...(enableTools && {
              tools: availableTools,
              toolChoice: request.toolChoice ?? "auto",
              maxSteps: request.maxSteps ?? 3,
            }),
            ...(request.providerOptions && { providerOptions: request.providerOptions }),
          });

          const response: GenerateTextResponse = {
            success: true,
            content: result.text,
            usage: result.usage
              ? {
                  inputTokens: result.usage.inputTokens ?? 0,
                  outputTokens: result.usage.outputTokens ?? 0,
                  totalTokens: (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
                }
              : undefined,
          };
          sendResponse(response);
        } catch (error) {
          console.error("[Vercel AI Gateway] Error in generateText handler:", error);
          const response: GenerateTextResponse = {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
          sendResponse(response);
        }
      })();
      return true;
    },

    tidyContent: (message, _sender, sendResponse) => {
      const parsedDomContent = z.string().min(1).safeParse(message.domContent);
      if (!parsedDomContent.success) {
        sendResponse({
          success: false,
          error: "domContent is required and must be a string",
        });
        return false;
      }
      const domContent = parsedDomContent.data;

      (async () => {
        try {
          const { gateway } = await getGateway();

          const result = await generate({
            model: gateway("google/gemini-3.5-flash"),
            messages: [{ role: "user", content: domContent }],
            system: HTML_CLEANING_SYSTEM_PROMPT,
            maxOutputTokens: 20_000,
          });

          sendResponse({ success: true, data: result.text });
        } catch (error) {
          console.error("[Clean Link Copy] Error in tidyContent handler:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    },

    tidyContentChunked: (message, sender, sendResponse) => {
      const { chunks, concurrency = 4 } = z
        .object({
          chunks: z.array(z.object({ id: z.string(), html: z.string() })),
          concurrency: z.number().int().positive().optional(),
        })
        .parse(message);
      const tabId = sender.tab?.id;

      if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
        sendResponse({ success: false, error: "chunks array is required" });
        return false;
      }

      if (!tabId) {
        sendResponse({ success: false, error: "Could not determine sender tab" });
        return false;
      }

      // Send success response immediately - processing happens async
      sendResponse({ success: true, totalChunks: chunks.length });

      (async () => {
        try {
          const { gateway } = await getGateway();

          const processChunk = async (chunk: { id: string; html: string }) => {
            try {
              const result = await generate({
                model: gateway("google/gemini-3.5-flash"),
                messages: [{ role: "user", content: chunk.html }],
                system: HTML_CLEANING_SYSTEM_PROMPT_STRICT,
                maxOutputTokens: 20_000,
              });

              chrome.tabs.sendMessage(tabId, {
                action: "tidyChunkComplete",
                chunkId: chunk.id,
                html: stripCodeFences(result.text),
                success: true,
              });
            } catch (error) {
              console.error(`[Clean Link Copy] Error processing chunk ${chunk.id}:`, error);
              chrome.tabs.sendMessage(tabId, {
                action: "tidyChunkComplete",
                chunkId: chunk.id,
                html: "",
                success: false,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          };

          // Process chunks in order with limited concurrency
          const processInOrder = async () => {
            const pending: Promise<void>[] = [];
            for (let i = 0; i < chunks.length; i++) {
              const chunk = chunks[i];
              const task = processChunk(chunk);
              pending.push(task);
              if (pending.length >= concurrency) {
                await pending[0];
                pending.shift();
              }
            }
            await Promise.all(pending);
          };

          await processInOrder();
        } catch (error) {
          console.error("[Clean Link Copy] Error in tidyContentChunked handler:", error);
          chrome.tabs.sendMessage(tabId, {
            action: "tidyChunkComplete",
            chunkId: "error",
            html: "",
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    },

    updateAIGatewayConfig: (message, _sender, sendResponse) => {
      (async () => {
        try {
          const config = z
            .object({ apiKey: z.string().optional(), model: z.string().optional() })
            .parse(message.config);
          if (!config) {
            throw new Error("Config is required");
          }

          const storageData = await new Promise<{
            aiGatewayConfig?: VercelAIGatewayConfig;
          }>((resolve) => {
            chrome.storage.sync.get(["aiGatewayConfig"], (result) => {
              resolve(result);
            });
          });

          const currentConfig = storageData.aiGatewayConfig || {};
          const updatedConfig = { ...currentConfig, ...config };

          await new Promise<void>((resolve) => {
            chrome.storage.sync.set({ aiGatewayConfig: updatedConfig }, () => {
              resolve();
            });
          });

          console.log("[AI Gateway] Configuration updated:", updatedConfig);
          sendResponse({ success: true });
        } catch (error) {
          console.error("[AI Gateway] Error updating configuration:", error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
      return true;
    },
  };
}

export const aiHandlers = createAIHandlers({ generateText, getAIGateway, tools });
