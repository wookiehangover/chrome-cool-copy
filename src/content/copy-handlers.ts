/**
 * Copy handlers for different element types
 * Handles table, text, image, SVG, and page copying
 */

import { copyToClipboard, copyImageToClipboard } from "./clipboard.js";
import { showToast } from "./toast.js";
import { detectElementType } from "./type-detection.js";

/**
 * Handle table copy
 * @param element - The table element or element containing a table
 */
export async function handleTableCopy(element: Element): Promise<void> {
  try {
    const csv = tableToCSV(element);
    const success = await copyToClipboard(csv);

    if (success) {
      showToast("✓ CSV copied");
    } else {
      showToast("× Failed to copy CSV");
    }
  } catch (error) {
    console.error("[Clean Link Copy] Error copying table:", error);
    showToast("× Failed to copy table");
  }
}

/**
 * Handle page selection - copy entire page content
 */
export async function handlePageSelection(
  forcedType: string | null,
  stopElementPicker: () => void,
): Promise<void> {
  try {
    // Get the main content area - try common content containers first
    const contentSelectors = [
      "main",
      "article",
      '[role="main"]',
      "#content",
      ".content",
      "#main",
      ".main",
    ];

    let contentElement = null;
    for (const selector of contentSelectors) {
      contentElement = document.querySelector(selector);
      if (contentElement) {
        break;
      }
    }

    // Fall back to body if no content container found
    if (!contentElement) {
      contentElement = document.body;
    }

    // Use forced type or detect element type for the page content
    const elementType = forcedType || detectElementType(contentElement);
    console.log(
      "[Clean Link Copy] Page copy type:",
      elementType,
      forcedType ? "(forced)" : "(auto)",
    );

    // Exit picker mode before handling copy
    stopElementPicker();

    // Handle the copy based on element type
    try {
      if (elementType === "table") {
        await handleTableCopy(contentElement);
      } else if (elementType === "text") {
        await handleTextCopy(contentElement);
      } else if (elementType === "svg") {
        await handleSvgCopy(contentElement);
      } else if (elementType === "image" || elementType === "visual") {
        // For visual mode on page, capture full viewport screenshot
        await handleFullPageScreenshot();
      }
    } catch (error) {
      console.error("[Clean Link Copy] Error handling page copy:", error);
      showToast("× Error copying page");
    }
  } catch (error) {
    console.error("[Clean Link Copy] Error copying page:", error);
    showToast("× Failed to copy page");
  }
}

/**
 * Handle full page screenshot - capture the entire page by scrolling
 */
export async function handleFullPageScreenshot(): Promise<void> {
  try {
    console.log("[Clean Link Copy] Capturing full page screenshot");

    // Get full page dimensions
    const scrollWidth = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth);
    const scrollHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
    );
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const devicePixelRatio = window.devicePixelRatio || 1;

    // Store original scroll position to restore later
    const originalScrollX = window.scrollX;
    const originalScrollY = window.scrollY;

    const message = {
      action: "captureFullPage",
      pageInfo: {
        scrollWidth,
        scrollHeight,
        viewportWidth,
        viewportHeight,
        devicePixelRatio,
        originalScrollX,
        originalScrollY,
      },
    };

    console.log(
      "[Clean Link Copy] Requesting full page screenshot, page:",
      scrollWidth + "x" + scrollHeight,
      "viewport:",
      viewportWidth + "x" + viewportHeight,
      "devicePixelRatio:",
      devicePixelRatio,
    );

    // Send message to background service worker
    chrome.runtime.sendMessage(message, (response) => {
      try {
        // Check for errors
        if (chrome.runtime.lastError) {
          console.error(
            "[Clean Link Copy] Failed to send message to background:",
            chrome.runtime.lastError.message,
          );
          showToast("× Failed to capture page");
          return;
        }

        // Check if response indicates success
        if (!response || !response.success) {
          console.error("[Clean Link Copy] Background failed to capture page:", response?.error);
          showToast("× Failed to capture page");
          return;
        }

        // Response should contain a data URL or blob
        if (!response.imageData) {
          console.error("[Clean Link Copy] No image data in response");
          showToast("× Failed to capture page");
          return;
        }

        // Convert data URL to blob and copy to clipboard
        fetch(response.imageData)
          .then((res) => res.blob())
          .then((blob) => copyImageToClipboard(blob))
          .then((success) => {
            if (success) {
              showToast("✓ Full page screenshot copied");
            } else {
              showToast("× Failed to copy page screenshot");
            }
          })
          .catch((error) => {
            console.error("[Clean Link Copy] Error processing captured page:", error);
            showToast("× Failed to copy page screenshot");
          });
      } catch (error) {
        console.error("[Clean Link Copy] Error in capture response handler:", error);
        showToast("× Failed to capture page");
      }
    });
  } catch (error) {
    console.error("[Clean Link Copy] Error in handleFullPageScreenshot:", error);
    showToast("× Failed to capture page");
  }
}

/**
 * Handle text copy - convert HTML to markdown using Turndown
 * @param element - The text element
 */
export async function handleTextCopy(element: Element): Promise<void> {
  try {
    // Get the HTML content from the element
    const html = element.innerHTML;

    if (!html || !html.trim()) {
      showToast("× No content found");
      return;
    }

    // Convert HTML to markdown using Turndown
    let markdown = "";
    try {
      const turndownService = new TurndownService();
      markdown = turndownService.turndown(html);
    } catch (error) {
      console.error("[Clean Link Copy] Error converting HTML to markdown:", error);
      // Fallback to plain text if conversion fails
      const htmlElement = element as HTMLElement;
      markdown = htmlElement.innerText || element.textContent || "";
    }

    if (!markdown || !markdown.trim()) {
      showToast("× No content found");
      return;
    }

    const success = await copyToClipboard(markdown.trim());

    if (success) {
      showToast("✓ Text copied");
    } else {
      showToast("× Failed to copy text");
    }
  } catch (error) {
    console.error("[Clean Link Copy] Error copying text:", error);
    showToast("× Failed to copy text");
  }
}

/**
 * Capture the current frame from a video element and copy to clipboard
 * @param videoElement - The video element to capture from
 * @returns True if successful, false otherwise
 */
export async function captureVideoFrame(videoElement: HTMLVideoElement): Promise<boolean> {
  try {
    // Ensure it's a video element
    if (videoElement.tagName !== "VIDEO") {
      throw new Error("Element is not a video element");
    }

    // Check if video has valid dimensions
    if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      throw new Error("Video has no valid dimensions");
    }

    // Create a canvas with the same dimensions as the video
    const canvas = document.createElement("canvas");
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    // Get the 2D context and draw the current video frame
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get canvas 2D context");
    }

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob and copy to clipboard
    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          console.error("[Clean Link Copy] Failed to create blob from canvas");
          showToast("× Failed to capture video frame");
          resolve(false);
          return;
        }

        try {
          const success = await copyImageToClipboard(blob);
          if (success) {
            showToast("✓ Video frame copied");
          } else {
            showToast("× Failed to copy video frame");
          }
          resolve(success);
        } catch (error) {
          console.error("[Clean Link Copy] Error copying video frame:", error);
          showToast("× Failed to copy video frame");
          resolve(false);
        }
      }, "image/png");
    });
  } catch (error) {
    console.error("[Clean Link Copy] Error capturing video frame:", error);
    showToast("× Failed to capture video frame");
    return false;
  }
}

/**
 * Export a canvas element to PNG blob and copy to clipboard
 * @param canvasElement - The canvas element to export
 * @returns True if successful, false otherwise
 */
export async function captureCanvasFrame(canvasElement: HTMLCanvasElement): Promise<boolean> {
  try {
    // Ensure it's a canvas element
    if (canvasElement.tagName !== "CANVAS") {
      throw new Error("Element is not a canvas element");
    }

    // Check if canvas has valid dimensions
    if (canvasElement.width === 0 || canvasElement.height === 0) {
      throw new Error("Canvas has no valid dimensions");
    }

    // Convert canvas to blob and copy to clipboard
    return new Promise((resolve) => {
      canvasElement.toBlob(async (blob) => {
        if (!blob) {
          console.error("[Clean Link Copy] Failed to create blob from canvas");
          showToast("× Failed to capture canvas");
          resolve(false);
          return;
        }

        try {
          const success = await copyImageToClipboard(blob);
          if (success) {
            showToast("✓ Canvas copied");
          } else {
            showToast("× Failed to copy canvas");
          }
          resolve(success);
        } catch (error) {
          console.error("[Clean Link Copy] Error copying canvas:", error);
          showToast("× Failed to copy canvas");
          resolve(false);
        }
      }, "image/png");
    });
  } catch (error) {
    console.error("[Clean Link Copy] Error capturing canvas:", error);
    showToast("× Failed to capture canvas");
    return false;
  }
}

/**
 * Handle SVG copy - serialize SVG to markup string
 * @param element - The SVG element or element containing SVG
 */
export async function handleSvgCopy(element: Element): Promise<void> {
  try {
    // Find the actual SVG element if the selected element contains an SVG
    const svgElement = element.tagName === "SVG" ? element : element.querySelector("svg");

    if (!svgElement) {
      showToast("× No SVG found in element");
      return;
    }

    // Serialize SVG to markup string
    const svgMarkup = svgElement.outerHTML;

    if (!svgMarkup || !svgMarkup.trim()) {
      showToast("× SVG is empty");
      return;
    }

    // Copy SVG markup as text
    const success = await copyToClipboard(svgMarkup);

    if (success) {
      showToast("✓ SVG copied");
    } else {
      showToast("× Failed to copy SVG");
    }
  } catch (error) {
    console.error("[Clean Link Copy] Error copying SVG:", error);
    showToast("× Failed to copy SVG");
  }
}

/**
 * Fetch an image directly and copy to clipboard
 * @param imageSrc - The image source URL
 * @returns True if successful, false otherwise
 */
export async function fetchAndCopyImage(imageSrc: string): Promise<boolean> {
  try {
    // Handle data URLs directly
    if (imageSrc.startsWith("data:")) {
      const response = await fetch(imageSrc);
      const blob = await response.blob();
      return await copyImageToClipboard(blob);
    }

    // Convert relative URLs to absolute
    let absoluteUrl = imageSrc;
    if (!imageSrc.startsWith("http://") && !imageSrc.startsWith("https://")) {
      const baseUrl = window.location.origin;
      absoluteUrl = new URL(imageSrc, baseUrl).href;
    }

    // Fetch the image
    const response = await fetch(absoluteUrl, {
      mode: "cors",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();
    return await copyImageToClipboard(blob);
  } catch (error) {
    console.error("[Clean Link Copy] Error fetching image directly:", error);
    return false;
  }
}

/**
 * Handle image copy - detect and route direct media elements, fall back to screenshot
 * @param element - The element to capture as image
 */
export async function handleImageCopy(element: Element): Promise<void> {
  try {
    // Route direct media elements first (before checking for nested elements)

    // Handle direct video elements - capture current frame
    if (element.tagName === "VIDEO") {
      console.log("[Clean Link Copy] Detected direct <video> element");
      await captureVideoFrame(element as HTMLVideoElement);
      return;
    }

    // Handle direct canvas elements - export to PNG
    if (element.tagName === "CANVAS") {
      console.log("[Clean Link Copy] Detected direct <canvas> element");
      await captureCanvasFrame(element as HTMLCanvasElement);
      return;
    }

    // Handle direct image elements - try direct copy
    if (element.tagName === "IMG") {
      const imgElement = element as HTMLImageElement;
      const imageSrc = imgElement.src || element.getAttribute("src");
      if (imageSrc) {
        console.log("[Clean Link Copy] Detected direct <img> element, attempting direct copy");
        const success = await fetchAndCopyImage(imageSrc);
        if (success) {
          showToast("✓ Image copied");
          return;
        }
        console.log("[Clean Link Copy] Direct image copy failed, falling back to screenshot");
      }
    }

    // Check for nested media elements (containers with media inside)

    // Check if element contains a video element
    const videoElement = element.querySelector("video") as HTMLVideoElement | null;
    if (videoElement) {
      console.log("[Clean Link Copy] Detected nested <video> element");
      await captureVideoFrame(videoElement);
      return;
    }

    // Check if element contains a canvas element
    const canvasElement = element.querySelector("canvas") as HTMLCanvasElement | null;
    if (canvasElement) {
      console.log("[Clean Link Copy] Detected nested <canvas> element");
      await captureCanvasFrame(canvasElement);
      return;
    }

    // Check if element contains an image element
    const imgElement = element.querySelector("img");
    if (imgElement) {
      const imageSrc = imgElement.src || imgElement.getAttribute("src");
      if (imageSrc) {
        console.log("[Clean Link Copy] Detected nested <img> element, attempting direct copy");
        const success = await fetchAndCopyImage(imageSrc);
        if (success) {
          showToast("✓ Image copied");
          return;
        }
        console.log(
          "[Clean Link Copy] Direct image copy for nested <img> failed, falling back to screenshot",
        );
      }
    }

    // Fall back to screenshot capture for non-media elements or if direct copy failed
    const rect = element.getBoundingClientRect();
    const devicePixelRatio = window.devicePixelRatio || 1;

    const message = {
      action: "captureElement",
      bounds: {
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      devicePixelRatio: devicePixelRatio,
    };

    console.log(
      "[Clean Link Copy] Falling back to screenshot capture with bounds:",
      message.bounds,
      "devicePixelRatio:",
      devicePixelRatio,
    );

    // Send message to background service worker
    chrome.runtime.sendMessage(message, (response) => {
      try {
        // Check for errors
        if (chrome.runtime.lastError) {
          console.error(
            "[Clean Link Copy] Failed to send message to background:",
            chrome.runtime.lastError.message,
          );
          showToast("× Failed to capture image");
          return;
        }

        // Check if response indicates success
        if (!response || !response.success) {
          console.error("[Clean Link Copy] Background failed to capture image:", response?.error);
          showToast("× Failed to capture image");
          return;
        }

        // Response should contain a data URL or blob
        if (!response.imageData) {
          console.error("[Clean Link Copy] No image data in response");
          showToast("× Failed to capture image");
          return;
        }

        // Convert data URL to blob and copy to clipboard
        fetch(response.imageData)
          .then((res) => res.blob())
          .then((blob) => copyImageToClipboard(blob))
          .then((success) => {
            if (success) {
              showToast("✓ Image copied");
            } else {
              showToast("× Failed to copy image");
            }
          })
          .catch((error) => {
            console.error("[Clean Link Copy] Error processing captured image:", error);
            showToast("× Failed to copy image");
          });
      } catch (error) {
        console.error("[Clean Link Copy] Error in capture response handler:", error);
        showToast("× Failed to capture image");
      }
    });
  } catch (error) {
    console.error("[Clean Link Copy] Error in handleImageCopy:", error);
    showToast("× Failed to capture image");
  }
}

/**
 * Convert a table element to CSV format
 * @param tableElement - The table element to convert
 * @returns CSV formatted string
 */
function tableToCSV(tableElement: Element): string {
  try {
    // Find the actual table element if the selected element contains a table
    const table =
      tableElement.tagName === "TABLE" ? tableElement : tableElement.querySelector("table");

    if (!table) {
      throw new Error("No table found in element");
    }

    // Get all rows
    const rows = Array.from(table.querySelectorAll("tr"));

    if (rows.length === 0) {
      throw new Error("Table has no rows");
    }

    // Create a 2D array to handle merged cells
    const maxCols = Math.max(
      ...rows.map((row) => {
        let colCount = 0;
        Array.from(row.querySelectorAll("td, th")).forEach((cell) => {
          colCount += parseInt(cell.getAttribute("colspan") || "1");
        });
        return colCount;
      }),
    );

    // Build the CSV data
    const cellMatrix = Array(rows.length)
      .fill(null)
      .map(() => Array(maxCols).fill(""));

    rows.forEach((row, rowIndex) => {
      let colIndex = 0;
      const cells = Array.from(row.querySelectorAll("td, th"));

      cells.forEach((cell) => {
        // Skip already filled cells (from colspan/rowspan)
        while (colIndex < maxCols && cellMatrix[rowIndex][colIndex] !== "") {
          colIndex++;
        }

        const colspan = parseInt(cell.getAttribute("colspan") || "1");
        const rowspan = parseInt(cell.getAttribute("rowspan") || "1");
        const cellText = cell.textContent.trim();

        // Fill the cell and handle colspan/rowspan
        for (let r = 0; r < rowspan; r++) {
          for (let c = 0; c < colspan; c++) {
            if (rowIndex + r < rows.length) {
              cellMatrix[rowIndex + r][colIndex + c] = cellText;
            }
          }
        }

        colIndex += colspan;
      });
    });

    // Convert matrix to CSV
    const csvContent = cellMatrix
      .map((row) => {
        return row
          .map((cell) => {
            // Escape quotes and wrap in quotes if contains comma, newline, or quote
            const escaped = cell.replace(/"/g, '""');
            if (escaped.includes(",") || escaped.includes("\n") || escaped.includes('"')) {
              return `"${escaped}"`;
            }
            return escaped;
          })
          .join(",");
      })
      .join("\n");

    return csvContent;
  } catch (error) {
    console.error("Error converting table to CSV:", error);
    throw error;
  }
}
