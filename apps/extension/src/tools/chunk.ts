/**
 * Text Chunking Utility
 * Splits text content into manageable chunks for LLM processing
 */

import type { ContentChunk, ChunkOptions } from "./types";

const DEFAULT_MIN_CHARS = 100;
const DEFAULT_MAX_CHARS = 1000;
const MAX_TOTAL_CHARS = 100000;

function createCitation(): { citationUUID: string } {
  return {
    citationUUID: crypto.randomUUID(),
  };
}

/**
 * Split text by a pattern while preserving non-empty parts
 */
function splitByPattern(text: string, pattern: RegExp): string[] {
  return text.split(pattern).filter((part) => part.length > 0);
}

/**
 * Append sentences to the current chunk, flushing completed chunks to `chunks`.
 * Never drops text: sentences that don't fit start a new chunk, and sentences
 * longer than maxChars are hard-split into maxChars-sized pieces.
 * Returns the new current chunk.
 */
function appendSentences(
  sentences: string[],
  currentChunk: string,
  chunks: string[],
  maxChars: number,
): string {
  for (const sentence of sentences) {
    const separator = currentChunk ? 1 : 0;
    if (currentChunk.length + sentence.length + separator <= maxChars) {
      currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
    } else {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }
      let remaining = sentence;
      while (remaining.length > maxChars) {
        chunks.push(remaining.slice(0, maxChars));
        remaining = remaining.slice(maxChars);
      }
      currentChunk = remaining;
    }
  }
  return currentChunk;
}

/**
 * Split text into smart chunks based on paragraph and sentence boundaries
 */
export function getSmartChunks(text: string, options?: ChunkOptions): ContentChunk[] {
  const minChars = options?.minChars ?? DEFAULT_MIN_CHARS;
  const maxChars = options?.maxChars ?? DEFAULT_MAX_CHARS;

  if (minChars > maxChars) {
    throw new Error("minChars must be less than or equal to maxChars");
  }

  if (text.length <= maxChars) {
    return [{ ...createCitation(), text }];
  }

  const paragraphs = splitByPattern(text, /\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length + (currentChunk ? 2 : 0) <= maxChars) {
      currentChunk = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;
    } else if (paragraph.length > maxChars) {
      if (currentChunk.length >= minChars) {
        chunks.push(currentChunk);
        currentChunk = "";
      }
      const sentences = splitByPattern(paragraph, /(?<=[.!?])\s+/);
      currentChunk = appendSentences(sentences, currentChunk, chunks, maxChars);
    } else if (currentChunk.length >= minChars) {
      chunks.push(currentChunk);
      currentChunk = paragraph;
    } else {
      const sentences = splitByPattern(paragraph, /(?<=[.!?])\s+/);
      currentChunk = appendSentences(sentences, currentChunk, chunks, maxChars);
    }
  }

  if (currentChunk.length >= minChars) {
    chunks.push(currentChunk);
  } else if (currentChunk.length > 0 && chunks.length > 0) {
    const lastChunk = chunks[chunks.length - 1];
    if (lastChunk.length + currentChunk.length + 1 <= maxChars) {
      chunks[chunks.length - 1] = `${lastChunk} ${currentChunk}`;
    } else {
      chunks.push(currentChunk);
    }
  } else if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks.map((chunk) => ({
    ...createCitation(),
    text: chunk,
  }));
}

/**
 * Truncate text and split into chunks
 */
export function truncateAndGetChunks(
  text: string,
  options?: ChunkOptions,
): { chunks: ContentChunk[]; truncated: boolean } {
  let truncated = false;

  if (text.length > MAX_TOTAL_CHARS) {
    text = text.slice(0, MAX_TOTAL_CHARS);
    truncated = true;
  }

  const chunks = getSmartChunks(text, options);
  return { chunks, truncated };
}
