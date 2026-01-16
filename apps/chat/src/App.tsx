import { useCallback, useEffect } from "react";
import { ChatProvider, useChatContext } from "@/contexts/ChatContext";
import { NavigationProvider, useNavigationContext } from "@/contexts/NavigationContext";
import { Conversation, ConversationContent } from "@/components/ai-elements/conversation";
import { ChatHeader } from "@/components/ChatHeader";
import { ChatInput } from "@/components/ChatInput";
import { MessageList } from "@/components/MessageList";
import { EmptyState } from "@/components/EmptyState";
import { SessionList } from "@/components/SessionList";
import { Navigation } from "@/components/Navigation";
import { BoostsList } from "@/components/BoostsList";
import { BoostCreate } from "@/components/BoostCreate";

function ChatContent() {
  const {
    messages,
    clearMessages,
    randomStrategy,
    currentSession,
    sessions,
    loadSession,
    startNewSession,
    deleteSessionById,
    showSessionList,
    setShowSessionList,
    isAppLoading,
  } = useChatContext();

  const { path, navigate } = useNavigationContext();

  // Listen for external navigation messages from background script
  useEffect(() => {
    const handleMessage = (
      message: any,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void,
    ) => {
      if (message.action === "navigate") {
        console.log("[SidePanel] Received navigation message:", message.path, message.params);
        navigate(message.path, message.params);
        sendResponse({ success: true });
        return true; // Indicates async response
      }
      return false;
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [navigate]);

  const handleNewChat = useCallback(async () => {
    await startNewSession();
    clearMessages();
    setShowSessionList(false);
  }, [startNewSession, clearMessages, setShowSessionList]);

  const handleSelectSession = useCallback(
    async (sessionId: string) => {
      await loadSession(sessionId);
      setShowSessionList(false);
    },
    [loadSession, setShowSessionList],
  );

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      await deleteSessionById(sessionId);
    },
    [deleteSessionById],
  );

  const handleOpenSessions = useCallback(() => {
    setShowSessionList(true);
  }, [setShowSessionList]);

  const handleCloseSessions = useCallback(() => {
    setShowSessionList(false);
  }, [setShowSessionList]);

  // Render based on current path
  if (path === "/boosts") {
    return (
      <div className="flex h-screen w-full flex-col bg-background text-foreground">
        <Navigation />
        <BoostsList />
      </div>
    );
  }

  if (path === "/boosts/create") {
    return (
      <div className="flex h-screen w-full flex-col bg-background text-foreground">
        <Navigation />
        <BoostCreate />
      </div>
    );
  }

  // Default /chat view
  // Show session list view
  if (showSessionList) {
    return (
      <div className="flex h-screen w-full flex-col bg-background text-foreground">
        <Navigation />
        <SessionList
          sessions={sessions}
          currentSessionId={currentSession?.id || null}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onNewChat={handleNewChat}
          onClose={handleCloseSessions}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground">
      <Navigation />
      <ChatHeader
        title={currentSession?.title || "Chat"}
        onOpenSessions={handleOpenSessions}
        onNewChat={handleNewChat}
      />

      {isAppLoading ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-sm text-muted-foreground">Loading page context...</p>
        </div>
      ) : (
        <Conversation className="flex-1">
          <ConversationContent className="gap-4 px-4 py-4">
            {messages.length === 0 ? <EmptyState strategy={randomStrategy} /> : <MessageList />}
          </ConversationContent>
        </Conversation>
      )}

      <ChatInput />
    </div>
  );
}

function App() {
  return (
    <NavigationProvider>
      <ChatProvider>
        <ChatContent />
      </ChatProvider>
    </NavigationProvider>
  );
}

export default App;
