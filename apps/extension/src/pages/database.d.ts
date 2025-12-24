/**
 * Type declarations for dynamically imported database module
 */

export interface AgentDBConfig {
  baseUrl: string;
  apiKey: string;
  token: string;
  dbName: string;
  dbType: string;
}

export interface Webpage {
  id: string;
  title?: string;
  url: string;
  text_content?: string;
  created_at?: string;
}

export function initializeDatabase(config: AgentDBConfig): Promise<void>;
export function getWebpages(): Promise<Webpage[]>;
export function deleteWebpage(id: string): Promise<void>;
