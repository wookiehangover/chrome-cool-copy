import { data } from "react-router";
import type { Route } from "./+types/share.$shareId";
import { getClipByShareId } from "~/lib/agentdb.server";
import { ShareViewer } from "~/components/ShareViewer";

/**
 * Server-side loader - fetches the clip data before rendering
 */
export async function loader({ params }: Route.LoaderArgs) {
  const { shareId } = params;

  if (!shareId) {
    throw data({ message: "Share ID is required" }, { status: 400 });
  }

  const clip = await getClipByShareId(shareId);

  if (!clip) {
    throw data({ message: `Clip not found for share ID: ${shareId}` }, { status: 404 });
  }

  return { clip };
}

/**
 * Meta function for SEO - uses the clip data from the loader
 */
export function meta({ data }: Route.MetaArgs) {
  if (!data?.clip) {
    return [
      { title: "Clip Not Found - Chrome Cool Copy" },
      { name: "description", content: "The requested clip could not be found." },
    ];
  }

  const { clip } = data;
  const description = clip.text_content
    ? clip.text_content.slice(0, 160).trim() + (clip.text_content.length > 160 ? "..." : "")
    : `Shared clip from ${new URL(clip.url).hostname}`;

  return [
    { title: `${clip.title} - Chrome Cool Copy` },
    { name: "description", content: description },
    { property: "og:title", content: clip.title },
    { property: "og:description", content: description },
    { property: "og:type", content: "article" },
    { property: "og:url", content: clip.url },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: clip.title },
    { name: "twitter:description", content: description },
  ];
}

/**
 * Share page component - renders the clip viewer with data from the loader
 */
export default function SharePage({ loaderData }: Route.ComponentProps) {
  const { clip } = loaderData;
  return <ShareViewer clip={clip} />;
}

/**
 * Error boundary for handling loader errors
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  // Handle 404 errors
  if (error && typeof error === "object" && "status" in error) {
    const routeError = error as { status: number; data?: { message?: string } };

    if (routeError.status === 404) {
      return (
        <div className="flex h-screen w-full flex-col bg-background text-foreground">
          <div className="flex items-center justify-center flex-1">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-4">Clip Not Found</h1>
              <p className="text-muted-foreground">
                {routeError.data?.message || "The shared clip does not exist."}
              </p>
              <p className="text-sm text-muted-foreground mt-4">
                Please check the share link and try again.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (routeError.status === 400) {
      return (
        <div className="flex h-screen w-full flex-col bg-background text-foreground">
          <div className="flex items-center justify-center flex-1">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-4 text-destructive">Bad Request</h1>
              <p className="text-muted-foreground">
                {routeError.data?.message || "Invalid request."}
              </p>
            </div>
          </div>
        </div>
      );
    }
  }

  // Handle other errors
  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground">
      <div className="flex items-center justify-center flex-1">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4 text-destructive">Error</h1>
          <p className="text-muted-foreground mb-2">
            {error instanceof Error ? error.message : "An unexpected error occurred."}
          </p>
          <p className="text-sm text-muted-foreground">
            Failed to load the shared clip. Please try again later.
          </p>
        </div>
      </div>
    </div>
  );
}
