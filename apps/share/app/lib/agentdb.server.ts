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
