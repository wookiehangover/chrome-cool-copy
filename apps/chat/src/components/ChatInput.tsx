import { useCallback, useEffect } from 'react'
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from '@/components/ai-elements/prompt-input'
import { ModelPicker } from '@/components/ai-elements/model-picker'
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
    selectedModel,
    setSelectedModel,
  } = useChatContext()

  // Load model from storage on mount
  useEffect(() => {
    const loadModel = async () => {
      try {
        const result = await new Promise<{ aiGatewayConfig?: { model?: string } }>((resolve) => {
          chrome.storage.sync.get(['aiGatewayConfig'], (result) => {
            resolve(result)
          })
        })

        const model = result.aiGatewayConfig?.model
        if (model) {
          setSelectedModel(model as any)
        }
      } catch (error) {
        console.error('[ChatInput] Failed to load model from storage:', error)
      }
    }

    loadModel()
  }, [setSelectedModel])

  // Save model to storage when it changes
  const handleModelChange = useCallback(
    (model: any) => {
      setSelectedModel(model)

      // Save to chrome.storage.sync
      chrome.runtime.sendMessage(
        {
          action: 'updateAIGatewayConfig',
          config: { model },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('[ChatInput] Failed to save model:', chrome.runtime.lastError)
          } else if (response?.success) {
            console.log('[ChatInput] Model saved successfully:', model)
          }
        }
      )
    },
    [setSelectedModel]
  )

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
          <ModelPicker
            value={selectedModel}
            onValueChange={handleModelChange}
            disabled={isLoading}
          />
          <PromptInputSubmit status={status} disabled={isSubmitDisabled} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}

