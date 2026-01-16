import { data } from "react-router";
import type { Route } from "./+types/api.share";
import { shareClip } from "~/lib/agentdb.server";
import { isAuthenticated } from "~/lib/auth.server";

/**
 * API route handler for sharing clips
 * Accepts POST requests with either:
 * - { id: number } - Database ID of the clip
 * - { url: string } - URL of the clip
 *
 * Returns the share_id for the clip
 *
 * Requires authentication via cookie
 */
export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  // Check authentication
  if (!isAuthenticated(request)) {
    return data({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const id = formData.get("id");

    // Validate input
    if (!id) {
      return data({ error: "Either 'id' (number) or 'url' (string) is required" }, { status: 400 });
    }

    const shareId = await shareClip(id);

    if (!shareId) {
      return data({ error: "Clip not found" }, { status: 404 });
    }

    return data({ share_id: shareId }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to share clip";
    console.error("[Share API] Error:", message);
    return data({ error: message }, { status: 500 });
  }
}
