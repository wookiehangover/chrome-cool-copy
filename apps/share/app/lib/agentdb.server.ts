/**
 * AgentDB Server-Side Client for Share App
 * Handles fetching clips by share_id from the AgentDB database on the server
 */

import { DatabaseService, DatabaseConnection } from "@agentdb/sdk";
import { nanoid } from "nanoid";

/**
 * Shared clip interface matching the webpages table schema
 */
export interface SharedClip {
  id: number;
  share_id: string;
  url: string;
  title: string;
  dom_content: string;
  text_content: string;
  metadata?: string;
  highlights?: string; // JSON string containing serialized Highlight objects
  captured_at: string;
  status_code?: number;
  content_type?: string;
  content_length?: number;
  last_modified?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Lightweight clip interface for list operations
 * Contains only essential fields without heavy content
 */
export interface LightweightClip {
  id: number;
  share_id: string;
  title: string;
  url: string;
  captured_at: string;
}

/**
 * Database configuration interface
 */
interface DatabaseConfig {
  baseUrl: string;
  apiKey: string;
  token: string;
  dbName: string;
  dbType?: "sqlite" | "duckdb";
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
    return rows[0] as SharedClip;
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
    return rows as LightweightClip[];
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

    const clip = rows[0] as SharedClip;

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
  const total = (countResult.results[0]?.rows[0] as { count: number })?.count || 0;

  // Get paginated clips
  const result = await dbConnection.execute({
    sql: `SELECT id, blob_url, original_filename, mimetype, file_size, width, height,
          alt_text, page_url, page_title, ai_description, ai_description_status, created_at
          FROM media_clips ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    params: [options.limit, options.offset],
  });

  return {
    clips: (result.results[0]?.rows || []) as MediaClip[],
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
    return rows[0] as MediaClip;
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
