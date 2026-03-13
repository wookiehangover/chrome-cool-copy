import { data } from "react-router";
import type { Route } from "./+types/api.media.delete";
import { deleteMediaClip } from "~/lib/agentdb.server";
import { isAuthenticated } from "~/lib/auth.server";

export async function action({ request }: Route.ActionArgs) {
  // Support both DELETE (extension API) and POST (share app fetcher)
  if (request.method !== "DELETE" && request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  // Auth: accept Bearer token OR cookie auth
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  const hasBearerAuth = token && token === process.env.CLIPS_API_TOKEN;
  const hasCookieAuth = isAuthenticated(request);

  if (!hasBearerAuth && !hasCookieAuth) {
    return data({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse the media clip ID from either JSON body or form data
  let id: string | undefined;

  const contentType = request.headers.get("Content-Type") || "";
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    id = formData.get("id")?.toString();
  } else {
    try {
      const body = await request.json();
      id = body?.id;
    } catch {
      return data({ error: "Invalid JSON body" }, { status: 400 });
    }
  }

  if (!id) {
    return data({ error: "Media clip ID is required" }, { status: 400 });
  }

  try {
    const deleted = await deleteMediaClip(id);

    if (!deleted) {
      return data({ error: "Media clip not found" }, { status: 404 });
    }

    return data({ success: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    console.error("[Media Delete API] Error:", message);
    return data({ error: message }, { status: 500 });
  }
}

