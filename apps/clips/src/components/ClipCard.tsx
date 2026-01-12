import { useState } from 'react'
import type { LocalClip } from '@repo/shared'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useNavigationContext } from '@/contexts/NavigationContext'

interface ClipCardProps {
  clip: LocalClip
  viewMode: 'list' | 'grid'
  onDelete: (id: string) => Promise<void>
}

export function ClipCard({ clip, viewMode, onDelete }: ClipCardProps) {
  const { navigate } = useNavigationContext()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDeleting(true)
    try {
      await onDelete(clip.id)
      setShowDeleteDialog(false)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleOpenUrl = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(clip.url, '_blank')
  }

  const handleViewClip = () => {
    navigate('/viewer', { clipId: clip.id })
  }

  // Format date
  const date = new Date(clip.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  // Get hostname for display
  const hostname = new URL(clip.url).hostname

  // Get preview text (first 120 chars)
  const preview = clip.text_content.substring(0, 120)

  if (viewMode === 'grid') {
    return (
      <>
        <div
          onClick={handleViewClip}
          className="flex flex-col gap-2 border border-border rounded p-4 cursor-pointer hover:bg-muted/50 transition-colors h-full"
        >
          {/* Title */}
          <h3 className="text-[13px] font-medium text-foreground leading-snug line-clamp-2">
            {clip.title}
          </h3>

          {/* URL */}
          <p className="text-[11px] text-muted-foreground truncate">{hostname}</p>

          {/* Preview */}
          <p className="text-xs text-muted-foreground/80 line-clamp-2 flex-1 leading-relaxed">
            {preview}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-[11px] text-muted-foreground">{date}</span>
            <div className="flex gap-3">
              <button
                onClick={handleOpenUrl}
                className="text-[11px] uppercase tracking-wide text-muted-foreground hover:text-foreground border-none bg-transparent cursor-pointer p-0"
              >
                Open
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setShowDeleteDialog(true) }}
                className="text-[11px] uppercase tracking-wide text-destructive hover:underline border-none bg-transparent cursor-pointer p-0"
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Delete confirmation dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Clip</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{clip.title}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  // List view - matches clipped-pages.css style
  return (
    <>
      <div
        onClick={handleViewClip}
        className="group py-4 border-b border-border cursor-pointer hover:bg-muted/30 hover:-mx-3 hover:px-3 transition-all"
      >
        {/* Title */}
        <h3 className="text-[13px] font-medium text-foreground leading-snug mb-1">
          {clip.title}
        </h3>

        {/* URL */}
        <p className="text-[11px] text-muted-foreground mb-1 truncate">
          {hostname}
        </p>

        {/* Date */}
        <p className="text-[11px] text-muted-foreground mb-2">
          {date}
        </p>

        {/* Preview */}
        <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-2">
          {preview}
        </p>

        {/* Actions - visible on hover */}
        <div className="flex gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleOpenUrl}
            className="text-[11px] uppercase tracking-wide text-muted-foreground hover:text-foreground border-none bg-transparent cursor-pointer p-0"
          >
            Open
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setShowDeleteDialog(true) }}
            className="text-[11px] uppercase tracking-wide text-destructive hover:underline border-none bg-transparent cursor-pointer p-0"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Clip</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{clip.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

