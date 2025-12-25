import { useCallback } from 'react'
import { ChatProvider, useChatContext } from '@/contexts/ChatContext'
import {
  Conversation,
  ConversationContent,
} from '@/components/ai-elements/conversation'
import { ChatHeader } from '@/components/ChatHeader'
import { ChatInput } from '@/components/ChatInput'
import { MessageList } from '@/components/MessageList'
import { EmptyState } from '@/components/EmptyState'
import { SessionList } from '@/components/SessionList'

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
  } = useChatContext()

  const handleNewChat = useCallback(async () => {
    await startNewSession()
    clearMessages()
    setShowSessionList(false)
  }, [startNewSession, clearMessages, setShowSessionList])

  const handleSelectSession = useCallback(
    async (sessionId: string) => {
      await loadSession(sessionId)
      setShowSessionList(false)
    },
    [loadSession, setShowSessionList]
  )

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      await deleteSessionById(sessionId)
    },
    [deleteSessionById]
  )

  const handleOpenSessions = useCallback(() => {
    setShowSessionList(true)
  }, [setShowSessionList])

  const handleCloseSessions = useCallback(() => {
    setShowSessionList(false)
  }, [setShowSessionList])

  // Show session list view
  if (showSessionList) {
    return (
      <div className="flex h-screen w-full flex-col bg-background text-foreground">
        <SessionList
          sessions={sessions}
          currentSessionId={currentSession?.id || null}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onNewChat={handleNewChat}
          onClose={handleCloseSessions}
        />
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground">
      <ChatHeader
        title={currentSession?.title || 'Chat'}
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
            {messages.length === 0 ? (
              <EmptyState strategy={randomStrategy} />
            ) : (
              <MessageList />
            )}
          </ConversationContent>
        </Conversation>
      )}

      <ChatInput />
    </div>
  )
}

function App() {
  return (
    <ChatProvider>
      <ChatContent />
    </ChatProvider>
  )
}

export default App

