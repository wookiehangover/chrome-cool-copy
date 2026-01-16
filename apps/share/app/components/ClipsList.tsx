import { Loader2, Share } from "lucide-react";
import { useState, useMemo } from "react";
import { Link, useFetcher } from "react-router";
import type { LightweightClip } from "~/lib/agentdb.server";

interface ClipsListProps {
  clips: LightweightClip[];
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

export function ClipsList({ clips }: ClipsListProps) {
  const [search, setSearch] = useState("");

  // Filter clips by fuzzy matching title and URL
  const filteredClips = useMemo(() => {
    if (!search.trim()) return clips;

    return clips.filter((clip) => {
      return fuzzyMatch(search, clip.title) || fuzzyMatch(search, clip.url);
    });
  }, [clips, search]);

  return (
    <div className="flex h-full w-full flex-col bg-background">
      {/* Container for centered content */}
      <div className="mx-auto w-full max-w-[640px] px-6 py-12">
        {/* Search section */}
        {clips.length > 0 && (
          <div className="mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clips..."
              className="w-full py-3 bg-transparent border-0 border-b border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-foreground transition-colors"
            />
          </div>
        )}

        {/* Content */}
        {clips.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">No clips yet</p>
          </div>
        ) : filteredClips.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">No matches</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredClips.map((clip) => (
              <ClipItem key={clip.id} clip={clip} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ClipItem({ clip }: { clip: LightweightClip }) {
  const fetcher = useFetcher();

  const shareId = useMemo(
    () => fetcher.data?.share_id ?? clip.share_id,
    [fetcher.data, clip.share_id]
  );

  return (
    <div className="group py-3 px-3 border-b border-border cursor-pointerrounded flex items-center">
      <Link to={`/share/${shareId}`} className="space-y-1 grow">
        <h3 className="text-sm font-medium text-foreground group-hover:text-foreground transition-colors">
          {clip.title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{new URL(clip.url).hostname}</span>
          <span>•</span>
          <time>{new Date(clip.captured_at).toLocaleDateString()}</time>
        </div>
      </Link>
      {shareId === null && (
        <fetcher.Form method="POST" action="/api/share">
          <button
            type="submit"
            name="id"
            value={clip.id}
            className="group-hover:text-foreground transition-colors border border-border rounded-md p-1"
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
  );
}
