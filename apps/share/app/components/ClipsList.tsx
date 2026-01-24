import { Loader2, Share, ExternalLink, Image as ImageIcon } from "lucide-react";
import { useState, useMemo } from "react";
import { Link, useFetcher } from "react-router";
import type { LightweightClip, MediaClip } from "~/lib/agentdb.server";

interface ClipsListProps {
  clips: LightweightClip[];
  mediaClips: MediaClip[];
}

// Fuzzy match function - same as clips app
function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  const pattern = query
    .split("")
    .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(pattern, "i").test(text);
}

// Union type for mixed feed items
type FeedItem =
  | { type: "page"; item: LightweightClip }
  | { type: "media"; item: MediaClip };

export function ClipsList({ clips, mediaClips }: ClipsListProps) {
  const [search, setSearch] = useState("");

  // Filter and merge clips by fuzzy matching
  const feedItems = useMemo(() => {
    const filteredPageClips = search.trim()
      ? clips.filter(
          (clip) => fuzzyMatch(search, clip.title) || fuzzyMatch(search, clip.url),
        )
      : clips;

    const filteredMediaClips = search.trim()
      ? mediaClips.filter(
          (clip) =>
            fuzzyMatch(search, clip.alt_text || "") ||
            fuzzyMatch(search, clip.page_title || "") ||
            fuzzyMatch(search, clip.ai_description || ""),
        )
      : mediaClips;

    // Interleave media and page clips for visual variety
    const items: FeedItem[] = [];
    const pageItems = filteredPageClips.map((item) => ({ type: "page" as const, item }));
    const mediaItems = filteredMediaClips.map((item) => ({ type: "media" as const, item }));

    // Sort all items by date (newest first)
    const allItems = [...pageItems, ...mediaItems].sort((a, b) => {
      const dateA = new Date(a.type === "page" ? a.item.captured_at : a.item.created_at);
      const dateB = new Date(b.type === "page" ? b.item.captured_at : b.item.created_at);
      return dateB.getTime() - dateA.getTime();
    });

    return allItems;
  }, [clips, mediaClips, search]);

  const totalCount = clips.length + mediaClips.length;

  return (
    <div className="flex h-full w-full flex-col bg-background overflow-auto">
      {/* Full-width container */}
      <div className="w-full px-6 py-8">
        {/* Search section */}
        {totalCount > 0 && (
          <div className="mb-6 max-w-md mx-auto">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clips and images..."
              className="w-full py-3 bg-transparent border-0 border-b border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-foreground transition-colors"
            />
          </div>
        )}

        {/* Content */}
        {totalCount === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">No clips yet</p>
          </div>
        ) : feedItems.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">No matches</p>
          </div>
        ) : (
          /* Masonry grid using CSS columns */
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
            {feedItems.map((feedItem) =>
              feedItem.type === "page" ? (
                <PageClipCard key={`page-${feedItem.item.id}`} clip={feedItem.item} />
              ) : (
                <MediaClipCard key={`media-${feedItem.item.id}`} clip={feedItem.item} />
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PageClipCard({ clip }: { clip: LightweightClip }) {
  const fetcher = useFetcher();

  const shareId = useMemo(
    () => fetcher.data?.share_id ?? clip.share_id,
    [fetcher.data, clip.share_id],
  );

  return (
    <div className="break-inside-avoid mb-4">
      <div className="group p-4 bg-card border border-border rounded-lg hover:border-foreground/20 transition-colors">
        <Link to={`/share/${shareId}`} className="block space-y-2">
          <h3 className="text-sm font-medium text-foreground line-clamp-2">{clip.title}</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">{new URL(clip.url).hostname}</span>
            <span>•</span>
            <time>{new Date(clip.captured_at).toLocaleDateString()}</time>
          </div>
        </Link>
        {shareId === null && (
          <fetcher.Form method="POST" action="/api/share" className="mt-2">
            <button
              type="submit"
              name="id"
              value={clip.id}
              className="text-muted-foreground hover:text-foreground transition-colors border border-border rounded-md p-1"
            >
              {fetcher.state === "submitting" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Share className="w-4 h-4" />
              )}
            </button>
          </fetcher.Form>
        )}
      </div>
    </div>
  );
}

function MediaClipCard({ clip }: { clip: MediaClip }) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Compute aspect ratio for natural sizing
  const aspectRatio =
    clip.width && clip.height ? clip.height / clip.width : 1;

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
            {clip.alt_text && (
              <p className="text-xs text-white/90 line-clamp-2">{clip.alt_text}</p>
            )}

            {/* AI description */}
            {clip.ai_description && (
              <p className="text-xs text-white/70 line-clamp-3 italic">
                {clip.ai_description}
              </p>
            )}

            {/* Page info */}
            <div className="flex items-center gap-1 text-xs text-white/60">
              <ExternalLink className="w-3 h-3" />
              <span className="truncate">
                {clip.page_title || new URL(clip.page_url).hostname}
              </span>
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
