import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import type { MediaClip } from "@/hooks/useMediaClips";

/**
 * Detail page for a single media clip.
 * Fetches from GET /api/media/:id endpoint.
 */
export function MediaClipViewer() {
  const { mediaId } = useParams<{ mediaId: string }>();
  const [clip, setClip] = useState<MediaClip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMediaClip = async () => {
      if (!mediaId) {
        setError("No media ID provided");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Get server config from chrome.storage.sync
        const result = await chrome.storage.sync.get(["clipsServerConfig"]);
        const clipsServerConfig = result.clipsServerConfig as
          | { baseUrl: string; apiToken: string }
          | undefined;

        if (!clipsServerConfig?.baseUrl) {
          throw new Error("Clips server not configured");
        }

        // Fetch single media clip from server
        const headers: Record<string, string> = {};
        if (clipsServerConfig.apiToken) {
          headers["Authorization"] = `Bearer ${clipsServerConfig.apiToken}`;
        }

        const response = await fetch(`${clipsServerConfig.baseUrl}/api/media/${mediaId}`, {
          headers,
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Media clip not found");
          }
          throw new Error(`Failed to fetch media clip: ${response.statusText}`);
        }

        const data = await response.json();
        setClip(data.clip);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to load media clip";
        setError(errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    loadMediaClip();
  }, [mediaId]);

  // Format file size for display
  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-muted overflow-y-auto">
        <div className="max-w-[680px] mx-auto py-12 px-6 bg-background min-h-screen flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !clip) {
    return (
      <div className="min-h-screen w-full bg-muted overflow-y-auto">
        <div className="max-w-[680px] mx-auto py-12 px-6 bg-background min-h-screen">
          <Link
            to="/clips"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to clips
          </Link>
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-destructive text-sm">{error || "Media clip not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  const hostname = new URL(clip.page_url).hostname;

  return (
    <div className="min-h-screen w-full bg-muted overflow-y-auto">
      <div className="max-w-[680px] mx-auto py-12 px-6 bg-background min-h-screen md:px-5 md:pt-8 md:pb-16 sm:px-4 sm:pt-6 sm:pb-12">
        {/* Back navigation */}
        <Link
          to="/clips"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to clips
        </Link>

        {/* Header */}
        <header className="mb-8 pb-6 border-b border-[var(--border-light)]">
          <h1 className="font-semibold text-[28px] leading-tight text-foreground m-0 tracking-tight md:text-2xl sm:text-[22px]">
            {clip.page_title || `Image from ${hostname}`}
          </h1>
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <a
              href={clip.page_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              {hostname}
              <ExternalLink className="w-3 h-3" />
            </a>
            <span>•</span>
            <time>{new Date(clip.created_at).toLocaleDateString()}</time>
          </div>
        </header>

        {/* Image display */}
        <div className="mb-8">
          <a href={clip.blob_url} target="_blank" rel="noopener noreferrer" className="block">
            <img
              src={clip.blob_url}
              alt={clip.alt_text || clip.page_title || "Media clip"}
              className="max-w-full h-auto rounded-lg block cursor-pointer hover:opacity-90 transition-opacity"
            />
          </a>
        </div>

        {/* Metadata section */}
        <div className="flex flex-col gap-6">
          <MetadataTable clip={clip} formatFileSize={formatFileSize} />
          <AIDescriptionSection clip={clip} />
        </div>
      </div>
    </div>
  );
}

interface MetadataTableProps {
  clip: MediaClip;
  formatFileSize: (bytes: number | null) => string;
}

function MetadataTable({ clip, formatFileSize }: MetadataTableProps) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-foreground m-0">Details</h2>
      <table className="w-full border-collapse text-sm">
        <tbody>
          {clip.width && clip.height && (
            <tr>
              <th className="text-left py-2.5 px-3 w-[120px] text-muted-foreground font-medium border-b border-border">
                Dimensions
              </th>
              <td className="py-2.5 px-3 text-foreground border-b border-border">
                {clip.width} × {clip.height}px
              </td>
            </tr>
          )}
          <tr>
            <th className="text-left py-2.5 px-3 w-[120px] text-muted-foreground font-medium border-b border-border">
              File size
            </th>
            <td className="py-2.5 px-3 text-foreground border-b border-border">
              {formatFileSize(clip.file_size)}
            </td>
          </tr>
          {clip.original_filename && (
            <tr>
              <th className="text-left py-2.5 px-3 w-[120px] text-muted-foreground font-medium border-b border-border">
                Filename
              </th>
              <td className="py-2.5 px-3 text-foreground border-b border-border break-all">
                {clip.original_filename}
              </td>
            </tr>
          )}
          <tr>
            <th className="text-left py-2.5 px-3 w-[120px] text-muted-foreground font-medium border-b border-border">
              Type
            </th>
            <td className="py-2.5 px-3 text-foreground border-b border-border">{clip.mimetype}</td>
          </tr>
          {clip.alt_text && (
            <tr>
              <th className="text-left py-2.5 px-3 w-[120px] text-muted-foreground font-medium border-b border-border">
                Alt text
              </th>
              <td className="py-2.5 px-3 text-foreground border-b border-border">
                {clip.alt_text}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

interface AIDescriptionSectionProps {
  clip: MediaClip;
}

function AIDescriptionSection({ clip }: AIDescriptionSectionProps) {
  const isPending = clip.ai_description_status === "pending";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-foreground m-0">AI Description</h2>
        {isPending && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            Processing...
          </span>
        )}
      </div>
      <p className="m-0 text-[var(--text-secondary)] leading-relaxed">
        {isPending
          ? "AI description is being generated..."
          : clip.ai_description || "No AI description available"}
      </p>
    </div>
  );
}
