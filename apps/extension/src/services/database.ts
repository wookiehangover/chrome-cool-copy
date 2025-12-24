/**
 * Database Service Module
 * Handles all AgentDB operations for webpage storage and retrieval
 */

import { DatabaseService, DatabaseConnection, ExecuteResult } from "@agentdb/sdk";

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
  status_code?: number;
  content_type?: string;
  content_length?: number;
  last_modified?: string;
  captured_at?: string;
  created_at?: string;
  updated_at?: string;
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
        url, title, dom_content, text_content, metadata, 
        status_code, content_type, content_length, last_modified, captured_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        webpage.url,
        webpage.title,
        webpage.dom_content,
        webpage.text_content,
        webpage.metadata ? JSON.stringify(webpage.metadata) : null,
        webpage.status_code || null,
        webpage.content_type || null,
        webpage.content_length || null,
        webpage.last_modified || null,
        webpage.captured_at || new Date().toISOString(),
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
