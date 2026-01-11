import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import type { UIMessage } from 'ai'
import { useExtensionChat } from '@/hooks/useExtensionChat'
import { useConversationStore } from '@/hooks/useConversationStore'
import { usePageContext } from '@/hooks/usePageContext'
import type { PageContext, ModelId } from '@repo/shared'
import { getRandomStrategy } from '@/constants/oblique-strategies'

interface ChatContextValue {
  // Input state
  input: string
  setInput: (value: string) => void

  // Model selection
  selectedModel: ModelId
  setSelectedModel: (model: ModelId) => void

  // Chat state from useExtensionChat
  messages: UIMessage[]
  sendMessage: (message: { parts: Array<{ type: 'text'; text: string }> }) => void
  status: 'streaming' | 'submitted' | 'ready' | 'error'
  error: Error | null | undefined
  clearMessages: () => void
  getMessageContent: (message: UIMessage) => string
  isLoading: boolean
  reasoning: string
  isReasoningStreaming: boolean

  // Page context
  pageContext: PageContext | null
  isLoadingContext: boolean
  clearContext: () => void

  // Session management
  currentSession: ReturnType<typeof useConversationStore>['currentSession']
  sessions: ReturnType<typeof useConversationStore>['sessions']
  isLoadingStore: boolean
  loadSession: (sessionId: string) => Promise<void>
  startNewSession: () => Promise<ReturnType<typeof useConversationStore>['currentSession']>
  deleteSessionById: (sessionId: string) => Promise<void>

  // UI state
  showSessionList: boolean
  setShowSessionList: (show: boolean) => void
  randomStrategy: string

  // Derived state
  isAppLoading: boolean
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function useChatContext() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider')
  }
  return context
}

interface ChatProviderProps {
  children: ReactNode
}

export function ChatProvider({ children }: ChatProviderProps) {
  const [input, setInput] = useState('')
  const [showSessionList, setShowSessionList] = useState(false)
  const [selectedModel, setSelectedModel] = useState<ModelId>('anthropic/claude-sonnet-4.5')

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
    model: selectedModel,
    initialMessages: currentSession?.messages,
    onFinish: handleFinish,
  })

  // Get a random strategy when session changes
  const randomStrategy = useMemo(() => getRandomStrategy(), [currentSession?.id])

  const isAppLoading = isLoadingContext || isLoadingStore

  const value: ChatContextValue = {
    input,
    setInput,
    selectedModel,
    setSelectedModel,
    messages,
    sendMessage,
    status,
    error,
    clearMessages,
    getMessageContent,
    isLoading,
    reasoning,
    isReasoningStreaming,
    pageContext,
    isLoadingContext,
    clearContext,
    currentSession,
    sessions,
    isLoadingStore,
    loadSession,
    startNewSession,
    deleteSessionById,
    showSessionList,
    setShowSessionList,
    randomStrategy,
    isAppLoading,
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

