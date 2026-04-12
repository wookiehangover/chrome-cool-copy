/**
 * Type declarations for dynamically imported database module
 */

import type { AgentDBConfig, Webpage, WebpageRow } from "@repo/shared";

export type { AgentDBConfig, Webpage, WebpageRow } from "@repo/shared";

export function initializeDatabase(config: AgentDBConfig): Promise<void>;
export function getWebpages(): Promise<WebpageRow[]>;
export function deleteWebpage(id: string): Promise<void>;
