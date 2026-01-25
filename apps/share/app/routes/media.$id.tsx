import { data } from "react-router";
import type { Route } from "./+types/media.$id";
import { getMediaClipById } from "~/lib/agentdb.server";
import { MediaViewer } from "~/components/MediaViewer";

/**
 * Server-side loader - fetches the media clip data before rendering
 */
export async function loader({ params }: Route.LoaderArgs) {
  const { id } = params;

  if (!id) {
    throw data({ message: "Media ID is required" }, { status: 400 });
  }

  const clip = await getMediaClipById(id);

  if (!clip) {
    throw data({ message: `Media clip not found for ID: ${id}` }, { status: 404 });
  }

  return { clip };
}

/**
 * Meta function for SEO and social sharing
 */
export function meta({ data }: Route.MetaArgs) {
  if (!data?.clip) {
    return [
      { title: "Image Not Found - Chrome Cool Copy" },
      { name: "description", content: "The requested image could not be found." },
    ];
  }

  const { clip } = data;
  const hostname = new URL(clip.page_url).hostname;
  const title = clip.page_title ? `Image from ${clip.page_title}` : `Image from ${hostname}`;
  const description = clip.ai_description || clip.alt_text || `Captured from ${hostname}`;

  return [
    { title: `${title} - Chrome Cool Copy` },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "article" },
    { property: "og:image", content: clip.blob_url },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: clip.blob_url },
  ];
}

/**
 * Media detail page component
 */
export default function MediaPage({ loaderData }: Route.ComponentProps) {
  const { clip } = loaderData;
  return <MediaViewer clip={clip} />;
}

/**
 * Error boundary for handling loader errors
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (error && typeof error === "object" && "status" in error) {
    const routeError = error as { status: number; data?: { message?: string } };

    if (routeError.status === 404) {
      return (
        <div className="flex h-screen w-full flex-col bg-background text-foreground">
          <div className="flex items-center justify-center flex-1">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-4">Image Not Found</h1>
              <p className="text-muted-foreground">
                {routeError.data?.message || "The image does not exist."}
              </p>
              <p className="text-sm text-muted-foreground mt-4">
                Please check the link and try again.
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

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground">
      <div className="flex items-center justify-center flex-1">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4 text-destructive">Error</h1>
          <p className="text-muted-foreground mb-2">
            {error instanceof Error ? error.message : "An unexpected error occurred."}
          </p>
          <p className="text-sm text-muted-foreground">
            Failed to load the image. Please try again later.
          </p>
        </div>
      </div>
    </div>
  );
}
