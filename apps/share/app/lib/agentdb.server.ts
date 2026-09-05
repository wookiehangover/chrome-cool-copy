/**
 * AgentDB Server-Side Client for Share App
 * Handles fetching clips by share_id from the AgentDB database on the server
 */

import { DatabaseService, DatabaseConnection } from "@agentdb/sdk";
import { nanoid } from "nanoid";
import type { AgentDBConfig, JSONValue, WebpageRow } from "@repo/shared";

/**
 * Shared clip type for share app rendering and lookup
 */
export type SharedClip = WebpageRow & {
  id: number;
  share_id: string;
  dom_content: string;
  captured_at: string;
};

/**
 * Lightweight clip interface for list operations
 * Contains only essential fields without heavy content
 */
export interface LightweightClip {
  id: number;
  share_id: string | null;
  title: string;
  url: string;
  captured_at: string;
}

type DatabaseConfig = AgentDBConfig;

function readField(value: JSONValue, key: string): JSONValue | undefined {
  return Object.getOwnPropertyDescriptor(Object(value), key)?.value;
}

function readString(value: JSONValue | undefined): string | undefined {
  return Object.prototype.toString.call(value) === "[object String]" ? String(value) : undefined;
}

function readNumber(value: JSONValue | undefined): number | undefined {
  return Object.prototype.toString.call(value) === "[object Number]" ? Number(value) : undefined;
}

function readNullableString(value: JSONValue | undefined): string | null | undefined {
  return value === null ? null : readString(value);
}

function readNullableNumber(value: JSONValue | undefined): number | null | undefined {
  return value === null ? null : readNumber(value);
}

type ParsedWebpageClip = Omit<SharedClip, "share_id"> & { share_id: string | null };

function parseWebpageClip(value: JSONValue): ParsedWebpageClip | null {
  const id = readNumber(readField(value, "id"));
  const shareId = readNullableString(readField(value, "share_id"));
  const url = readString(readField(value, "url"));
  const title = readString(readField(value, "title"));
  const domContent = readString(readField(value, "dom_content"));
  const textContent = readString(readField(value, "text_content"));
  const capturedAt = readString(readField(value, "captured_at"));
  const highlights = readNullableString(readField(value, "highlights"));
  if (
    id === undefined ||
    shareId === undefined ||
    !url ||
    !title ||
    domContent === undefined ||
    textContent === undefined ||
    !capturedAt ||
    highlights === undefined
  ) {
    return null;
  }
  return {
    id,
    share_id: shareId,
    url,
    title,
    dom_content: domContent,
    text_content: textContent,
    captured_at: capturedAt,
    highlights,
  };
}

function parseLightweightClip(value: JSONValue): LightweightClip | null {
  const id = readNumber(readField(value, "id"));
  const shareId = readNullableString(readField(value, "share_id"));
  const title = readString(readField(value, "title"));
  const url = readString(readField(value, "url"));
  const capturedAt = readString(readField(value, "captured_at"));
  return id !== undefined && shareId !== undefined && title && url && capturedAt
    ? { id, share_id: shareId, title, url, captured_at: capturedAt }
    : null;
}

let dbService: DatabaseService | null = null;
let dbConnection: DatabaseConnection | null = null;

/**
 * Get database configuration from environment variables
 * Uses process.env for server-side environment variables
 * @returns Database configuration object
 */
export function getConfig(): DatabaseConfig {
  const baseUrl = process.env.AGENTDB_BASE_URL;
  const apiKey = process.env.AGENTDB_API_KEY;
  const token = process.env.AGENTDB_TOKEN;
  const dbName = process.env.AGENTDB_DB_NAME;

  if (!baseUrl || !apiKey || !token || !dbName) {
    throw new Error(
      "Missing required AgentDB environment variables. " +
        "Please set AGENTDB_BASE_URL, AGENTDB_API_KEY, AGENTDB_TOKEN, and AGENTDB_DB_NAME",
    );
  }

  return {
    baseUrl,
    apiKey,
    token,
    dbName,
    dbType: "sqlite",
  };
}

/**
 * Initialize the database connection
 * @returns Promise that resolves when connection is established
 */
async function initializeConnection(): Promise<void> {
  if (dbConnection) {
    return;
  }

  try {
    const config = getConfig();
    dbService = new DatabaseService(config.baseUrl, config.apiKey);
    dbConnection = dbService.connect(config.token, config.dbName, config.dbType);
    console.log("[AgentDB] Server connection initialized");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to initialize AgentDB connection: ${message}`);
  }
}

/**
 * Fetch a clip by share_id from the webpages table
 * @param shareId - The share_id to query
 * @returns The clip data or null if not found
 */
export async function getClipByShareId(shareId: string): Promise<SharedClip | null> {
  try {
    await initializeConnection();

    if (!dbConnection) {
      throw new Error("Database connection not initialized");
    }

    const result = await dbConnection.execute({
      sql: "SELECT * FROM webpages WHERE share_id = ? LIMIT 1",
      params: [shareId],
    });

    const rows = result.results[0]?.rows || [];

    if (rows.length === 0) {
      console.log("[AgentDB] Clip not found for share_id:", shareId);
      return null;
    }

    console.log("[AgentDB] Clip retrieved for share_id:", shareId);
    const clip = parseWebpageClip(rows[0]);
    return clip?.share_id ? { ...clip, share_id: clip.share_id } : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch clip by share_id: ${message}`);
  }
}

/**
 * Fetch all clips from the webpages table
 * @returns Array of lightweight clip data ordered by captured_at descending
 */
export async function getAllClips(): Promise<LightweightClip[]> {
  try {
    await initializeConnection();

    if (!dbConnection) {
      throw new Error("Database connection not initialized");
    }

    const result = await dbConnection.execute({
      sql: "SELECT id, share_id, title, url, captured_at FROM webpages ORDER BY captured_at DESC",
      params: [],
    });

    const rows = result.results[0]?.rows || [];

    console.log("[AgentDB] Retrieved", rows.length, "clips");
    return rows.map(parseLightweightClip).filter((clip) => clip !== null);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch all clips: ${message}`);
  }
}

/**
 * Share a clip by generating or retrieving its share_id
 * If the clip already has a share_id, it's returned
 * If not, a new share_id is generated and the clip is updated
 * @param identifier - Either the database ID (number) or URL (string) of the clip
 * @returns The share_id for the clip, or null if clip not found
 */
export async function shareClip(identifier: number): Promise<string | null> {
  try {
    await initializeConnection();

    if (!dbConnection) {
      throw new Error("Database connection not initialized");
    }

    // Determine if identifier is an ID or URL
    const query = "SELECT * FROM webpages WHERE id = ? LIMIT 1";
    const params = [identifier];

    const result = await dbConnection.execute({
      sql: query,
      params,
    });

    const rows = result.results[0]?.rows || [];

    if (rows.length === 0) {
      console.log("[AgentDB] Clip not found for identifier:", identifier);
      return null;
    }

    const clip = parseWebpageClip(rows[0]);
    if (!clip) throw new Error("AgentDB returned an invalid webpage row");

    // If clip already has a share_id, return it
    if (clip.share_id) {
      console.log("[AgentDB] Clip already has share_id:", clip.share_id);
      return clip.share_id;
    }

    // Generate a new share_id
    const shareId = nanoid(10);

    // Update the clip with the new share_id
    await dbConnection.execute({
      sql: "UPDATE webpages SET share_id = ?, updated_at = ? WHERE id = ?",
      params: [shareId, new Date().toISOString(), clip.id],
    });

    console.log("[AgentDB] Generated share_id for clip:", clip.id, shareId);
    return shareId;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to share clip: ${message}`);
  }
}

/**
 * Media clip input for saving to database
 */
export interface MediaClipInput {
  id: string;
  blob_url: string;
  original_filename?: string;
  mimetype: string;
  file_size?: number;
  width?: number;
  height?: number;
  alt_text?: string;
  page_url: string;
  page_title?: string;
}

/**
 * Save a media clip to the media_clips table
 * @param clip - The media clip data to save
 * @returns Promise that resolves when the clip is saved
 */
export async function saveMediaClip(clip: MediaClipInput): Promise<void> {
  try {
    await initializeConnection();

    if (!dbConnection) {
      throw new Error("Database connection not initialized");
    }

    const now = new Date().toISOString();

    await dbConnection.execute({
      sql: `INSERT INTO media_clips (
        id, blob_url, original_filename, mimetype, file_size,
        width, height, alt_text, page_url, page_title,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        clip.id,
        clip.blob_url,
        clip.original_filename ?? null,
        clip.mimetype,
        clip.file_size ?? null,
        clip.width ?? null,
        clip.height ?? null,
        clip.alt_text ?? null,
        clip.page_url,
        clip.page_title ?? null,
        now,
        now,
      ],
    });

    console.log("[AgentDB] Media clip saved:", clip.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to save media clip: ${message}`);
  }
}

/**
 * Media clip interface matching the media_clips table schema
 */
export interface MediaClip {
  id: string;
  blob_url: string;
  original_filename: string | null;
  mimetype: string;
  file_size: number | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  page_url: string;
  page_title: string | null;
  ai_description: string | null;
  ai_description_status: string;
  created_at: string;
}

function parseMediaClip(value: JSONValue): MediaClip | null {
  const id = readString(readField(value, "id"));
  const blobUrl = readString(readField(value, "blob_url"));
  const originalFilename = readNullableString(readField(value, "original_filename"));
  const mimetype = readString(readField(value, "mimetype"));
  const fileSize = readNullableNumber(readField(value, "file_size"));
  const width = readNullableNumber(readField(value, "width"));
  const height = readNullableNumber(readField(value, "height"));
  const altText = readNullableString(readField(value, "alt_text"));
  const pageUrl = readString(readField(value, "page_url"));
  const pageTitle = readNullableString(readField(value, "page_title"));
  const aiDescription = readNullableString(readField(value, "ai_description"));
  const aiDescriptionStatus = readString(readField(value, "ai_description_status"));
  const createdAt = readString(readField(value, "created_at"));
  if (
    !id ||
    !blobUrl ||
    originalFilename === undefined ||
    !mimetype ||
    fileSize === undefined ||
    width === undefined ||
    height === undefined ||
    altText === undefined ||
    !pageUrl ||
    pageTitle === undefined ||
    aiDescription === undefined ||
    !aiDescriptionStatus ||
    !createdAt
  ) {
    return null;
  }
  return {
    id,
    blob_url: blobUrl,
    original_filename: originalFilename,
    mimetype,
    file_size: fileSize,
    width,
    height,
    alt_text: altText,
    page_url: pageUrl,
    page_title: pageTitle,
    ai_description: aiDescription,
    ai_description_status: aiDescriptionStatus,
    created_at: createdAt,
  };
}

/**
 * Fetch paginated media clips from the media_clips table
 * @param options - Pagination options with limit and offset
 * @returns Object containing clips array and total count
 */
export async function getMediaClips(options: {
  limit: number;
  offset: number;
}): Promise<{ clips: MediaClip[]; total: number }> {
  await initializeConnection();

  if (!dbConnection) {
    throw new Error("Database connection not initialized");
  }

  // Get total count
  const countResult = await dbConnection.execute({
    sql: "SELECT COUNT(*) as count FROM media_clips",
    params: [],
  });
  const total = readNumber(readField(countResult.results[0]?.rows?.[0], "count")) ?? 0;

  // Get paginated clips
  const result = await dbConnection.execute({
    sql: `SELECT id, blob_url, original_filename, mimetype, file_size, width, height,
          alt_text, page_url, page_title, ai_description, ai_description_status, created_at
          FROM media_clips ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    params: [options.limit, options.offset],
  });

  return {
    clips: (result.results[0]?.rows || []).map(parseMediaClip).filter((clip) => clip !== null),
    total,
  };
}

/**
 * Fetch a single media clip by ID
 * @param id - The media clip ID
 * @returns The media clip or null if not found
 */
export async function getMediaClipById(id: string): Promise<MediaClip | null> {
  try {
    await initializeConnection();

    if (!dbConnection) {
      throw new Error("Database connection not initialized");
    }

    const result = await dbConnection.execute({
      sql: `SELECT id, blob_url, original_filename, mimetype, file_size, width, height,
            alt_text, page_url, page_title, ai_description, ai_description_status, created_at
            FROM media_clips WHERE id = ? LIMIT 1`,
      params: [id],
    });

    const rows = result.results[0]?.rows || [];

    if (rows.length === 0) {
      console.log("[AgentDB] Media clip not found for id:", id);
      return null;
    }

    console.log("[AgentDB] Media clip retrieved for id:", id);
    return parseMediaClip(rows[0]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch media clip by id: ${message}`);
  }
}

/**
 * Update AI description for a media clip
 * @param id - The media clip ID
 * @param description - The AI-generated description (null if error)
 * @param status - The new status: 'processing', 'complete', or 'error'
 */
export async function updateMediaClipAIDescription(
  id: string,
  description: string | null,
  status: "pending" | "processing" | "complete" | "error",
): Promise<void> {
  try {
    await initializeConnection();

    if (!dbConnection) {
      throw new Error("Database connection not initialized");
    }

    const now = new Date().toISOString();

    await dbConnection.execute({
      sql: `UPDATE media_clips
            SET ai_description = ?, ai_description_status = ?, updated_at = ?
            WHERE id = ?`,
      params: [description, status, now, id],
    });

    console.log("[AgentDB] Media clip AI description updated:", id, status);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to update media clip AI description: ${message}`);
  }
}

/**
 * Delete a media clip by ID
 * @param id - The media clip ID to delete
 * @returns true if a row was deleted, false if not found
 */
export async function deleteMediaClip(id: string): Promise<boolean> {
  try {
    await initializeConnection();

    if (!dbConnection) {
      throw new Error("Database connection not initialized");
    }

    const result = await dbConnection.execute({
      sql: "DELETE FROM media_clips WHERE id = ?",
      params: [id],
    });

    const rowsAffected = result.results[0]?.changes ?? 0;

    if (rowsAffected === 0) {
      console.log("[AgentDB] Media clip not found for deletion, id:", id);
      return false;
    }

    console.log("[AgentDB] Media clip deleted:", id);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to delete media clip: ${message}`);
  }
}
