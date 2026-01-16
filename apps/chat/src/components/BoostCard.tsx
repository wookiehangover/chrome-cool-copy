import { useState } from "react";
import { MoreHorizontalIcon, PlayIcon, PencilIcon, TrashIcon } from "lucide-react";
import type { Boost } from "@repo/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigationContext } from "@/contexts/NavigationContext";

interface BoostCardProps {
  boost: Boost;
  onDelete: (id: string) => Promise<void>;
  onRun: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export function BoostCard({ boost, onDelete, onRun, isLoading = false }: BoostCardProps) {
  const { navigate } = useNavigationContext();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(boost.id);
      setShowDeleteDialog(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = () => {
    navigate("/boosts/create", { boostId: boost.id });
  };

  const handleRun = async () => {
    await onRun(boost.id);
  };

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/50">
        {/* Title and description */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm text-foreground">{boost.name}</h3>
          {boost.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{boost.description}</p>
          )}
        </div>
        {/* Overflow menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={isLoading}>
              <MoreHorizontalIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {boost.runMode === "manual" && (
              <DropdownMenuItem onClick={handleRun}>
                <PlayIcon className="h-4 w-4" />
                Run
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleEdit}>
              <PencilIcon className="h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setShowDeleteDialog(true)}>
              <TrashIcon className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
