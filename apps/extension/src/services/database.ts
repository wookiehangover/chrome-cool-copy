/**
 * Database Service Module
 * Handles all AgentDB operations for webpage storage and retrieval
 */

import { DatabaseService, DatabaseConnection, ExecuteResult } from "@agentdb/sdk";
import type { Highlight } from "@repo/shared";

/**
 * Webpage data interface matching the database schema
 */
export interface Webpage {
  id?: string;
  url: string;
  title: string;
  dom_content: string;
  text_content: string;
  metadata?: Record<string, unknown>;
  highlights?: Highlight[];
  status_code?: number;
  content_type?: string;
  content_length?: number;
  last_modified?: string;
  captured_at?: string;
  created_at?: string;
  updated_at?: string;
  share_id?: string;
}

/**
 * Database service configuration
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
let config: DatabaseConfig | null = null;

/**
 * Initialize the database connection
 * @param configuration - Database configuration with baseUrl, apiKey, token, and dbName
 */
export async function initializeDatabase(configuration: DatabaseConfig): Promise<void> {
  try {
    config = {
      ...configuration,
      dbType: configuration.dbType || "sqlite",
    };

    dbService = new DatabaseService(config.baseUrl, config.apiKey);
    dbConnection = dbService.connect(config.token, config.dbName, config.dbType);

    console.log("[Database] Initialized connection to", config.dbName);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to initialize database: ${message}`);
  }
}

/**
 * Ensure database is initialized
 */
function ensureInitialized(): DatabaseConnection {
  if (!dbConnection) {
    throw new Error("Database not initialized. Call initializeDatabase() first.");
  }
  return dbConnection;
}

/**
 * Save a webpage to the database
 * @param webpage - Webpage data to save
 * @returns The result of the insert operation
 */
export async function saveWebpage(webpage: Webpage): Promise<ExecuteResult> {
  const connection = ensureInitialized();

  try {
    const result = await connection.execute({
      sql: `INSERT INTO webpages (
        url, title, dom_content, text_content, metadata, highlights,
        status_code, content_type, content_length, last_modified, captured_at, share_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        webpage.url,
        webpage.title,
        webpage.dom_content,
        webpage.text_content,
        webpage.metadata ? JSON.stringify(webpage.metadata) : null,
        webpage.highlights ? JSON.stringify(webpage.highlights) : null,
        webpage.status_code || null,
        webpage.content_type || null,
        webpage.content_length || null,
        webpage.last_modified || null,
        webpage.captured_at || new Date().toISOString(),
        webpage.share_id || null,
      ],
    });

    console.log("[Database] Webpage saved:", webpage.url);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to save webpage: ${message}`);
  }
}

/**
 * Get all webpages from the database
 * @returns Array of all webpages
 */
export async function getWebpages(): Promise<Webpage[]> {
  const connection = ensureInitialized();

  try {
    const result = await connection.execute({
      sql: "SELECT * FROM webpages ORDER BY created_at DESC",
      params: [],
    });

    const rows = result.results[0]?.rows || [];
    console.log("[Database] Retrieved", rows.length, "webpages");
    return rows as Webpage[];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to retrieve webpages: ${message}`);
  }
}

/**
 * Get a single webpage by ID
 * @param id - The webpage ID
 * @returns The webpage or null if not found
 */
export async function getWebpage(id: string): Promise<Webpage | null> {
  const connection = ensureInitialized();

  try {
    const result = await connection.execute({
      sql: "SELECT * FROM webpages WHERE id = ?",
      params: [id],
    });

    const rows = result.results[0]?.rows || [];
    if (rows.length === 0) {
      console.log("[Database] Webpage not found:", id);
      return null;
    }

    console.log("[Database] Retrieved webpage:", id);
    return rows[0] as Webpage;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to retrieve webpage: ${message}`);
  }
}

/**
 * Update a webpage by share_id (used to sync highlights and other updates)
 * @param shareId - The share_id to update
 * @param updates - Partial webpage data to update
 * @returns The result of the update operation
 */
export async function updateWebpageByShareId(
  shareId: string,
  updates: Partial<Webpage>,
): Promise<ExecuteResult> {
  const connection = ensureInitialized();

  try {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (updates.url !== undefined) {
      setClauses.push("url = ?");
      params.push(updates.url);
    }
    if (updates.title !== undefined) {
      setClauses.push("title = ?");
      params.push(updates.title);
    }
    if (updates.dom_content !== undefined) {
      setClauses.push("dom_content = ?");
      params.push(updates.dom_content);
    }
    if (updates.text_content !== undefined) {
      setClauses.push("text_content = ?");
      params.push(updates.text_content);
    }
    if (updates.metadata !== undefined) {
      setClauses.push("metadata = ?");
      params.push(updates.metadata ? JSON.stringify(updates.metadata) : null);
    }
    if (updates.highlights !== undefined) {
      setClauses.push("highlights = ?");
      params.push(updates.highlights ? JSON.stringify(updates.highlights) : null);
    }
    if (updates.status_code !== undefined) {
      setClauses.push("status_code = ?");
      params.push(updates.status_code || null);
    }
    if (updates.content_type !== undefined) {
      setClauses.push("content_type = ?");
      params.push(updates.content_type || null);
    }
    if (updates.content_length !== undefined) {
      setClauses.push("content_length = ?");
      params.push(updates.content_length || null);
    }
    if (updates.last_modified !== undefined) {
      setClauses.push("last_modified = ?");
      params.push(updates.last_modified || null);
    }
    if (updates.captured_at !== undefined) {
      setClauses.push("captured_at = ?");
      params.push(updates.captured_at || null);
    }

    // Always update updated_at timestamp
    setClauses.push("updated_at = ?");
    params.push(new Date().toISOString());

    if (setClauses.length === 0) {
      throw new Error("No fields to update");
    }

    params.push(shareId);

    const result = await connection.execute({
      sql: `UPDATE webpages SET ${setClauses.join(", ")} WHERE share_id = ?`,
      params,
    });

    console.log("[Database] Webpage updated by share_id:", shareId);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to update webpage by share_id: ${message}`);
  }
}

/**
 * Get a webpage by share_id
 * @param shareId - The share_id to query
 * @returns The webpage or null if not found
 */
export async function getWebpageByShareId(shareId: string): Promise<Webpage | null> {
  const connection = ensureInitialized();

  try {
    const result = await connection.execute({
      sql: "SELECT * FROM webpages WHERE share_id = ? LIMIT 1",
      params: [shareId],
    });

    const rows = result.results[0]?.rows || [];
    if (rows.length === 0) {
      console.log("[Database] Webpage not found by share_id:", shareId);
      return null;
    }

    console.log("[Database] Retrieved webpage by share_id:", shareId);
    return rows[0] as Webpage;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to retrieve webpage by share_id: ${message}`);
  }
}

/**
 * Delete a webpage by ID
 * @param id - The webpage ID to delete
 * @returns The result of the delete operation
 */
export async function deleteWebpage(id: string): Promise<ExecuteResult> {
  const connection = ensureInitialized();

  try {
    const result = await connection.execute({
      sql: "DELETE FROM webpages WHERE id = ?",
      params: [id],
    });

    console.log("[Database] Webpage deleted:", id);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to delete webpage: ${message}`);
  }
}
