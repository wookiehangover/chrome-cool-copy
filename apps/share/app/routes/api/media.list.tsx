import { data } from "react-router";
import type { Route } from "./+types/media.list";
import { getMediaClips } from "~/lib/agentdb.server";
import { isAuthenticated } from "~/lib/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  // Auth: accept Bearer token (extension/clips app) OR cookie auth (share UI).
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  const hasBearerAuth = token && token === process.env.CLIPS_API_TOKEN;
  const hasCookieAuth = isAuthenticated(request);

  if (!hasBearerAuth && !hasCookieAuth) {
    return data({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);

  // Clamp limit to reasonable bounds
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const offset = (page - 1) * safeLimit;

  try {
    const { clips, total } = await getMediaClips({ limit: safeLimit, offset });

    return data({
      clips,
      pagination: {
        page,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch media clips";
    return data({ error: message }, { status: 500 });
  }
}
