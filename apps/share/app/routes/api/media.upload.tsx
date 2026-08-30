import { data } from "react-router";
import type { Route } from "./+types/media.upload";
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
  const imageEntry = formData.get("image");
  const metadataEntry = formData.get("metadata");

  if (!(imageEntry instanceof File)) {
    return data({ error: "No image provided" }, { status: 400 });
  }
  const imageFile = imageEntry;
  const metadataStr = metadataEntry instanceof File ? null : metadataEntry;

  // 3. Validate file
  if (!ALLOWED_MIMETYPES.includes(imageFile.type)) {
    return data({ error: "Invalid file type" }, { status: 400 });
  }
  if (imageFile.size > MAX_FILE_SIZE) {
    return data({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  // 4. Parse metadata
  let width: number | undefined;
  let height: number | undefined;
  let altText: string | undefined;
  let pageUrl = "";
  let pageTitle: string | undefined;
  if (metadataStr) {
    try {
      const metadata = JSON.parse(metadataStr);
      if (metadata !== null && Object(metadata) === metadata) {
        const read = (key: string) => Object.getOwnPropertyDescriptor(metadata, key)?.value;
        const rawWidth = read("width");
        const rawHeight = read("height");
        const rawAltText = read("altText");
        const rawPageUrl = read("pageUrl");
        const rawPageTitle = read("pageTitle");
        if (Object.prototype.toString.call(rawWidth) === "[object Number]")
          width = Number(rawWidth);
        if (Object.prototype.toString.call(rawHeight) === "[object Number]")
          height = Number(rawHeight);
        if (Object.prototype.toString.call(rawAltText) === "[object String]")
          altText = String(rawAltText);
        if (Object.prototype.toString.call(rawPageUrl) === "[object String]")
          pageUrl = String(rawPageUrl);
        if (Object.prototype.toString.call(rawPageTitle) === "[object String]")
          pageTitle = String(rawPageTitle);
      }
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
      width,
      height,
      alt_text: altText,
      page_url: pageUrl,
      page_title: pageTitle,
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
