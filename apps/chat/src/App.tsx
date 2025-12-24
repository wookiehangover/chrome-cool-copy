import { useEffect, useState, useCallback, useMemo } from 'react'
import { useExtensionChat } from './hooks/useExtensionChat'
import { useConversationStore } from './hooks/useConversationStore'
import {
  Conversation,
  ConversationContent,
} from '@/components/ai-elements/conversation'
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message'
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from '@/components/ai-elements/prompt-input'
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from '@/components/ai-elements/reasoning'
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool'
import { Button } from '@/components/ui/button'
import { SessionList } from '@/components/SessionList'
import { getToolOrDynamicToolName, type DynamicToolUIPart, type ToolUIPart, type UITools } from 'ai'

const strategies =
[
    '(Organic) machinery',
    'A line has two sides',
    'A very small object         Its center',
    'Abandon desire',
    'Abandon normal instructions',
    'Abandon normal instruments',
    'Accept advice',
    'Accretion',
    'Adding on',
    'Allow an easement (an easement is the abandonment of a stricture)',
    'Always first steps',
    'Always give yourself credit for having more than personality (given by Arto Lindsay)',
    'Are there sections?  Consider transitions',
    'Ask people to work against their better judgement',
    'Ask your body',
    'Assemble some of the elements in a group and treat the group',
    'Balance the consistency principle with the inconsistency principle',
    'Be dirty',
    'Be extravagant',
    'Be less critical',
    'Breathe more deeply',
    'Bridges\n--build\n--burn',
    'Cascades',
    'Change ambiguities to specifics',
    'Change instrument roles',
    'Change nothing and continue with immaculate consistency',
    'Change specifics to ambiguities',
    'Children\n--speaking\n--singing',
    'Cluster analysis',
    'Consider different fading systems',
    'Consider transitions',
    'Consult other sources\n--promising\n--unpromising',
    'Convert a melodic element into a rhythmic element',
    'Courage!',
    'Cut a vital connection',
    'Decorate, decorate',
    'Define an area as `safe\' and use it as an anchor',
    'Destroy\n-nothing\n-the most important thing',
    'Discard an axiom',
    'Disciplined self-indulgence',
    'Disconnect from desire',
    'Discover the recipes you are using and abandon them',
    'Display your talent',
    'Distort time',
    'Do nothing for as long as possible',
    'Do something boring',
    'Do the last thing first',
    'Do the washing up',
    'Do the words need changing?',
    'Do we need holes?',
    'Don\'t avoid what is easy',
    'Don\'t be frightened of cliches',
    'Don\'t break the silence',
    'Don\'t stress one thing more than another',
    'Dont be afraid of things because they\'re easy to do',
    'Dont be frightened to display your talents',
    'Emphasize differences',
    'Emphasize repetitions',
    'Emphasize the flaws',
    'Faced with a choice, do both (given by Dieter Rot)',
    'Feed the recording back out of the medium',
    'Fill every beat with something',
    'Find a safe part and use it as an anchor',
    'Get your neck massaged',
    'Ghost echoes',
    'Give the game away',
    'Give way to your worst impulse',
    'Go outside. Shut the door.',
    'Go slowly all the way round the outside',
    'Go to an extreme, come part way back',
    'Honor thy mistake as a hidden intention',
    'How would someone else do it?',
    'How would you have done it?',
    'Humanize something free of error',
    'Idiot glee (?)',
    'Imagine the piece as a set of disconnected events',
    'In total darkness, or in a very large room, very quietly',
    'Infinitesimal gradations',
    'Intentions\n--nobility of\n--humility of\n--credibility of',
    'Into the impossible',
    'Is it finished?',
    'Is something missing?',
    'Is the information correct?',
    'Is the style right?',
    'Is there something missing',
    'It is quite possible (after all)',
    'It is simply a matter of work',
    'Just carry on',
    'Left channel, right channel, center channel',
    'Listen to the quiet voice',
    'Look at the order in which you do things',
    'Look closely at the most embarrassing details & amplify them',
    'Lost in useless territory',
    'Lowest common denominator',
    'Magnify the most difficult details',
    'Make a blank valuable by putting it in an exquisite frame',
    'Make a sudden, destructive unpredictable action; incorporate',
    'Make an exhaustive list of everything you might do & do the last thing on the list',
    'Make it more sensual',
    'Make what\'s perfect more human',
    'Mechanicalize something idiosyncratic',
    'Move towards the unimportant',
    'Mute and continue',
    'Not building a wall but making a brick',
    'Once the search has begun, something will be found',
    'Only a part, not the whole',
    'Only one element of each kind',
    'Overtly resist change',
    'Pae White\'s non-blank graphic metacard',
    'Put in earplugs',
    'Question the heroic',
    'Reevaluation (a warm feeling)',
    'Remember those quiet evenings',
    'Remove a restriction',
    'Remove ambiguities and convert to specifics',
    'Remove specifics and convert to ambiguities',
    'Repetition is a form of change',
    'Retrace your steps',
    'Reverse',
    'Short circuit (example; a man eating peas with the idea that they will improve  his virility shovels them straight into his lap)',
    'Simple subtraction',
    'Simply a matter of work',
    'Slow preparation, fast execution',
    'Spectrum analysis',
    'State the problem as clearly as possible',
    'Take a break',
    'Take away the elements in order of apparent non-importance',
    'Take away the important parts',
    'Tape your mouth (given by Ritva Saarikko)',
    'The inconsistency principle',
    'The most important thing is the thing most easily forgotten',
    'The tape is now the music',
    'Think\n--inside the work\n--outside the work',
    'Think of the radio',
    'Tidy up',
    'Towards the insignificant',
    'Trust in the you of now',
    'Try faking it (from Stewart Brand)',
    'Turn it upside down',
    'Twist the spine',
    'Use \'unqualified\' people',
    'Use an old idea',
    'Use an unacceptable color',
    'Use cliches',
    'Use fewer notes',
    'Use filters',
    'Use something nearby as a model',
    'Use your own ideas',
    'Voice your suspicions',
    'Water',
    'What are the sections sections of?    Imagine a caterpillar moving',
    'What are you really thinking about just now?',
    'What context would look right?',
    'What is the reality of the situation?',
    'What is the simplest solution?',
    'What mistakes did you make last time?',
    'What to increase? What to reduce? What to maintain?',
    'What would your closest friend do?',
    'What wouldn\'t you do?',
    'When is it for?',
    'Where is the edge?',
    'Which parts can be grouped?',
    'Work at a different speed',
    'Would anyone want it?',
    'You are an engineer',
    'You can only make one dot at a time',
    'You don\'t have to be ashamed of using your own ideas',
    '[blank white card]',
];


// Helper type for tool parts (either typed or dynamic)
type AnyToolUIPart = DynamicToolUIPart | ToolUIPart<UITools>

interface PageContext {
  url: string
  title: string
}

function App() {
  const [pageContext, setPageContext] = useState<PageContext | null>(null)
  const [isLoadingContext, setIsLoadingContext] = useState(true)
  const [input, setInput] = useState('')
  const [showSessionList, setShowSessionList] = useState(false)

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
  const handleFinish = useCallback((messages: Parameters<typeof persistMessages>[0]) => {
    persistMessages(messages)
  }, [persistMessages])

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

  // Fetch page context for the active tab
  const fetchPageContext = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.id && tab.url) {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageContext' })
        if (response?.success && response.context) {
          setPageContext({
            url: response.context.url || tab.url,
            title: response.context.title || tab.title || ''
          })
        } else {
          setPageContext({
            url: tab.url,
            title: tab.title || ''
          })
        }
      }
    } catch (err) {
      console.error('Failed to get page context:', err)
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tab?.url) {
          setPageContext({
            url: tab.url,
            title: tab.title || ''
          })
        }
      } catch {
        // ignore
      }
    } finally {
      setIsLoadingContext(false)
    }
  }

  // Get page context on mount and listen for navigation changes
  useEffect(() => {
    fetchPageContext()

    // Listen for tab URL changes (navigation)
    const handleTabUpdated = (_tabId: number, changeInfo: { status?: string }, tab: { active?: boolean }) => {
      if (changeInfo.status === 'complete' && tab.active) {
        fetchPageContext()
      }
    }

    // Listen for tab activation (switching tabs)
    const handleTabActivated = () => {
      fetchPageContext()
    }

    chrome.tabs.onUpdated.addListener(handleTabUpdated)
    chrome.tabs.onActivated.addListener(handleTabActivated)

    return () => {
      chrome.tabs.onUpdated.removeListener(handleTabUpdated)
      chrome.tabs.onActivated.removeListener(handleTabActivated)
    }
  }, [])

  const handleSubmit = async ({ text }: { text: string }) => {
    if (!text.trim()) return
    setInput('')
    sendMessage({ parts: [{ type: 'text', text }] })
  }

  // Handle new chat
  const handleNewChat = async () => {
    await startNewSession()
    clearMessages()
    setShowSessionList(false)
  }

  // Handle session selection
  const handleSelectSession = async (sessionId: string) => {
    await loadSession(sessionId)
    setShowSessionList(false)
  }

  // Handle session deletion
  const handleDeleteSession = async (sessionId: string) => {
    await deleteSessionById(sessionId)
  }

  const randomStrategy = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * strategies.length);
    return strategies[randomIndex];
  }, [currentSession?.id])

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
          onClose={() => setShowSessionList(false)}
        />
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          {/* Left: Hamburger menu */}
          <button
            onClick={() => setShowSessionList(true)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Open conversations"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>

          {/* Center: Conversation title */}
          <h1 className="flex-1 truncate text-center text-sm font-medium tracking-tight">
            {currentSession?.title || 'Chat'}
          </h1>

          {/* Right: New chat button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewChat}
            className="text-xs text-muted-foreground"
            aria-label="New chat"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </Button>
        </div>
      </header>

      {/* Loading state */}
      {(isLoadingContext || isLoadingStore) ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-sm text-muted-foreground">Loading page context...</p>
        </div>
      ) : (
        <Conversation className="flex-1">
          <ConversationContent className="gap-4 px-4 py-4">
            {messages.length === 0 ? (
              <div className="aspect-video border border-border rounded-md grid place-items-center mt-20">
                <p className="text-sm text-muted-foreground text-balance">{randomStrategy}</p>
              </div>
            ) : (
              <>
                {messages.map((message, index) => {
                  const isLastAssistantMessage =
                    message.role === 'assistant' &&
                    index === messages.length - 1

                  // Show reasoning for the last assistant message if we have reasoning content
                  const showReasoning =
                    isLastAssistantMessage && (reasoning || isReasoningStreaming)

                  // Extract tool parts from the message
                  // Tool parts have type starting with 'tool-' or 'dynamic-tool'
                  const toolParts = message.parts
                    .filter((part) => part.type.startsWith('tool-') || part.type === 'dynamic-tool')
                    .map((part) => part as unknown as AnyToolUIPart)

                  return (
                    <Message key={message.id} from={message.role}>
                      <MessageContent>
                        {message.role === 'assistant' ? (
                          <>
                            {showReasoning && (
                              <Reasoning isStreaming={isReasoningStreaming}>
                                <ReasoningTrigger />
                                <ReasoningContent>{reasoning}</ReasoningContent>
                              </Reasoning>
                            )}
                            {/* Render tool calls */}
                            {toolParts.map((toolPart) => {
                              const toolName = getToolOrDynamicToolName(toolPart)
                              return (
                                <Tool key={toolPart.toolCallId} className="group">
                                  <ToolHeader
                                    title={toolName}
                                    type={toolPart.type as `tool-${string}`}
                                    state={toolPart.state}
                                  />
                                  <ToolContent>
                                    {toolPart.input !== undefined && <ToolInput input={toolPart.input} />}
                                    {(toolPart.output !== undefined || toolPart.errorText) && (
                                      <ToolOutput output={toolPart.output} errorText={toolPart.errorText} />
                                    )}
                                  </ToolContent>
                                </Tool>
                              )
                            })}
                            <MessageResponse>{getMessageContent(message)}</MessageResponse>
                          </>
                        ) : (
                          <p className="whitespace-pre-wrap">{getMessageContent(message)}</p>
                        )}
                      </MessageContent>
                    </Message>
                  )
                })}

                {/* Show reasoning while streaming before any text response */}
                {isReasoningStreaming && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                  <Message from="assistant">
                    <MessageContent>
                      <Reasoning isStreaming={isReasoningStreaming}>
                        <ReasoningTrigger />
                        <ReasoningContent>{reasoning}</ReasoningContent>
                      </Reasoning>
                    </MessageContent>
                  </Message>
                )}

                {error && (
                  <div className="border-l-2 border-destructive pl-3 text-sm">
                    <p className="text-destructive">{error.message}</p>
                  </div>
                )}
              </>
            )}
          </ConversationContent>
        </Conversation>
      )}

      {/* Input Area */}
      <div className="border-t border-border p-4">
        {/* Page context badge */}
        {pageContext && (
          <div className="mb-2 flex items-center gap-1">
            <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              <span className="truncate" title={pageContext.url}>
                {pageContext.title || pageContext.url}
              </span>
              <button
                type="button"
                onClick={() => setPageContext(null)}
                className="ml-1 rounded hover:bg-muted-foreground/20"
                aria-label="Remove page context"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          </div>
        )}
        <PromptInput
          onSubmit={handleSubmit}
          className="rounded-lg border border-input bg-background"
        >
          <PromptInputTextarea
            placeholder={pageContext ? "Ask about this page..." : "Ask a question..."}
            disabled={isLoading || isLoadingContext}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <PromptInputFooter>
            <div />
            <PromptInputSubmit
              status={status}
              disabled={isLoading || !input.trim() || isLoadingContext}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}

export default App

