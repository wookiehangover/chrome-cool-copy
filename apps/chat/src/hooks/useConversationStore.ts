import { useState, useCallback, useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import {
  type ConversationSession,
  getAllSessions,
  getSession,
  saveSession,
  deleteSession,
  getCurrentSessionId,
  setCurrentSessionId,
  createNewSession,
  updateSessionMessages,
} from "@/lib/storage";
import { generateTitle, shouldRegenerateTitle } from "@/lib/generate-title";

interface UseConversationStoreReturn {
  // Current session state
  currentSession: ConversationSession | null;
  isLoading: boolean;

  // Sessions list
  sessions: ConversationSession[];

  // Actions
  loadSessions: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  startNewSession: () => Promise<ConversationSession>;
  deleteSessionById: (sessionId: string) => Promise<void>;

  // Message persistence
  persistMessages: (messages: UIMessage[]) => Promise<void>;
}

export function useConversationStore(): UseConversationStoreReturn {
  const [currentSession, setCurrentSession] = useState<ConversationSession | null>(null);
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Use ref to avoid stale closure in persistMessages
  const currentSessionRef = useRef<ConversationSession | null>(null);
  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

  // Load all sessions from storage
  const loadSessions = useCallback(async () => {
    const allSessions = await getAllSessions();
    setSessions(allSessions);
  }, []);

  // Load sessions and create a new session on open
  const initializeStore = useCallback(async () => {
    setIsLoading(true);
    try {
      await loadSessions();

      // Always start with a new session when chat is opened
      const newSession = createNewSession();
      await saveSession(newSession);
      await setCurrentSessionId(newSession.id);
      setCurrentSession(newSession);
      await loadSessions();
    } finally {
      setIsLoading(false);
    }
  }, [loadSessions]);

  // Initialize on mount
  useEffect(() => {
    initializeStore();
  }, [initializeStore]);

  // Load a specific session
  const loadSession = useCallback(async (sessionId: string) => {
    const session = await getSession(sessionId);
    if (session) {
      setCurrentSession(session);
      await setCurrentSessionId(sessionId);
    }
  }, []);

  // Start a new session
  const startNewSession = useCallback(async () => {
    const newSession = createNewSession();
    await saveSession(newSession);
    await setCurrentSessionId(newSession.id);
    setCurrentSession(newSession);
    await loadSessions();
    return newSession;
  }, [loadSessions]);

  // Delete a session
  const deleteSessionById = useCallback(
    async (sessionId: string) => {
      await deleteSession(sessionId);

      // If we deleted the current session, start a new one
      if (currentSession?.id === sessionId) {
        await startNewSession();
      } else {
        await loadSessions();
      }
    },
    [currentSession, startNewSession, loadSessions],
  );

  // Persist messages and handle title generation
  const persistMessages = useCallback(
    async (messages: UIMessage[]) => {
      // Use ref to get current session to avoid stale closure
      const session = currentSessionRef.current;
      if (!session) {
        console.log("[ConversationStore] No current session, skipping persist");
        return;
      }

      console.log(
        "[ConversationStore] Persisting messages:",
        messages.length,
        "for session:",
        session.id,
      );

      const userMessageCount = messages.filter((m) => m.role === "user").length;
      const previousCount = session.messageCount;

      console.log(
        "[ConversationStore] User messages:",
        userMessageCount,
        "previous:",
        previousCount,
      );

      // Determine if we need to regenerate the title
      const needsTitleRegen =
        userMessageCount > previousCount && shouldRegenerateTitle(userMessageCount);

      console.log("[ConversationStore] Needs title regen:", needsTitleRegen);

      let newTitle = session.title;
      if (needsTitleRegen) {
        try {
          console.log("[ConversationStore] Generating title...");
          newTitle = await generateTitle(messages);
          console.log("[ConversationStore] Generated title:", newTitle);
        } catch (error) {
          console.error("[ConversationStore] Title generation failed:", error);
        }
      }

      // Update the session
      const updatedSession = await updateSessionMessages(session.id, messages, newTitle);

      if (updatedSession) {
        console.log("[ConversationStore] Session updated, new title:", updatedSession.title);
        setCurrentSession(updatedSession);
        await loadSessions();
      }
    },
    [loadSessions],
  );

  return {
    currentSession,
    isLoading,
    sessions,
    loadSessions,
    loadSession,
    startNewSession,
    deleteSessionById,
    persistMessages,
  };
}
