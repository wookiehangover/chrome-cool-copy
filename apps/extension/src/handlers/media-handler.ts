import type { HandlerMap } from "./types";
import { z } from "zod";

interface ElementBounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface PageInfo {
  scrollWidth: number;
  scrollHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  originalScrollX: number;
  originalScrollY: number;
}

const elementBoundsSchema = z.object({
  top: z.number(),
  left: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});
const pageInfoSchema = z.object({
  scrollWidth: z.number(),
  scrollHeight: z.number(),
  viewportWidth: z.number(),
  viewportHeight: z.number(),
  devicePixelRatio: z.number().positive(),
  originalScrollX: z.number(),
  originalScrollY: z.number(),
});
const clipsServerConfigSchema = z.object({ baseUrl: z.string().url(), apiToken: z.string() });
const uploadMetadataSchema = z.object({
  mimetype: z.string().optional(),
  originalFilename: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  altText: z.string().optional(),
  pageUrl: z.string().optional(),
  pageTitle: z.string().optional(),
});

/**
 * Capture the visible tab and crop to element bounds
 */
async function captureAndCropImage(bounds: ElementBounds, devicePixelRatio = 1): Promise<string> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      throw new Error("No active tab found");
    }
    const tab = tabs[0];

    const screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
    });

    const screenshotResponse = await fetch(screenshotDataUrl);
    const screenshotBlob = await screenshotResponse.blob();
    const image = await createImageBitmap(screenshotBlob);

    const scaledBounds = {
      left: Math.round(bounds.left * devicePixelRatio),
      top: Math.round(bounds.top * devicePixelRatio),
      width: Math.round(bounds.width * devicePixelRatio),
      height: Math.round(bounds.height * devicePixelRatio),
    };

    console.log(
      "[Clean Link Copy] Screenshot captured (" +
        image.width +
        "x" +
        image.height +
        "), cropping with devicePixelRatio:",
      devicePixelRatio,
      "scaledBounds:",
      scaledBounds,
    );

    const clampedBounds = {
      left: Math.max(0, Math.min(scaledBounds.left, image.width)),
      top: Math.max(0, Math.min(scaledBounds.top, image.height)),
      width: Math.min(scaledBounds.width, image.width - Math.max(0, scaledBounds.left)),
      height: Math.min(scaledBounds.height, image.height - Math.max(0, scaledBounds.top)),
    };

    const canvas = new OffscreenCanvas(clampedBounds.width, clampedBounds.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get canvas context");
    }

    ctx.drawImage(
      image,
      clampedBounds.left,
      clampedBounds.top,
      clampedBounds.width,
      clampedBounds.height,
      0,
      0,
      clampedBounds.width,
      clampedBounds.height,
    );

    const blob = await canvas.convertToBlob({ type: "image/png" });
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(z.string().parse(reader.result));
      reader.onerror = () => reject(new Error("Failed to read blob"));
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("[Clean Link Copy] Error capturing and cropping image:", error);
    throw error;
  }
}

/**
 * Capture the entire page by scrolling and stitching screenshots.
 * Uses rate limiting to avoid exceeding MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND.
 */
async function captureEntirePage(tabId: number, pageInfo: PageInfo): Promise<string> {
  const { scrollWidth, scrollHeight, viewportWidth, viewportHeight, devicePixelRatio } = pageInfo;
  const CAPTURE_DELAY_MS = 600;

  console.log(
    "[Clean Link Copy] Capturing entire page:",
    scrollWidth + "x" + scrollHeight,
    "viewport:",
    viewportWidth + "x" + viewportHeight,
    "dpr:",
    devicePixelRatio,
  );

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || tabs.length === 0) {
    throw new Error("No active tab found");
  }
  const tab = tabs[0];

  const cols = Math.ceil(scrollWidth / viewportWidth);
  const rows = Math.ceil(scrollHeight / viewportHeight);
  const totalCaptures = cols * rows;

  console.log("[Clean Link Copy] Will capture", cols, "x", rows, "=", totalCaptures, "screenshots");

  const finalWidth = Math.round(scrollWidth * devicePixelRatio);
  const finalHeight = Math.round(scrollHeight * devicePixelRatio);

  const finalCanvas = new OffscreenCanvas(finalWidth, finalHeight);
  const finalCtx = finalCanvas.getContext("2d");
  if (!finalCtx) {
    throw new Error("Failed to get canvas context");
  }

  finalCtx.fillStyle = "#ffffff";
  finalCtx.fillRect(0, 0, finalWidth, finalHeight);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const scrollX = col * viewportWidth;
      const scrollY = row * viewportHeight;

      await chrome.tabs.sendMessage(tabId, {
        action: "scrollTo",
        x: scrollX,
        y: scrollY,
      });

      await new Promise((resolve) => setTimeout(resolve, 150));

      const screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: "png",
      });

      const response = await fetch(screenshotDataUrl);
      const blob = await response.blob();
      const image = await createImageBitmap(blob);

      const destX = Math.round(scrollX * devicePixelRatio);
      const destY = Math.round(scrollY * devicePixelRatio);

      const remainingWidth = scrollWidth - scrollX;
      const remainingHeight = scrollHeight - scrollY;
      const srcWidth = Math.min(image.width, Math.round(remainingWidth * devicePixelRatio));
      const srcHeight = Math.min(image.height, Math.round(remainingHeight * devicePixelRatio));

      finalCtx.drawImage(image, 0, 0, srcWidth, srcHeight, destX, destY, srcWidth, srcHeight);

      const captureNum = row * cols + col + 1;
      console.log(
        "[Clean Link Copy] Captured section",
        captureNum,
        "/",
        totalCaptures,
        "at scroll",
        scrollX + "," + scrollY,
      );

      if (captureNum < totalCaptures) {
        await new Promise((resolve) => setTimeout(resolve, CAPTURE_DELAY_MS));
      }
    }
  }

  const blob = await finalCanvas.convertToBlob({ type: "image/png" });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(z.string().parse(reader.result));
    reader.onerror = () => reject(new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

export const mediaHandlers: HandlerMap = {
  captureElement: (message, _sender, sendResponse) => {
    const bounds = elementBoundsSchema.parse(message.bounds);
    const devicePixelRatio = z.number().positive().catch(1).parse(message.devicePixelRatio);
    captureAndCropImage(bounds, devicePixelRatio)
      .then((imageData) => {
        sendResponse({ success: true, imageData });
      })
      .catch((error) => {
        console.error("[Clean Link Copy] Error in captureElement handler:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  },

  captureFullPage: (message, sender, sendResponse) => {
    const tabId = sender.tab?.id;
    if (tabId === undefined) {
      sendResponse({ success: false, error: "No tab ID available" });
      return true;
    }
    const pageInfo = pageInfoSchema.parse(message.pageInfo);
    captureEntirePage(tabId, pageInfo)
      .then((imageData) => {
        chrome.tabs.sendMessage(tabId, {
          action: "scrollTo",
          x: pageInfo.originalScrollX,
          y: pageInfo.originalScrollY,
        });
        sendResponse({ success: true, imageData });
      })
      .catch((error) => {
        console.error("[Clean Link Copy] Error in captureFullPage handler:", error);
        chrome.tabs.sendMessage(tabId, {
          action: "scrollTo",
          x: pageInfo.originalScrollX,
          y: pageInfo.originalScrollY,
        });
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return true;
  },

  fetchImage: (message, _sender, sendResponse) => {
    (async () => {
      try {
        const url = z.string().url().parse(message.url);
        console.log("[Background] Fetching image:", url);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
        }
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        sendResponse({
          success: true,
          imageData: Array.from(new Uint8Array(arrayBuffer)),
          mimetype: blob.type,
          size: blob.size,
        });
      } catch (error) {
        console.error("[Background] Error fetching image:", error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  },

  uploadMedia: (message, _sender, sendResponse) => {
    (async () => {
      try {
        const { imageData, metadata } = z
          .object({
            imageData: z.array(z.number().int().min(0).max(255)),
            metadata: uploadMetadataSchema,
          })
          .parse(message);

        const result = await chrome.storage.sync.get(["clipsServerConfig"]);
        const clipsConfig = clipsServerConfigSchema.optional().parse(result.clipsServerConfig);

        if (!clipsConfig?.baseUrl) {
          sendResponse({
            success: false,
            error: "Clips server not configured. Go to Settings to configure it.",
          });
          return;
        }

        const uint8Array = new Uint8Array(imageData);
        const blob = new Blob([uint8Array], {
          type: metadata.mimetype || "image/png",
        });

        const formData = new FormData();
        formData.append("image", blob, metadata.originalFilename);
        formData.append(
          "metadata",
          JSON.stringify({
            width: metadata.width,
            height: metadata.height,
            altText: metadata.altText,
            pageUrl: metadata.pageUrl,
            pageTitle: metadata.pageTitle,
          }),
        );

        const uploadUrl = `${clipsConfig.baseUrl}/api/media/upload`;
        const headers: Record<string, string> = {};
        if (clipsConfig.apiToken) {
          headers["Authorization"] = `Bearer ${clipsConfig.apiToken}`;
        }

        const response = await fetch(uploadUrl, {
          method: "POST",
          headers,
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(errorData.error || `Server returned ${response.status}`);
        }

        const responseData = await response.json();
        console.log("[Background] Media uploaded successfully:", responseData);

        sendResponse({
          success: true,
          id: responseData.id,
          blobUrl: responseData.blobUrl,
        });
      } catch (error) {
        console.error("[Background] Error uploading media:", error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  },

  uploadMediaUrl: (message, _sender, sendResponse) => {
    (async () => {
      try {
        const { url, pageUrl, pageTitle, altText } = z
          .object({
            url: z.string().url(),
            pageUrl: z.string(),
            pageTitle: z.string(),
            altText: z.string(),
          })
          .parse(message);

        const result = await chrome.storage.sync.get(["clipsServerConfig"]);
        const clipsConfig = clipsServerConfigSchema.optional().parse(result.clipsServerConfig);

        if (!clipsConfig?.baseUrl) {
          sendResponse({
            success: false,
            error: "Clips server not configured. Go to Settings to configure it.",
          });
          return;
        }

        const uploadUrl = `${clipsConfig.baseUrl}/api/media/upload-url`;
        const headers = {
          "Content-Type": "application/json",
          ...(clipsConfig.apiToken && { Authorization: `Bearer ${clipsConfig.apiToken}` }),
        };

        const response = await fetch(uploadUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ url, pageUrl, pageTitle, altText }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(errorData.error || `Server returned ${response.status}`);
        }

        const responseData = await response.json();
        console.log("[Background] Media uploaded via URL successfully:", responseData);

        sendResponse({
          success: true,
          id: responseData.id,
          blobUrl: responseData.blobUrl,
        });
      } catch (error) {
        console.error("[Background] Error uploading media via URL:", error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  },
};
