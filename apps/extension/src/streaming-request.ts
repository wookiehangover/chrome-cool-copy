import { stepCountIs } from "ai";
import type { LanguageModel, ToolSet, streamText } from "ai";
import type { AIProviderOptions } from "@repo/shared";
import { normalizeAIRequest } from "./handlers/normalize-ai-request";
import type { PromptRequest } from "./handlers/normalize-ai-request";

type StreamTextOptions = Parameters<typeof streamText>[0];
type StreamTextCall<Result> = (options: StreamTextOptions) => Result;

interface StreamingRequest extends PromptRequest {
  maxSteps?: number;
  toolChoice?: "auto" | "none" | "required";
  enableTools?: boolean;
  providerOptions?: AIProviderOptions;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stopSequences?: string[];
  seed?: number;
  maxRetries?: number;
  headers?: Record<string, string | undefined>;
}

interface StartStreamingRequestOptions<Result> {
  stream: StreamTextCall<Result>;
  model: LanguageModel;
  request: StreamingRequest;
  tools: ToolSet;
  defaultProviderOptions: AIProviderOptions;
  instructionPrefix?: string;
}

export function startStreamingRequest<Result>(
  options: StartStreamingRequestOptions<Result>,
): Result {
  const { stream, model, request, tools, defaultProviderOptions, instructionPrefix } = options;
  const prompt = normalizeAIRequest(request);
  const instructionParts = [instructionPrefix, prompt.instructions].filter(
    (part): part is string => part !== undefined,
  );
  const enableTools = request.enableTools !== false;

  return stream({
    model,
    messages: prompt.messages,
    ...(instructionParts.length > 0 && { instructions: instructionParts.join("\n\n") }),
    temperature: request.temperature,
    maxOutputTokens: request.maxOutputTokens,
    topP: request.topP,
    topK: request.topK,
    presencePenalty: request.presencePenalty,
    frequencyPenalty: request.frequencyPenalty,
    stopSequences: request.stopSequences,
    seed: request.seed,
    maxRetries: request.maxRetries,
    headers: request.headers,
    stopWhen: stepCountIs(request.maxSteps ?? 5),
    ...(enableTools && {
      tools,
      toolChoice: request.toolChoice ?? "auto",
    }),
    providerOptions: {
      ...defaultProviderOptions,
      ...request.providerOptions,
    },
  });
}
