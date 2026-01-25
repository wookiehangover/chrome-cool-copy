import { useState, useMemo, useEffect } from "react";
import { LayoutGridIcon, ListIcon, RefreshCwIcon } from "lucide-react";
import { useClips } from "@/hooks/useClips";
import { useMediaClips, type MediaClip } from "@/hooks/useMediaClips";
import { useAgentDBConfig } from "@/hooks/useAgentDBConfig";
import { ClipCard } from "@/components/ClipCard";
import { MediaClipCard } from "@/components/MediaClipCard";
import { cn } from "@/lib/utils";
import type { LocalClip, Clip } from "@repo/shared";

// Fuzzy match function - same as BoostsList
function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  const pattern = query
    .split("")
    .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(pattern, "i").test(text);
}

// Union type for mixed feed items
type FeedItem = { type: "local"; item: Clip } | { type: "media"; item: MediaClip };

export function ClipsList() {
  const { clips, isLoading: clipsLoading, deleteClip, syncClips } = useClips();
  const { mediaClips, isLoading: mediaLoading } = useMediaClips();
  const { isConfigured: agentdbConfigured } = useAgentDBConfig();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [isSyncing, setIsSyncing] = useState(false);

  const isLoading = clipsLoading || mediaLoading;

  // Load view mode preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("clips-view-mode");
    if (saved === "grid" || saved === "list") {
      setViewMode(saved);
    }
  }, []);

  // Save view mode preference to localStorage
  const handleViewModeChange = (mode: "list" | "grid") => {
    setViewMode(mode);
    localStorage.setItem("clips-view-mode", mode);
  };

  // Filter and merge clips by fuzzy matching
  const feedItems = useMemo(() => {
    // Filter local clips
    const filteredLocalClips = search.trim()
      ? clips.filter((clip) => {
          const title =
            "type" in clip && clip.type === "element" ? clip.pageTitle : (clip as LocalClip).title;
          return fuzzyMatch(search, title) || fuzzyMatch(search, clip.url);
        })
      : clips;

    // Filter media clips
    const filteredMediaClips = search.trim()
      ? mediaClips.filter(
          (clip) =>
            fuzzyMatch(search, clip.alt_text || "") ||
            fuzzyMatch(search, clip.page_title || "") ||
            fuzzyMatch(search, clip.ai_description || ""),
        )
      : mediaClips;

    // Convert to feed items
    const localItems: FeedItem[] = filteredLocalClips.map((item) => ({
      type: "local" as const,
      item,
    }));
    const mediaItems: FeedItem[] = filteredMediaClips.map((item) => ({
      type: "media" as const,
      item,
    }));

    // Sort all items by date (newest first)
    const allItems = [...localItems, ...mediaItems].sort((a, b) => {
      const dateA = new Date(
        a.type === "local"
          ? "type" in a.item && a.item.type === "element"
            ? a.item.createdAt
            : (a.item as LocalClip).created_at
          : a.item.created_at,
      );
      const dateB = new Date(
        b.type === "local"
          ? "type" in b.item && b.item.type === "element"
            ? b.item.createdAt
            : (b.item as LocalClip).created_at
          : b.item.created_at,
      );
      return dateB.getTime() - dateA.getTime();
    });

    return allItems;
  }, [clips, mediaClips, search]);

  const totalCount = clips.length + mediaClips.length;

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncClips();
    } finally {
      setIsSyncing(false);
    }
  };

  const btnBase =
    "p-1.5 border-none bg-transparent cursor-pointer text-muted-foreground hover:text-foreground transition-colors";
  const btnActive = "text-foreground";

  return (
    <div className="flex h-full w-full flex-col bg-background overflow-auto">
      {/* Full-width container for masonry */}
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

        {/* Controls */}
        {totalCount > 0 && (
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleViewModeChange("list")}
                className={cn(btnBase, viewMode === "list" && btnActive)}
                title="List view"
              >
                <ListIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleViewModeChange("grid")}
                className={cn(btnBase, viewMode === "grid" && btnActive)}
                title="Grid view"
              >
                <LayoutGridIcon className="h-4 w-4" />
              </button>
            </div>

            {agentdbConfigured && (
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="px-0 border-none bg-transparent text-[11px] uppercase tracking-wide text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
              >
                <RefreshCwIcon className={cn("h-3 w-3 inline mr-1", isSyncing && "animate-spin")} />
                {isSyncing ? "Syncing..." : "Sync"}
              </button>
            )}
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">Loading clips...</p>
          </div>
        ) : totalCount === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">No clips yet</p>
            <p className="text-xs text-muted-foreground mt-2">
              Press <kbd className="font-mono text-[11px]">⌘+Shift+C</kbd> to save a clip
            </p>
          </div>
        ) : feedItems.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">No matches</p>
          </div>
        ) : viewMode === "grid" ? (
          /* Masonry grid using CSS columns */
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
            {feedItems.map((feedItem) =>
              feedItem.type === "local" ? (
                <div key={`local-${feedItem.item.id}`} className="break-inside-avoid mb-4">
                  <ClipCard clip={feedItem.item} viewMode="grid" onDelete={deleteClip} />
                </div>
              ) : (
                <MediaClipCard key={`media-${feedItem.item.id}`} clip={feedItem.item} />
              ),
            )}
          </div>
        ) : (
          /* List view - centered with max width */
          <div className="max-w-[640px] mx-auto">
            {feedItems.map((feedItem) =>
              feedItem.type === "local" ? (
                <ClipCard
                  key={`local-${feedItem.item.id}`}
                  clip={feedItem.item}
                  viewMode="list"
                  onDelete={deleteClip}
                />
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
