import { useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MediaClip } from "@/hooks/useMediaClips";

interface MediaClipCardProps {
  clip: MediaClip;
  onDelete: (id: string) => Promise<void>;
}

/**
 * Card component for rendering media clips (images) in the masonry grid.
 * Shows image with hover overlay containing metadata.
 * Links to the media clip detail page.
 */
export function MediaClipCard({ clip, onDelete }: MediaClipCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      await onDelete(clip.id);
      setShowDeleteDialog(false);
    } finally {
      setIsDeleting(false);
    }
  };

  // Compute aspect ratio for natural sizing
  const aspectRatio = clip.width && clip.height ? clip.height / clip.width : 1;

  const title = clip.alt_text || clip.page_title || clip.original_filename || "Image";

  return (
    <>
      <div className="break-inside-avoid mb-4">
        <Link
          to={`/media/${clip.id}`}
          className="block group relative bg-card border border-border rounded-lg overflow-hidden hover:border-foreground/20 transition-colors"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Image */}
          <div
            className="relative w-full bg-muted"
            style={{ paddingBottom: `${Math.min(aspectRatio * 100, 150)}%` }}
          >
            {imageError ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              </div>
            ) : (
              <img
                src={clip.blob_url}
                alt={clip.alt_text || clip.page_title || "Image"}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
                onError={() => setImageError(true)}
              />
            )}
          </div>

          {/* Hover overlay with metadata */}
          <div
            className={`absolute inset-0 bg-black/70 p-3 flex flex-col justify-end transition-opacity duration-200 ${
              isHovered ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="space-y-2">
              {/* Alt text */}
              {clip.alt_text && (
                <p className="text-xs text-white/90 line-clamp-2">{clip.alt_text}</p>
              )}

              {/* AI description */}
              {clip.ai_description && (
                <p className="text-xs text-white/70 line-clamp-3 italic">{clip.ai_description}</p>
              )}

              {/* Page info */}
              <div className="flex items-center gap-1 text-xs text-white/60">
                <ExternalLink className="w-3 h-3" />
                <span className="truncate">
                  {clip.page_title || new URL(clip.page_url).hostname}
                </span>
              </div>

              {/* Date and actions */}
              <div className="flex items-center justify-between">
                <time className="text-xs text-white/50">
                  {new Date(clip.created_at).toLocaleDateString()}
                </time>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowDeleteDialog(true);
                  }}
                  className="text-[11px] uppercase tracking-wide text-red-400 hover:text-red-300 border-none bg-transparent cursor-pointer p-0"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Image</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{title}"? This action cannot be undone.
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
