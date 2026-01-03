/**
 * Shared Type Definitions
 * Common types used across the Chrome Cool Copy extension and chat app
 */

/**
 * Sync status for a clip
 */
export type SyncStatus = "pending" | "synced" | "error" | "local-only";

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

