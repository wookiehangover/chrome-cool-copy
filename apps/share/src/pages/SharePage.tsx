import { useParams } from "react-router-dom";
import { useClipFromAgentDB } from "@/hooks/useClipFromAgentDB";
import { ShareViewer } from "@/components/ShareViewer";

export function SharePage() {
  const { shareId } = useParams<{ shareId: string }>();
  const { clip, loading, error } = useClipFromAgentDB(shareId || "");

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen w-full flex-col bg-background text-foreground">
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <div className="animate-pulse">
              <div className="h-8 w-48 bg-secondary rounded mb-4 mx-auto" />
              <div className="h-4 w-32 bg-secondary rounded mx-auto" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-screen w-full flex-col bg-background text-foreground">
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4 text-destructive">Error</h1>
            <p className="text-muted-foreground mb-2">{error.message}</p>
            <p className="text-sm text-muted-foreground">
              Failed to load the shared clip. Please check the share link and try again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Not found state
  if (!clip) {
    return (
      <div className="flex h-screen w-full flex-col bg-background text-foreground">
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Clip Not Found</h1>
            <p className="text-muted-foreground">
              The shared clip with ID <code className="bg-secondary px-2 py-1 rounded">{shareId}</code> does not exist.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              Please check the share link and try again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render the clip viewer
  return <ShareViewer clip={clip} />;
}

