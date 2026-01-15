import { data } from "react-router";
import type { Route } from "./+types/all";
import { getAllClips } from "~/lib/agentdb.server";
import { ClipsList } from "~/components/ClipsList";
import { useState } from "react";

// Password constant
const PASSWORD = "swordfish";
const AUTH_COOKIE_NAME = "all_clips_auth";

/**
 * Server-side action - handles password submission
 */
export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const password = formData.get("password");

    if (password === PASSWORD) {
      // Set authentication cookie
      return data(
        { success: true },
        {
          status: 200,
          headers: {
            "Set-Cookie": `${AUTH_COOKIE_NAME}=authenticated; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`,
          },
        }
      );
    } else {
      return data({ error: "Invalid password" }, { status: 401 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process password";
    console.error("[All Clips Route] Action error:", message);
    return data({ error: message }, { status: 500 });
  }
}

/**
 * Server-side loader - checks authentication and fetches clips
 */
export async function loader({ request }: Route.LoaderArgs) {
  try {
    // Check for authentication cookie
    const cookieHeader = request.headers.get("Cookie");
    const isAuthenticated = cookieHeader?.includes(`${AUTH_COOKIE_NAME}=authenticated`) ?? false;

    if (!isAuthenticated) {
      // Return flag to show login form
      return { authenticated: false, clips: null };
    }

    // Fetch clips if authenticated
    const clips = await getAllClips();
    return { authenticated: true, clips };
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
export default function AllClipsPage({ loaderData, actionData }: Route.ComponentProps) {
  const { authenticated, clips } = loaderData;
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const actionError = actionData && "error" in actionData ? actionData.error : undefined;

  if (!authenticated) {
    return (
      <div className="flex h-screen w-full flex-col bg-background text-foreground">
        <div className="flex items-center justify-center flex-1">
          <div className="w-full max-w-md px-6">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">All Clips</h1>
              <p className="text-muted-foreground">Enter password to view all clips</p>
            </div>

            <form method="POST" className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={isSubmitting}
                />
              </div>

              {actionError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
                  {actionError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !password}
                onClick={() => setIsSubmitting(true)}
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? "Authenticating..." : "Unlock"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground">
      <ClipsList clips={clips || []} />
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

