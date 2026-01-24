import { ExternalLink, Sparkles } from "lucide-react";
import type { MediaClip } from "~/lib/agentdb.server";

interface MediaViewerProps {
  clip: MediaClip;
}

/**
 * Format file size to human-readable string
 */
function formatFileSize(bytes: number | null): string {
  if (bytes === null) return "Unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaViewer({ clip }: MediaViewerProps) {
  const hostname = new URL(clip.page_url).hostname;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Image */}
        <div className="flex justify-center mb-8">
          <img
            src={clip.blob_url}
            alt={clip.alt_text || clip.page_title || "Image"}
            className="max-w-full h-auto rounded-lg shadow-lg"
            style={{ maxHeight: "80vh" }}
          />
        </div>

        {/* Metadata */}
        <div className="space-y-4 max-w-2xl mx-auto">
          {/* Page source */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-32 shrink-0">Source</span>
            <a
              href={clip.page_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-foreground hover:underline flex items-center gap-1"
            >
              {clip.page_title || hostname}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Captured date */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-32 shrink-0">Captured</span>
            <time className="text-sm text-foreground">
              {new Date(clip.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          </div>

          {/* Dimensions */}
          {clip.width && clip.height && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-32 shrink-0">Dimensions</span>
              <span className="text-sm text-foreground">
                {clip.width} × {clip.height}
              </span>
            </div>
          )}

          {/* File size */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-32 shrink-0">Size</span>
            <span className="text-sm text-foreground">{formatFileSize(clip.file_size)}</span>
          </div>

          {/* Original filename */}
          {clip.original_filename && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-32 shrink-0">Filename</span>
              <span className="text-sm text-foreground font-mono">{clip.original_filename}</span>
            </div>
          )}

          {/* Alt text */}
          {clip.alt_text && (
            <div className="flex items-start gap-2">
              <span className="text-sm text-muted-foreground w-32 shrink-0">Alt text</span>
              <span className="text-sm text-foreground">{clip.alt_text}</span>
            </div>
          )}

          {/* AI description */}
          {clip.ai_description && (
            <div className="flex items-start gap-2 pt-4 border-t border-border">
              <span className="text-sm text-muted-foreground w-32 shrink-0 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                AI Description
              </span>
              <span className="text-sm text-foreground italic">{clip.ai_description}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

