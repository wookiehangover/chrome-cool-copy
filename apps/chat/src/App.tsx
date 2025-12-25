import { useState, useCallback, useMemo } from 'react'
import { useExtensionChat } from './hooks/useExtensionChat'
import { useConversationStore } from './hooks/useConversationStore'
import { usePageContext } from './hooks/usePageContext'
import {
  Conversation,
  ConversationContent,
} from '@/components/ai-elements/conversation'
import { ChatHeader } from '@/components/ChatHeader'
import { ChatInput } from '@/components/ChatInput'
import { MessageList } from '@/components/MessageList'
import { EmptyState } from '@/components/EmptyState'
import { SessionList } from '@/components/SessionList'
import { getRandomStrategy } from '@/constants/oblique-strategies'

function App() {
  const [input, setInput] = useState('')
  const [showSessionList, setShowSessionList] = useState(false)

  // Page context from the active tab
  const { pageContext, isLoading: isLoadingContext, clearContext } = usePageContext()

  // Conversation store for persistence
  const {
    currentSession,
    sessions,
    isLoading: isLoadingStore,
    loadSession,
    startNewSession,
    deleteSessionById,
    persistMessages,
  } = useConversationStore()

  // Handle message persistence
  const handleFinish = useCallback(
    (messages: Parameters<typeof persistMessages>[0]) => {
      persistMessages(messages)
    },
    [persistMessages]
  )

  const {
    messages,
    sendMessage,
    isLoading,
    error,
    clearMessages,
    status,
    getMessageContent,
    reasoning,
    isReasoningStreaming,
  } = useExtensionChat({
    pageContext,
    initialMessages: currentSession?.messages,
    onFinish: handleFinish,
  })

  // Get a random strategy when session changes
  const randomStrategy = useMemo(() => getRandomStrategy(), [currentSession?.id])

  const handleSubmit = useCallback(
    ({ text }: { text: string }) => {
      if (!text.trim()) return
      setInput('')
      sendMessage({ parts: [{ type: 'text', text }] })
    },
    [sendMessage]
  )

  const handleNewChat = useCallback(async () => {
    await startNewSession()
    clearMessages()
    setShowSessionList(false)
  }, [startNewSession, clearMessages])

  const handleSelectSession = useCallback(
    async (sessionId: string) => {
      await loadSession(sessionId)
      setShowSessionList(false)
    },
    [loadSession]
  )

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      await deleteSessionById(sessionId)
    },
    [deleteSessionById]
  )

  const handleOpenSessions = useCallback(() => {
    setShowSessionList(true)
  }, [])

  const handleCloseSessions = useCallback(() => {
    setShowSessionList(false)
  }, [])

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

  const isAppLoading = isLoadingContext || isLoadingStore

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
              <MessageList
                messages={messages}
                reasoning={reasoning}
                isReasoningStreaming={isReasoningStreaming}
                getMessageContent={getMessageContent}
                error={error}
              />
            )}
          </ConversationContent>
        </Conversation>
      )}

      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        pageContext={pageContext}
        onClearContext={clearContext}
        isLoading={isLoading}
        isDisabled={isLoadingContext}
        status={status}
      />
    </div>
  )
}

export default App

