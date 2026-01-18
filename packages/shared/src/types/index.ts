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
  /** Optional model override (uses config.model if not provided) */
  model?: string;
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
  /** Optional model override (uses config.model if not provided) */
  model?: string;
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
 * Request for chunked HTML content tidying
 */
export interface TidyContentChunkedRequest {
  action: "tidyContentChunked";
  /** HTML content to be cleaned */
  domContent: string;
  /** Maximum concurrent chunk processing (default: 4) */
  concurrency?: number;
}

/**
 * Initial response from tidyContentChunked request
 */
export interface TidyContentChunkedResponse {
  success: boolean;
  /** Total number of chunks being processed */
  totalChunks?: number;
  /** IDs of all chunks in order */
  chunkIds?: string[];
  /** Error message if success is false */
  error?: string;
}

/**
 * Message sent for each completed chunk during chunked processing
 */
export interface TidyChunkCompleteMessage {
  action: "tidyChunkComplete";
  /** ID of the completed chunk */
  chunkId: string;
  /** Cleaned HTML content for this chunk */
  html: string;
  /** Whether the chunk was processed successfully */
  success: boolean;
  /** Error message if success is false */
  error?: string;
}

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
  share_id?: string; // Shareable URL identifier
}

/**
 * Structured data extracted from a webpage
 * Includes JSON-LD, microdata, Open Graph, and ARIA attributes
 */
export interface StructuredData {
  /** Parsed JSON-LD objects from script[type="application/ld+json"] tags */
  jsonLd?: Record<string, unknown>[];
  /** Microdata items extracted from elements with itemscope/itemprop */
  microdata?: Array<{
    itemtype?: string;
    properties: Record<string, string[]>;
  }>;
  /** Open Graph meta tags (og:title, og:description, og:image, etc.) */
  openGraph?: Record<string, string>;
  /** ARIA attributes from the element and its descendants */
  ariaAttributes?: Record<string, string[]>;
}

/**
 * Media asset reference in an element clip
 */
export interface MediaAssetReference {
  type: "image" | "video" | "background";
  assetId?: string; // IndexedDB reference if downloaded
  originalSrc: string; // Original URL
  alt?: string;
}

/**
 * Element metadata captured in an element clip
 */
export interface ElementMetadata {
  tagName: string;
  role?: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  classNames: string[];
  dataAttributes: Record<string, string>;
}

/**
 * Element clip data structure
 * Captures a comprehensive snapshot of a selected element on a webpage
 */
export interface ElementClip {
  id: string;
  type: "element"; // Differentiates from page clips

  // Source context
  url: string;
  pageTitle: string;
  selector: string;

  // Captured content
  screenshotAssetId: string; // Reference to IndexedDB asset
  domStructure: string; // Self-contained HTML
  scopedStyles: string; // CSS that applies to the element
  textContent: string; // Plain text
  markdownContent: string; // Markdown conversion

  // Structured data
  structuredData?: StructuredData;

  // Media (asset IDs reference IndexedDB)
  mediaAssets: MediaAssetReference[];

  // Element metadata
  elementMeta: ElementMetadata;

  // AI-generated
  aiSummary?: string;
  aiSummaryStatus: "pending" | "complete" | "error";
  aiTitle?: string;
  aiDescription?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;

  // Sync (reuse existing pattern)
  syncStatus: SyncStatus;
}

/**
 * IndexedDB asset for storing binary data (screenshots, images, etc.)
 */
export interface ClipAsset {
  id: string; // UUID
  clipId: string; // Reference to parent clip
  type: "screenshot" | "image" | "video" | "background";
  mimeType: string;
  data: Blob; // Binary data
  originalUrl?: string;
  createdAt: string;
}

/**
 * Union type for all clip types
 * Discriminated by the 'type' field
 */
export type Clip = LocalClip | ElementClip;

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
  chatHistory?: unknown[]; // Serialized UIMessage[] from @ai-sdk/react for conversation history
}
