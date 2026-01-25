import { data } from "react-router";
import type { Route } from "./+types/api.media.upload-url";
import { uploadImageToBlob } from "~/lib/blob.server";
import { saveMediaClip } from "~/lib/agentdb.server";
import { queueAIDescriptionGeneration } from "~/lib/ai-description.server";
import { nanoid } from "nanoid";
import imageSize from "image-size";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIMETYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// Map file extensions to mimetypes
const EXT_TO_MIMETYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

/**
 * Extract mimetype from URL extension
 */
function getMimetypeFromUrl(url: string): string | undefined {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split(".").pop()?.toLowerCase();
    if (ext) {
      return EXT_TO_MIMETYPE[ext];
    }
  } catch {
    // Invalid URL, ignore
  }
  return undefined;
}

/**
 * Extract filename from URL
 */
function getFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split("/");
    const lastSegment = segments[segments.length - 1];
    if (lastSegment && lastSegment.includes(".")) {
      return decodeURIComponent(lastSegment);
    }
  } catch {
    // Invalid URL, ignore
  }
  return `image_${Date.now()}.png`;
}

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

  // 2. Parse JSON body
  let body: { url?: string; pageUrl?: string; pageTitle?: string; altText?: string };
  try {
    body = await request.json();
  } catch {
    return data({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url, pageUrl, pageTitle, altText } = body;

  if (!url || typeof url !== "string") {
    return data({ error: "URL is required" }, { status: 400 });
  }

  if (!pageUrl || typeof pageUrl !== "string") {
    return data({ error: "pageUrl is required" }, { status: 400 });
  }

  try {
    // 3. Fetch the image server-side
    console.log("[Media Upload URL API] Fetching image from:", url);
    const imageResponse = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ClipsBot/1.0)",
      },
    });

    if (!imageResponse.ok) {
      return data(
        { error: `Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}` },
        { status: 400 },
      );
    }

    // 4. Get image data
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    if (imageBuffer.length > MAX_FILE_SIZE) {
      return data({ error: "Image too large (max 10MB)" }, { status: 400 });
    }

    // 5. Detect mimetype from Content-Type header or URL extension
    const contentType = imageResponse.headers.get("Content-Type")?.split(";")[0];
    let mimetype = contentType && ALLOWED_MIMETYPES.includes(contentType) ? contentType : undefined;

    if (!mimetype) {
      mimetype = getMimetypeFromUrl(url);
    }

    if (!mimetype || !ALLOWED_MIMETYPES.includes(mimetype)) {
      return data({ error: "Unsupported image type" }, { status: 400 });
    }

    // 6. Get image dimensions using image-size
    let width: number | undefined;
    let height: number | undefined;
    try {
      const dimensions = imageSize(imageBuffer);
      width = dimensions.width;
      height = dimensions.height;
    } catch (dimError) {
      console.warn("[Media Upload URL API] Could not detect image dimensions:", dimError);
    }

    // 7. Create blob for upload
    const filename = getFilenameFromUrl(url);
    const blob = new Blob([imageBuffer], { type: mimetype });

    // 8. Upload to Vercel Blob
    const { url: blobUrl } = await uploadImageToBlob(blob, filename);

    // 9. Save to AgentDB
    const id = nanoid();
    await saveMediaClip({
      id,
      blob_url: blobUrl,
      original_filename: filename,
      mimetype,
      file_size: imageBuffer.length,
      width,
      height,
      alt_text: altText,
      page_url: pageUrl,
      page_title: pageTitle,
    });

    // 10. Queue AI description generation (fire-and-forget)
    queueAIDescriptionGeneration(id, blobUrl);

    console.log("[Media Upload URL API] Image saved:", id);
    return data({ id, blobUrl, success: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    console.error("[Media Upload URL API] Error:", message);
    return data({ error: message }, { status: 500 });
  }
}
