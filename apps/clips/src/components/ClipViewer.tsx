import { useEffect, useState, useRef } from 'react'
import { useNavigationContext } from '@/contexts/NavigationContext'
import { useClips } from '@/hooks/useClips'
import { useHighlights } from '@/hooks/useHighlights'
import type { LocalClip, Highlight } from '@repo/shared'
import { ViewerToolbar } from './ViewerToolbar'
import { SettingsPanel } from './SettingsPanel'
import { HighlightPopover } from './HighlightPopover'

export function ClipViewer() {
  const { params } = useNavigationContext()
  const { getClip } = useClips()
  const { addHighlight, updateNote, deleteHighlight } = useHighlights()
  const [clip, setClip] = useState<LocalClip | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [activePopover, setActivePopover] = useState<{
    highlightId: string
    position: { top: number; left: number }
  } | null>(null)
  const [selectionButton, setSelectionButton] = useState<{
    position: { top: number; left: number }
  } | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const clipId = params?.clipId

  // Load clip on mount
  useEffect(() => {
    const loadClip = async () => {
      if (!clipId) {
        setError('No clip ID provided')
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)
        const loadedClip = await getClip(clipId)
        if (loadedClip) {
          setClip(loadedClip)
          setEditContent(loadedClip.dom_content)
          setHighlights(loadedClip.highlights || [])
        } else {
          setError('Clip not found')
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load clip'
        setError(errorMsg)
      } finally {
        setIsLoading(false)
      }
    }

    loadClip()
  }, [clipId, getClip])

  // Set content when entering edit mode (since dangerouslySetInnerHTML is disabled in edit mode)
  useEffect(() => {
    if (isEditMode && contentRef.current) {
      contentRef.current.innerHTML = editContent
    }
  }, [isEditMode])

  // Restore highlights in DOM when content or highlights change
  useEffect(() => {
    if (!contentRef.current || isEditMode) return

    // Clear existing marks
    contentRef.current.querySelectorAll('.viewer-highlight').forEach((mark) => {
      const parent = mark.parentNode
      if (parent) {
        while (mark.firstChild) {
          parent.insertBefore(mark.firstChild, mark)
        }
        parent.removeChild(mark)
      }
    })

    // Restore highlights
    if (highlights.length > 0) {
      const sorted = [...highlights].sort((a, b) => b.startOffset - a.startOffset)
      for (const hl of sorted) {
        try {
          restoreHighlight(hl)
        } catch {
          console.warn('Could not restore highlight:', hl.text.slice(0, 30))
        }
      }
    }
  }, [highlights, isEditMode])

  const restoreHighlight = (highlight: Highlight) => {
    if (!contentRef.current) return

    const walker = document.createTreeWalker(
      contentRef.current,
      NodeFilter.SHOW_TEXT,
      null
    )

    let currentOffset = 0
    let node: Node | null = null

    while ((node = walker.nextNode())) {
      const nodeLength = node.textContent?.length || 0
      const nodeStart = currentOffset
      const nodeEnd = currentOffset + nodeLength

      if (nodeEnd > highlight.startOffset && nodeStart < highlight.endOffset) {
        const mark = document.createElement('mark')
        mark.className = 'viewer-highlight'
        mark.dataset.highlightId = highlight.id
        if (highlight.note) {
          mark.classList.add('has-note')
        }

        const range = document.createRange()
        const startOffset = Math.max(0, highlight.startOffset - nodeStart)
        const endOffset = Math.min(nodeLength, highlight.endOffset - nodeStart)

        range.setStart(node, startOffset)
        range.setEnd(node, endOffset)
        range.surroundContents(mark)
        return
      }

      currentOffset = nodeEnd
    }
  }

  const getTextOffset = (container: Node | null, targetNode: Node, targetOffset: number): number => {
    if (!container) return 0

    let offset = 0
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null)

    let node: Node | null = null
    while ((node = walker.nextNode())) {
      if (node === targetNode) {
        return offset + targetOffset
      }
      offset += node.textContent?.length || 0
    }

    return offset
  }

  const handleContentMouseUp = () => {
    if (isEditMode) {
      setSelectionButton(null)
      return
    }

    const selection = window.getSelection()
    if (!selection || selection.toString().length === 0) {
      setSelectionButton(null)
      return
    }

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const contentRect = contentRef.current?.getBoundingClientRect()

    if (contentRect) {
      setSelectionButton({
        position: {
          top: rect.bottom - contentRect.top + 8,
          left: rect.left - contentRect.left + rect.width / 2 - 40,
        },
      })
    }
  }

  const handleHighlightClick = (e: React.MouseEvent) => {
    const mark = (e.target as HTMLElement).closest('.viewer-highlight') as HTMLElement
    if (!mark) return

    const highlightId = mark.dataset.highlightId
    if (!highlightId) return

    e.stopPropagation()

    const rect = mark.getBoundingClientRect()
    const contentRect = contentRef.current?.getBoundingClientRect()

    if (contentRect) {
      setActivePopover({
        highlightId,
        position: {
          top: rect.bottom - contentRect.top + 8,
          left: rect.left - contentRect.left,
        },
      })
    }
  }

  const handleCreateHighlight = async () => {
    if (!clip) return

    const selection = window.getSelection()
    if (!selection || selection.toString().length === 0) return

    const text = selection.toString()
    const range = selection.getRangeAt(0)
    const container = contentRef.current

    if (!container) return

    // Calculate absolute offsets from the clip's text_content
    const startOffset = getTextOffset(container, range.startContainer, range.startOffset)
    const endOffset = getTextOffset(container, range.endContainer, range.endOffset)

    try {
      await addHighlight(clip.id, {
        text,
        startOffset,
        endOffset,
        color: 'yellow',
      })

      const newHighlight: Highlight = {
        id: `hl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text,
        startOffset,
        endOffset,
        color: 'yellow',
        created_at: new Date().toISOString(),
      }

      setHighlights([...highlights, newHighlight])
      selection.removeAllRanges()
      setSelectionButton(null)
    } catch (error) {
      console.error('Failed to create highlight:', error)
    }
  }

  const handleSaveNote = async (note: string) => {
    if (!clip || !activePopover) return

    try {
      await updateNote(clip.id, activePopover.highlightId, note)
      setHighlights(
        highlights.map((h) =>
          h.id === activePopover.highlightId ? { ...h, note } : h
        )
      )
    } catch (error) {
      console.error('Failed to save note:', error)
    }
  }

  const handleDeleteHighlight = async () => {
    if (!clip || !activePopover) return

    try {
      await deleteHighlight(clip.id, activePopover.highlightId)
      setHighlights(highlights.filter((h) => h.id !== activePopover.highlightId))
    } catch (error) {
      console.error('Failed to delete highlight:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="viewer-wrapper">
        <div className="viewer-container flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Loading clip...</p>
        </div>
      </div>
    )
  }

  if (error || !clip) {
    return (
      <div className="viewer-wrapper">
        <div className="viewer-container flex flex-col items-center justify-center">
          <p className="text-destructive text-sm">{error || 'Clip not found'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="viewer-wrapper">
      <ViewerToolbar
        clip={clip}
        isEditMode={isEditMode}
        onEditModeChange={setIsEditMode}
        onSettingsClick={() => setShowSettings(!showSettings)}
        onSave={async (newContent) => {
          setIsSaving(true)
          try {
            setEditContent(newContent)
            setIsEditMode(false)
          } finally {
            setIsSaving(false)
          }
        }}
        isSaving={isSaving}
      />

      {showSettings && <SettingsPanel />}

      <div className="viewer-container">
        {/* Header - matching reader-mode.css */}
        <header className="viewer-header">
          <h1 className="viewer-title">
            {clip.title}
          </h1>
          <div className="viewer-meta">
            <a
              href={clip.url}
              target="_blank"
              rel="noopener noreferrer"
              className="viewer-url"
            >
              {new URL(clip.url).hostname}
            </a>
            <span className="viewer-meta-separator">•</span>
            <time>{new Date(clip.created_at).toLocaleDateString()}</time>
          </div>
        </header>

        {/* Content */}
        <div
          ref={contentRef}
          className={`viewer-content ${isEditMode ? 'outline-dashed outline-2 outline-border outline-offset-4' : ''}`}
          contentEditable={isEditMode}
          suppressContentEditableWarning
          onInput={(e) => setEditContent(e.currentTarget.innerHTML)}
          onMouseUp={handleContentMouseUp}
          onClick={handleHighlightClick}
          dangerouslySetInnerHTML={!isEditMode ? { __html: editContent } : undefined}
        />

        {/* Selection highlight button */}
        {selectionButton && !isEditMode && (
          <button
            className="highlight-selection-btn"
            style={{
              position: 'absolute',
              top: `${selectionButton.position.top}px`,
              left: `${selectionButton.position.left}px`,
            }}
            onClick={handleCreateHighlight}
          >
            Highlight
          </button>
        )}

        {/* Highlight popover */}
        {activePopover && (
          <HighlightPopover
            highlightId={activePopover.highlightId}
            initialNote={highlights.find((h) => h.id === activePopover.highlightId)?.note || ''}
            onSave={handleSaveNote}
            onDelete={handleDeleteHighlight}
            onClose={() => setActivePopover(null)}
            position={activePopover.position}
          />
        )}
      </div>
    </div>
  )
}

