import { useState } from 'react'
import type { Boost } from '@repo/shared'
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

interface BoostCardProps {
  boost: Boost
  onToggle: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onRun: (id: string) => Promise<void>
  isLoading?: boolean
}

export function BoostCard({
  boost,
  onToggle,
  onDelete,
  onRun,
  isLoading = false,
}: BoostCardProps) {
  const { navigate } = useNavigationContext()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleToggle = async () => {
    await onToggle(boost.id)
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onDelete(boost.id)
      setShowDeleteDialog(false)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleEdit = () => {
    navigate('/boosts/create', { boostId: boost.id })
  }

  const handleRun = async () => {
    await onRun(boost.id)
  }

  const runModeIcon = boost.runMode === 'auto' ? '⚡' : '🎯'

  return (
    <>
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/50">
        {/* Header with toggle and run mode */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-1 items-start gap-3">
            {/* Toggle checkbox */}
            <input
              type="checkbox"
              checked={boost.enabled}
              onChange={handleToggle}
              disabled={isLoading}
              className="mt-1 cursor-pointer"
              aria-label={`Toggle ${boost.name}`}
            />
            {/* Title and description */}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm text-foreground">{boost.name}</h3>
              {boost.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {boost.description}
                </p>
              )}
            </div>
          </div>
          {/* Run mode indicator */}
          <span className="text-lg" title={boost.runMode === 'auto' ? 'Auto mode' : 'Manual mode'}>
            {runModeIcon}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-2">
          {boost.runMode === 'manual' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRun}
              disabled={isLoading}
              className="text-xs"
            >
              Run
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            disabled={isLoading}
            className="text-xs"
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isLoading}
            className="text-xs text-destructive hover:text-destructive"
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Boost</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{boost.name}"? This action cannot be undone.
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
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

