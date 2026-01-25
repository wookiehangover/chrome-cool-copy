import { useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Image as ImageIcon } from "lucide-react";
import type { MediaClip } from "@/hooks/useMediaClips";

interface MediaClipCardProps {
  clip: MediaClip;
}

/**
 * Card component for rendering media clips (images) in the masonry grid.
 * Shows image with hover overlay containing metadata.
 * Links to the media clip detail page.
 */
export function MediaClipCard({ clip }: MediaClipCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Compute aspect ratio for natural sizing
  const aspectRatio = clip.width && clip.height ? clip.height / clip.width : 1;

  return (
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
            {clip.alt_text && <p className="text-xs text-white/90 line-clamp-2">{clip.alt_text}</p>}

            {/* AI description */}
            {clip.ai_description && (
              <p className="text-xs text-white/70 line-clamp-3 italic">{clip.ai_description}</p>
            )}

            {/* Page info */}
            <div className="flex items-center gap-1 text-xs text-white/60">
              <ExternalLink className="w-3 h-3" />
              <span className="truncate">{clip.page_title || new URL(clip.page_url).hostname}</span>
            </div>

            {/* Date */}
            <time className="text-xs text-white/50">
              {new Date(clip.created_at).toLocaleDateString()}
            </time>
          </div>
        </div>
      </Link>
    </div>
  );
}
