import { data } from "react-router";
import type { Route } from "./+types/media.$id";
import { getMediaClipById } from "~/lib/agentdb.server";

export async function loader({ params }: Route.LoaderArgs) {
  const { id } = params;

  if (!id) {
    throw data({ error: "Media ID is required" }, { status: 400 });
  }

  const clip = await getMediaClipById(id);

  if (!clip) {
    throw data({ error: "Media clip not found" }, { status: 404 });
  }

  return { clip };
}
