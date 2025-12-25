import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from '@/components/ai-elements/prompt-input'
import { PageContextBadge, type PageContext } from './PageContextBadge'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (data: { text: string }) => void
  pageContext: PageContext | null
  onClearContext: () => void
  isLoading: boolean
  isDisabled: boolean
  status: 'streaming' | 'submitted' | 'ready' | 'error'
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  pageContext,
  onClearContext,
  isLoading,
  isDisabled,
  status,
}: ChatInputProps) {
  const placeholder = pageContext ? 'Ask about this page...' : 'Ask a question...'
  const isSubmitDisabled = isLoading || !value.trim() || isDisabled

  return (
    <div className="border-t border-border p-4">
      {pageContext && (
        <PageContextBadge context={pageContext} onClear={onClearContext} />
      )}
      <PromptInput
        onSubmit={onSubmit}
        className="rounded-lg border border-input bg-background"
      >
        <PromptInputTextarea
          placeholder={placeholder}
          disabled={isLoading || isDisabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <PromptInputFooter>
          <div />
          <PromptInputSubmit status={status} disabled={isSubmitDisabled} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}

