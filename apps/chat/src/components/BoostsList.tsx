import { useState, useMemo } from "react";
import { useBoosts } from "@/hooks/useBoosts";
import { BoostCard } from "@/components/BoostCard";

// Build a fuzzy regex: "gb" -> /g.*b/i (matches "GitHub", "global", etc.)
function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  const pattern = query
    .split("")
    .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(pattern, "i").test(text);
}

export function BoostsList() {
  const { boosts, boostsByDomain, isLoading, deleteBoost, runBoost } = useBoosts();
  const [search, setSearch] = useState("");

  // Filter boosts by fuzzy matching title
  const filteredByDomain = useMemo(() => {
    if (!search.trim()) return boostsByDomain;

    const result: typeof boostsByDomain = {};
    for (const [domain, domainBoosts] of Object.entries(boostsByDomain)) {
      const matched = domainBoosts.filter((b) => fuzzyMatch(search, b.name));
      if (matched.length > 0) {
        result[domain] = matched;
      }
    }
    return result;
  }, [boostsByDomain, search]);

  // Sort domains, but put '*' (all sites) at the end
  const sortedDomains = Object.keys(filteredByDomain).sort((a, b) => {
    if (a === "*") return 1;
    if (b === "*") return -1;
    return a.localeCompare(b);
  });

  const hasResults = sortedDomains.length > 0;

  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground">
      {/* Search - only show when there are boosts */}
      {boosts.length > 0 && (
        <div className="px-4 pt-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-foreground/50"
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <p className="text-sm text-muted-foreground">Loading boosts...</p>
          </div>
        ) : boosts.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <p className="text-sm text-muted-foreground">No boosts yet</p>
          </div>
        ) : !hasResults ? (
          <div className="flex items-center justify-center p-8">
            <p className="text-sm text-muted-foreground">No matches</p>
          </div>
        ) : (
          <div className="space-y-4 p-4">
            {sortedDomains.map((domain) => (
              <div key={domain}>
                {/* Domain header */}
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {domain === "*" ? "All Sites" : domain}
                </h3>
                {/* Boosts for this domain */}
                <div className="space-y-2">
                  {filteredByDomain[domain].map((boost) => (
                    <BoostCard
                      key={boost.id}
                      boost={boost}
                      onDelete={deleteBoost}
                      onRun={runBoost}
                      isLoading={isLoading}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
