/**
 * Shared Type Definitions
 * Common types used across the Chrome Cool Copy extension and chat app
 */

/**
 * JSON-serializable value types for provider options
 * These match the JSONValue type from @ai-sdk/provider
 */
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JSONValue | undefined }
  | JSONValue[];

/**
 * Provider-specific options for AI requests
 * This is a simplified version of ProviderOptions from @ai-sdk/provider-utils
 * to avoid requiring the AI SDK as a dependency in the shared package
 */
export type AIProviderOptions = Record<string, Record<string, JSONValue | undefined>>;

/**
 * Sync status for a clip
 */
export type SyncStatus = "pending" | "synced" | "error" | "local-only";

/**
 * Message role for AI conversations
 */
export type MessageRole = "system" | "user" | "assistant";

/**
 * Simple message format for AI requests
 * Matches the ModelMessage format from the AI SDK
 */
export interface AIMessage {
  role: MessageRole;
  content: string;
}

/**
 * Tool choice options for AI requests
 * Simplified version of AI SDK ToolChoice - specific tool selection
 * requires knowing available tools so we only support basic options
 */
export type AIToolChoice = "auto" | "none" | "required";

/**
 * Shared options for both generateText and streamText
 * Based on CallSettings from the AI SDK
 */
export interface AICallSettings {
  /** Maximum number of tokens to generate */
  maxOutputTokens?: number;
  /** Temperature setting (0-2 typically, varies by provider) */
  temperature?: number;
  /** Nucleus sampling (0-1) */
  topP?: number;
  /** Top K sampling */
  topK?: number;
  /** Presence penalty (-1 to 1) */
  presencePenalty?: number;
  /** Frequency penalty (-1 to 1) */
  frequencyPenalty?: number;
  /** Stop sequences */
  stopSequences?: string[];
  /** Seed for deterministic results */
  seed?: number;
  /** Maximum number of retries (default: 2) */
  maxRetries?: number;
  /** Additional HTTP headers */
  headers?: Record<string, string | undefined>;
}

/**
 * Options for generateText requests
 * Faithful to the AI SDK generateText options
 */
export interface GenerateTextRequest extends AICallSettings {
  action: "generateText";
  /** Messages to send to the model */
  messages: AIMessage[];
  /** System message (alternative to including in messages array) */
  system?: string;
  /** Tool choice strategy */
  toolChoice?: AIToolChoice;
  /** Whether to enable built-in tools (default: true) */
  enableTools?: boolean;
  /** Maximum steps for tool calling loops */
  maxSteps?: number;
  /** Provider-specific options */
  providerOptions?: AIProviderOptions;
}

/**
 * Options for streamText requests
 * Faithful to the AI SDK streamText options
 */
export interface StreamTextRequest extends AICallSettings {
  action: "streamText";
  /** Messages to send to the model */
  messages: AIMessage[];
  /** System message (alternative to including in messages array) */
  system?: string;
  /** Tool choice strategy */
  toolChoice?: AIToolChoice;
  /** Whether to enable built-in tools (default: true) */
  enableTools?: boolean;
  /** Maximum steps for tool calling loops */
  maxSteps?: number;
  /** Provider-specific options */
  providerOptions?: AIProviderOptions;
}

/**
 * Token usage information
 * Matches LanguageModelUsage from the AI SDK
 */
export interface AIUsage {
  /** Input (prompt) tokens */
  inputTokens?: number;
  /** Output (completion) tokens */
  outputTokens?: number;
  /** Total tokens */
  totalTokens?: number;
}

/**
 * Response from generateText
 */
export interface GenerateTextResponse {
  success: boolean;
  /** Generated text content */
  content?: string;
  /** Token usage */
  usage?: AIUsage;
  /** Error message if success is false */
  error?: string;
}

/**
 * Stream message types for streamText
 */
export type StreamMessageType =
  | { type: "chunk"; content: string }
  | { type: "reasoning-start" }
  | { type: "reasoning"; content: string }
  | { type: "reasoning-end" }
  | { type: "tool-input-start"; toolCallId: string; toolName: string }
  | { type: "tool-input-delta"; toolCallId: string; inputTextDelta: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; input: unknown }
  | { type: "tool-result"; toolCallId: string; toolName: string; output: unknown }
  | { type: "tool-error"; toolCallId: string; toolName: string; errorText: string }
  | { type: "done" }
  | { type: "error"; error: string };

/**
 * A text highlight within a clipped page
 */
export interface Highlight {
  id: string;
  text: string; // The highlighted text
  startOffset: number; // Character offset from start of text_content
  endOffset: number;
  color: string; // Highlight color (default: yellow)
  note?: string; // Optional annotation/comment
  created_at: string;
}

/**
 * Local clip data structure
 */
export interface LocalClip {
  id: string;
  url: string;
  title: string;
  dom_content: string;
  text_content: string;
  metadata?: Record<string, unknown>;
  highlights?: Highlight[]; // User highlights and annotations
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  sync_error?: string;
  agentdb_id?: string; // ID in AgentDB if synced
}

/**
 * Input for creating a new clip
 */
export interface ClipInput {
  url: string;
  title: string;
  dom_content: string;
  text_content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Page context for AI interactions
 * Contains information about the current page
 */
export interface PageContext {
  title: string;
  url: string;
  textContent?: string;
  selectedText?: string;
  characterCount?: number;
}

/**
 * Boost - Custom JavaScript code that runs on specific domains
 */
export interface Boost {
  id: string;
  name: string;
  description: string;
  domain: string; // Pattern: "github.com", "*.github.com", or "*"
  code: string; // JavaScript source
  enabled: boolean;
  runMode: "auto" | "manual"; // auto = on page load, manual = command palette
  createdAt: string; // ISO timestamp
  updatedAt: string;
}

