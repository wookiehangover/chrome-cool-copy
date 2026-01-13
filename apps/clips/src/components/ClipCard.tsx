import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { Clip, ElementClip, LocalClip } from "@repo/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ClipCardProps {
  clip: Clip;
  viewMode: "list" | "grid";
  onDelete: (id: string) => Promise<void>;
}

export function ClipCard({ clip, viewMode, onDelete }: ClipCardProps) {
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [loadingScreenshot, setLoadingScreenshot] = useState(false);

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

  const handleOpenUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(clip.url, "_blank");
  };

  const handleViewClip = () => {
    navigate(`/viewer/${clip.id}`);
  };

  // Handle both LocalClip and ElementClip
  // ElementClip has type: 'element', LocalClip has no type field
  const isElementClip = "type" in clip && clip.type === "element";

  // Load screenshot for element clips (all view modes)
  useEffect(() => {
    if (isElementClip && (clip as ElementClip).screenshotAssetId) {
      setLoadingScreenshot(true);
      chrome.runtime.sendMessage(
        {
          action: "getClipAsset",
          assetId: (clip as ElementClip).screenshotAssetId,
        },
        (response) => {
          setLoadingScreenshot(false);
          if (response?.success && response?.dataUrl) {
            setScreenshotUrl(response.dataUrl);
          }
        },
      );
    }
  }, [isElementClip, clip]);

  // Format date - handle different timestamp field names
  const timestamp = isElementClip
    ? (clip as ElementClip).createdAt
    : (clip as LocalClip).created_at;
  const date = new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Get hostname for display
  const hostname = new URL(clip.url).hostname;

  // Get preview text (first 120 chars) - handle different field names
  const textContent = isElementClip
    ? (clip as ElementClip).textContent
    : (clip as LocalClip).text_content;
  const preview = (textContent || "").substring(0, 120);

  // Get title - handle different field names for element clips
  const title = isElementClip
    ? (clip as ElementClip).aiTitle || `Element: ${(clip as ElementClip).elementMeta?.tagName || "Unknown"}`
    : (clip as LocalClip).title;

  // Debug logging when fallback is used
  if (isElementClip && !(clip as ElementClip).aiTitle) {
    console.log('[ClipCard] No aiTitle, using fallback for clip:', clip.id);
  }

  if (viewMode === "grid") {
    return (
      <>
        <div
          onClick={handleViewClip}
          className="flex flex-col gap-0 border border-border rounded overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors h-full"
        >
          {/* Screenshot for element clips */}
          {isElementClip && (
            <div className="relative w-full aspect-video bg-muted overflow-hidden">
              {loadingScreenshot && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <div className="w-4 h-4 border border-border border-t-foreground rounded-full animate-spin" />
                </div>
              )}
              {screenshotUrl && (
                <img
                  src={screenshotUrl}
                  alt="Element screenshot"
                  className="w-full h-full object-cover"
                />
              )}
              {!screenshotUrl && !loadingScreenshot && (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
                  No preview
                </div>
              )}
            </div>
          )}

          {/* Content section */}
          <div className="p-4 flex flex-col gap-2 flex-1">
            {/* Title */}
            <h3 className="text-[13px] font-medium text-foreground leading-snug line-clamp-2">
              {title}
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
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteDialog(true);
                  }}
                  className="text-[11px] uppercase tracking-wide text-destructive hover:underline border-none bg-transparent cursor-pointer p-0"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Delete confirmation dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Clip</DialogTitle>
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

  // List view
  // Element clips show as horizontal cards with image; page clips show as text
  if (isElementClip) {
    return (
      <>
        <div
          onClick={handleViewClip}
          className="group py-3 px-3 border-b border-border cursor-pointer hover:bg-muted/30 transition-all rounded flex gap-3"
        >
          {/* Screenshot thumbnail */}
          <div className="flex-shrink-0 w-20 h-20 bg-muted rounded border border-border overflow-hidden">
            {loadingScreenshot && (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-3 h-3 border border-border border-t-foreground rounded-full animate-spin" />
              </div>
            )}
            {screenshotUrl && (
              <img
                src={screenshotUrl}
                alt="Element screenshot"
                className="w-full h-full object-cover"
              />
            )}
            {!screenshotUrl && !loadingScreenshot && (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[10px] text-center px-1">
                No preview
              </div>
            )}
          </div>

          {/* Content section */}
          <div className="flex-1 flex flex-col gap-1 min-w-0">
            {/* Title */}
            <h3 className="text-[13px] font-medium text-foreground leading-snug line-clamp-1">
              {title}
            </h3>

            {/* URL */}
            <p className="text-[11px] text-muted-foreground truncate">{hostname}</p>

            {/* Date and type */}
            <p className="text-[11px] text-muted-foreground">{date} · Element</p>

            {/* Preview */}
            <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-1">
              {preview}
            </p>

            {/* Actions - visible on hover */}
            <div className="flex gap-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleOpenUrl}
                className="text-[11px] uppercase tracking-wide text-muted-foreground hover:text-foreground border-none bg-transparent cursor-pointer p-0"
              >
                Open
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteDialog(true);
                }}
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

  // List view for page clips (text-only)
  return (
    <>
      <div
        onClick={handleViewClip}
        className="group py-4 border-b border-border cursor-pointer hover:bg-muted/30 hover:-mx-3 hover:px-3 transition-all"
      >
        {/* Title */}
        <h3 className="text-[13px] font-medium text-foreground leading-snug mb-1">{title}</h3>

        {/* URL */}
        <p className="text-[11px] text-muted-foreground mb-1 truncate">{hostname}</p>

        {/* Date */}
        <p className="text-[11px] text-muted-foreground mb-2">{date}</p>

        {/* Preview */}
        <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-2">{preview}</p>

        {/* Actions - visible on hover */}
        <div className="flex gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleOpenUrl}
            className="text-[11px] uppercase tracking-wide text-muted-foreground hover:text-foreground border-none bg-transparent cursor-pointer p-0"
          >
            Open
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteDialog(true);
            }}
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
