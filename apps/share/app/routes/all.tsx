import { data } from "react-router";
import type { Route } from "./+types/all";
import { getAllClips } from "~/lib/agentdb.server";
import { ClipsList } from "~/components/ClipsList";

/**
 * Server-side loader - fetches all clips from the database
 */
export async function loader() {
  try {
    const clips = await getAllClips();
    return { clips };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load clips";
    console.error("[All Clips Route] Error:", message);
    throw data({ message }, { status: 500 });
  }
}

/**
 * Meta function for SEO
 */
export function meta(): Route.MetaDescriptors {
  return [
    { title: "All Clips - Chrome Cool Copy" },
    { name: "description", content: "Browse all shared clips from Chrome Cool Copy" },
  ];
}

/**
 * All clips page component
 */
export default function AllClipsPage({ loaderData }: Route.ComponentProps) {
  const { clips } = loaderData;
  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground">
      <ClipsList clips={clips} />
    </div>
  );
}

/**
 * Error boundary for the all clips route
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Failed to load clips";
  let details = "An unexpected error occurred while loading the clips list.";

  if (error instanceof Error) {
    message = error.message;
    details = error.message;
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground">
      <div className="flex items-center justify-center flex-1">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4 text-destructive">Error</h1>
          <p className="text-muted-foreground mb-2">{message}</p>
          <p className="text-sm text-muted-foreground">{details}</p>
        </div>
      </div>
    </div>
  );
}

