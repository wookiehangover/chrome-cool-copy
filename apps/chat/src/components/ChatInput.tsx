import { useCallback } from 'react'
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from '@/components/ai-elements/prompt-input'
import { PageContextBadge } from './PageContextBadge'
import { useChatContext } from '@/contexts/ChatContext'

export function ChatInput() {
  const {
    input,
    setInput,
    sendMessage,
    pageContext,
    clearContext,
    isLoading,
    isLoadingContext,
    status,
  } = useChatContext()

  const handleSubmit = useCallback(
    ({ text }: { text: string }) => {
      if (!text.trim()) return
      setInput('')
      sendMessage({ parts: [{ type: 'text', text }] })
    },
    [sendMessage, setInput]
  )

  const placeholder = pageContext ? 'Ask about this page...' : 'Ask a question...'
  const isSubmitDisabled = isLoading || !input.trim() || isLoadingContext

  return (
    <div className="border-t border-border p-4">
      {pageContext && (
        <PageContextBadge context={pageContext} onClear={clearContext} />
      )}
      <PromptInput
        onSubmit={handleSubmit}
        className="rounded-lg border border-input bg-background"
      >
        <PromptInputTextarea
          placeholder={placeholder}
          disabled={isLoading || isLoadingContext}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <PromptInputFooter>
          <div />
          <PromptInputSubmit status={status} disabled={isSubmitDisabled} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}

