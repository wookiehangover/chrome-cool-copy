import { useCallback, useEffect } from 'react'
import type { Highlight, LocalClip } from '@repo/shared'

// Storage key for local clips (must match local-clips.ts)
const LOCAL_CLIPS_STORAGE_KEY = 'local_clips'

export interface UseHighlightsReturn {
  addHighlight: (clipId: string, highlight: Omit<Highlight, 'id' | 'created_at'>) => Promise<void>
  updateNote: (clipId: string, highlightId: string, note: string) => Promise<void>
  deleteHighlight: (clipId: string, highlightId: string) => Promise<void>
}

/**
 * Hook to subscribe to highlight changes for a specific clip
 * Used to sync highlights between reader mode and clip viewer
 */
export function useHighlightSync(
  clipId: string | undefined,
  onHighlightsChange: (highlights: Highlight[]) => void
): void {
  useEffect(() => {
    if (!clipId) return

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (!changes[LOCAL_CLIPS_STORAGE_KEY]) return

      const { newValue } = changes[LOCAL_CLIPS_STORAGE_KEY]
      if (!Array.isArray(newValue)) return

      // Find our clip in the updated clips
      const updatedClip = newValue.find((c: LocalClip) => c.id === clipId)
      if (updatedClip) {
        onHighlightsChange(updatedClip.highlights || [])
      }
    }

    chrome.storage.local.onChanged.addListener(listener)

    return () => {
      chrome.storage.local.onChanged.removeListener(listener)
    }
  }, [clipId, onHighlightsChange])
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

