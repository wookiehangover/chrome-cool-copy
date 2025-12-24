/**
 * Browse Tool Type Definitions
 * Simplified types for URL browsing and question answering
 */

export type UUID = string;

/**
 * A chunk of content with a citation ID for reference
 */
export interface ContentChunk {
  citationUUID: UUID;
  text: string;
}

/**
 * Metadata extracted from a webpage
 */
export interface PageMetadata {
  title: string;
  url: string;
  excerpt?: string;
  siteName?: string;
  byline?: string;
}

/**
 * Successful browse result
 */
export interface BrowseSuccess {
  success: true;
  chunks: ContentChunk[];
  answer: string;
  metadata: PageMetadata;
  truncated: boolean;
}

/**
 * Failed browse result
 */
export interface BrowseError {
  success: false;
  error: string;
  url: string;
}

/**
 * Combined browse result type
 */
export type BrowseResult = BrowseSuccess | BrowseError;

/**
 * Options for chunking text content
 */
export interface ChunkOptions {
  minChars?: number;
  maxChars?: number;
}
