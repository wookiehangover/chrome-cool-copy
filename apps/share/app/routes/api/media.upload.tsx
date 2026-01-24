import { data } from "react-router";
import type { Route } from "./+types/api.media.upload";
import { uploadImageToBlob } from "~/lib/blob.server";
import { saveMediaClip } from "~/lib/agentdb.server";
import { queueAIDescriptionGeneration } from "~/lib/ai-description.server";
import { nanoid } from "nanoid";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIMETYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  // 1. Validate Bearer token
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token || token !== process.env.CLIPS_API_TOKEN) {
    return data({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse multipart form data
  const formData = await request.formData();
  const imageFile = formData.get("image") as File | null;
  const metadataStr = formData.get("metadata") as string | null;

  if (!imageFile) {
    return data({ error: "No image provided" }, { status: 400 });
  }

  // 3. Validate file
  if (!ALLOWED_MIMETYPES.includes(imageFile.type)) {
    return data({ error: "Invalid file type" }, { status: 400 });
  }
  if (imageFile.size > MAX_FILE_SIZE) {
    return data({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  // 4. Parse metadata
  let metadata: Record<string, unknown> = {};
  if (metadataStr) {
    try {
      metadata = JSON.parse(metadataStr);
    } catch {
      return data({ error: "Invalid metadata JSON" }, { status: 400 });
    }
  }

  try {
    // 5. Upload to Vercel Blob
    const { url: blobUrl } = await uploadImageToBlob(imageFile, imageFile.name);

    // 6. Save to AgentDB
    const id = nanoid();
    await saveMediaClip({
      id,
      blob_url: blobUrl,
      original_filename: imageFile.name,
      mimetype: imageFile.type,
      file_size: imageFile.size,
      width: metadata.width as number | undefined,
      height: metadata.height as number | undefined,
      alt_text: metadata.altText as string | undefined,
      page_url: (metadata.pageUrl as string) || "",
      page_title: metadata.pageTitle as string | undefined,
    });

    // 7. Queue AI description generation (fire-and-forget)
    queueAIDescriptionGeneration(id, blobUrl);

    return data({ id, blobUrl, success: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    console.error("[Media Upload API] Error:", message);
    return data({ error: message }, { status: 500 });
  }
}

