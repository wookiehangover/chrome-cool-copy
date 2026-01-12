import { useCallback } from 'react'
import type { Highlight } from '@repo/shared'

export interface UseHighlightsReturn {
  addHighlight: (clipId: string, highlight: Omit<Highlight, 'id' | 'created_at'>) => Promise<void>
  updateNote: (clipId: string, highlightId: string, note: string) => Promise<void>
  deleteHighlight: (clipId: string, highlightId: string) => Promise<void>
}

export function useHighlights(): UseHighlightsReturn {
  const addHighlight = useCallback(
    async (clipId: string, highlight: Omit<Highlight, 'id' | 'created_at'>) => {
      try {
        await chrome.runtime.sendMessage({
          action: 'addHighlight',
          clipId,
          highlight,
        })
      } catch (error) {
        console.error('Failed to add highlight:', error)
        throw error
      }
    },
    []
  )

  const updateNote = useCallback(
    async (clipId: string, highlightId: string, note: string) => {
      try {
        await chrome.runtime.sendMessage({
          action: 'updateHighlightNote',
          clipId,
          highlightId,
          note,
        })
      } catch (error) {
        console.error('Failed to update highlight note:', error)
        throw error
      }
    },
    []
  )

  const deleteHighlight = useCallback(
    async (clipId: string, highlightId: string) => {
      try {
        await chrome.runtime.sendMessage({
          action: 'deleteHighlight',
          clipId,
          highlightId,
        })
      } catch (error) {
        console.error('Failed to delete highlight:', error)
        throw error
      }
    },
    []
  )

  return {
    addHighlight,
    updateNote,
    deleteHighlight,
  }
}

