/**
 * AgentDB Server-Side Client for Share App
 * Handles fetching clips by share_id from the AgentDB database on the server
 */

import { DatabaseService, DatabaseConnection } from "@agentdb/sdk";

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
  captured_at: string;
  status_code?: number;
  content_type?: string;
  content_length?: number;
  last_modified?: string;
  created_at?: string;
  updated_at?: string;
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
        "Please set AGENTDB_BASE_URL, AGENTDB_API_KEY, AGENTDB_TOKEN, and AGENTDB_DB_NAME"
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
