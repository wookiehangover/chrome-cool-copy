/**
 * Database Service Module
 * Handles all AgentDB operations for webpage storage and retrieval
 */

import { DatabaseService, DatabaseConnection, ExecuteResult } from "@agentdb/sdk";
import type { AgentDBConfig, Webpage, WebpageRow } from "@repo/shared";
import { z } from "zod";

export type { Webpage, WebpageRow };

let dbService: DatabaseService | null = null;
let dbConnection: DatabaseConnection | null = null;
let config: AgentDBConfig | null = null;
const webpageRowSchema: z.ZodType<WebpageRow> = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  url: z.string(),
  title: z.string(),
  dom_content: z.string().optional(),
  text_content: z.string(),
  metadata: z.string().nullable().optional(),
  highlights: z.string().nullable().optional(),
  status_code: z.number().nullable().optional(),
  content_type: z.string().nullable().optional(),
  content_length: z.number().nullable().optional(),
  last_modified: z.string().nullable().optional(),
  captured_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  share_id: z.string().nullable().optional(),
});
const countRowSchema = z.object({ count: z.number() });

/**
 * Initialize the database connection
 * @param configuration - Database configuration with baseUrl, apiKey, token, and dbName
 */
export async function initializeDatabase(configuration: AgentDBConfig): Promise<void> {
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
export async function getWebpages(): Promise<WebpageRow[]> {
  const connection = ensureInitialized();

  try {
    const result = await connection.execute({
      sql: "SELECT * FROM webpages ORDER BY created_at DESC",
      params: [],
    });

    const rows = result.results[0]?.rows || [];
    console.log("[Database] Retrieved", rows.length, "webpages");
    return z.array(webpageRowSchema).parse(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to retrieve webpages: ${message}`);
  }
}

/**
 * Get a batch of webpages with pagination
 * @param offset - Number of rows to skip
 * @param limit - Maximum number of rows to return
 * @returns Array of webpages for the given page
 */
export async function getWebpagesBatch(offset: number, limit: number): Promise<WebpageRow[]> {
  const connection = ensureInitialized();

  try {
    const result = await connection.execute({
      sql: "SELECT id, url, title, text_content, metadata, highlights, status_code, content_type, content_length, last_modified, captured_at, created_at, updated_at, share_id FROM webpages ORDER BY created_at DESC LIMIT ? OFFSET ?",
      params: [limit, offset],
    });

    const rows = result.results[0]?.rows || [];
    console.log(
      "[Database] Retrieved",
      rows.length,
      "webpages (offset:",
      offset,
      "limit:",
      limit,
      ")",
    );
    return z.array(webpageRowSchema).parse(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to retrieve webpages batch: ${message}`);
  }
}

/**
 * Get the total count of webpages in the database
 * @returns Total number of webpages
 */
export async function getWebpagesCount(): Promise<number> {
  const connection = ensureInitialized();

  try {
    const result = await connection.execute({
      sql: "SELECT COUNT(*) as count FROM webpages",
      params: [],
    });

    const rows = result.results[0]?.rows || [];
    const count = rows.length > 0 ? countRowSchema.parse(rows[0]).count : 0;
    console.log("[Database] Total webpages count:", count);
    return count;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to retrieve webpages count: ${message}`);
  }
}

/**
 * Get a single webpage by ID
 * @param id - The webpage ID
 * @returns The webpage or null if not found
 */
export async function getWebpage(id: string): Promise<WebpageRow | null> {
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
    return webpageRowSchema.parse(rows[0]);
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
export async function getWebpageByShareId(shareId: string): Promise<WebpageRow | null> {
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
    return webpageRowSchema.parse(rows[0]);
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
