import { useState, useEffect, useCallback } from 'react'
import type { ModelId } from '@repo/shared'

const DEFAULT_MODEL: ModelId = 'anthropic/claude-sonnet-4.5'

/**
 * Hook for managing model selection with chrome.storage.sync
 * Loads initial model from storage and syncs changes back
 */
export function useModelSelection() {
  const [selectedModel, setSelectedModel] = useState<ModelId>(DEFAULT_MODEL)
  const [isLoading, setIsLoading] = useState(true)

  // Load model from storage on mount
  useEffect(() => {
    const loadModel = async () => {
      try {
        const result = await new Promise<{ aiGatewayConfig?: { model?: ModelId } }>(
          (resolve) => {
            chrome.storage.sync.get(['aiGatewayConfig'], (result) => {
              resolve(result)
            })
          }
        )

        const model = result.aiGatewayConfig?.model
        if (model) {
          setSelectedModel(model)
        }
      } catch (error) {
        console.error('[useModelSelection] Failed to load model from storage:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadModel()
  }, [])

  // Save model to storage when it changes
  const handleModelChange = useCallback((model: ModelId) => {
    setSelectedModel(model)

    // Save to chrome.storage.sync
    chrome.runtime.sendMessage(
      {
        action: 'updateAIGatewayConfig',
        config: { model },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('[useModelSelection] Failed to save model:', chrome.runtime.lastError)
        } else if (response?.success) {
          console.log('[useModelSelection] Model saved successfully:', model)
        }
      }
    )
  }, [])

  return {
    selectedModel,
    setSelectedModel: handleModelChange,
    isLoading,
  }
}

