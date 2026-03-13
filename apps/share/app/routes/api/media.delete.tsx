import { data } from "react-router";
import type { Route } from "./+types/api.media.delete";
import { deleteMediaClip } from "~/lib/agentdb.server";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "DELETE") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  // 1. Validate Bearer token
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token || token !== process.env.CLIPS_API_TOKEN) {
    return data({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse JSON body for the media clip ID
  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return data({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id } = body;
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

