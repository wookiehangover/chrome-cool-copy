import { useState, useMemo, useEffect } from "react";
import { LayoutGridIcon, ListIcon, RefreshCwIcon } from "lucide-react";
import { useClips } from "@/hooks/useClips";
import { useAgentDBConfig } from "@/hooks/useAgentDBConfig";
import { ClipCard } from "@/components/ClipCard";
import { cn } from "@/lib/utils";
import type { LocalClip } from "@repo/shared";

// Fuzzy match function - same as BoostsList
function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  const pattern = query
    .split("")
    .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(pattern, "i").test(text);
}

export function ClipsList() {
  const { clips, isLoading, deleteClip, syncClips } = useClips();
  const { isConfigured: agentdbConfigured } = useAgentDBConfig();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [isSyncing, setIsSyncing] = useState(false);

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

  // Filter clips by fuzzy matching title and URL
  const filteredClips = useMemo(() => {
    if (!search.trim()) return clips;

    return clips.filter((clip) => {
      const title = "type" in clip && clip.type === "element" ? clip.pageTitle : (clip as LocalClip).title;
      return fuzzyMatch(search, title) || fuzzyMatch(search, clip.url);
    });
  }, [clips, search]);

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

        {/* Controls */}
        {clips.length > 0 && (
          <div className="flex items-center justify-between mb-4">
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
        ) : clips.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">No clips yet</p>
            <p className="text-xs text-muted-foreground mt-2">
              Press <kbd className="font-mono text-[11px]">⌘+Shift+C</kbd> to save a clip
            </p>
          </div>
        ) : filteredClips.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">No matches</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 gap-4">
            {filteredClips.map((clip) => (
              <ClipCard key={clip.id} clip={clip} viewMode="grid" onDelete={deleteClip} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredClips.map((clip) => (
              <ClipCard key={clip.id} clip={clip} viewMode="list" onDelete={deleteClip} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
