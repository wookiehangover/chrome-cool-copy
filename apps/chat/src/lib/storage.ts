import type { UIMessage } from "ai";

/**
 * Conversation session stored in chrome.storage.local
 */
export interface ConversationSession {
  id: string;
  title: string;
  messages: UIMessage[];
  createdAt: number;
  updatedAt: number;
  messageCount: number; // Track message count for title regeneration logic
}

/**
 * Storage keys
 */
const STORAGE_KEY = "chat_sessions";
const CURRENT_SESSION_KEY = "current_session_id";

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Get all conversation sessions from storage
 */
export async function getAllSessions(): Promise<ConversationSession[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const sessions = (result[STORAGE_KEY] as ConversationSession[]) || [];
      // Sort by updatedAt descending (most recent first)
      sessions.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(sessions);
    });
  });
}

/**
 * Get a specific session by ID
 */
export async function getSession(sessionId: string): Promise<ConversationSession | null> {
  const sessions = await getAllSessions();
  return sessions.find((s) => s.id === sessionId) || null;
}

/**
 * Save a session to storage
 */
export async function saveSession(session: ConversationSession): Promise<void> {
  const sessions = await getAllSessions();
  const existingIndex = sessions.findIndex((s) => s.id === session.id);

  if (existingIndex >= 0) {
    sessions[existingIndex] = session;
  } else {
    sessions.push(session);
  }

  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: sessions }, () => {
      resolve();
    });
  });
}

/**
 * Delete a session from storage
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const sessions = await getAllSessions();
  const filtered = sessions.filter((s) => s.id !== sessionId);

  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: filtered }, () => {
      resolve();
    });
  });
}

/**
 * Get the current session ID
 */
export async function getCurrentSessionId(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get([CURRENT_SESSION_KEY], (result) => {
      resolve((result[CURRENT_SESSION_KEY] as string) || null);
    });
  });
}

/**
 * Set the current session ID
 */
export async function setCurrentSessionId(sessionId: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [CURRENT_SESSION_KEY]: sessionId }, () => {
      resolve();
    });
  });
}

/**
 * Create a new session with default values
 */
export function createNewSession(): ConversationSession {
  const now = Date.now();
  return {
    id: generateSessionId(),
    title: "New Chat",
    messages: [],
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
  };
}

/**
 * Update session messages and metadata
 */
export async function updateSessionMessages(
  sessionId: string,
  messages: UIMessage[],
  title?: string,
): Promise<ConversationSession | null> {
  const session = await getSession(sessionId);
  if (!session) return null;

  const userMessages = messages.filter((m) => m.role === "user").length;
  const updatedSession: ConversationSession = {
    ...session,
    messages,
    updatedAt: Date.now(),
    messageCount: userMessages,
    ...(title && { title }),
  };

  await saveSession(updatedSession);
  return updatedSession;
}
