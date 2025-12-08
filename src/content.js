// Content script for URL cleaning and clipboard operations

// List of common tracking parameters to remove
const TRACKING_PARAMS = [
  // UTM parameters
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_source_platform",
  "utm_creative_format",
  "utm_marketing_tactic",

  // Facebook
  "fbclid",
  "fb_action_ids",
  "fb_action_types",
  "fb_ref",
  "fb_source",

  // Google
  "gclid",
  "gclsrc",
  "dclid",
  "gbraid",
  "wbraid",

  // Other common tracking parameters
  "ref",
  "source",
  "mc_cid",
  "mc_eid",
  "_ga",
  "_gl",
  "msclkid",
  "igshid",
  "twclid",
  "li_fat_id",
  "wickedid",
  "yclid",
  "ncid",
  "srsltid",
  "si",
  "feature",
  "app",
  "ved",
  "usg",
  "sa",
  "ei",
  "bvm",
  "sxsrf",
];

/**
 * Clean URL by removing tracking parameters
 * @param {string} url - The URL to clean
 * @returns {string} - The cleaned URL
 */
function cleanUrl(url) {
  try {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);

    // Remove tracking parameters
    TRACKING_PARAMS.forEach((param) => {
      params.delete(param);
    });

    // Reconstruct the URL
    urlObj.search = params.toString();

    // Return the clean URL (remove trailing '?' if no params remain)
    let cleanedUrl = urlObj.toString();
    if (cleanedUrl.endsWith("?")) {
      cleanedUrl = cleanedUrl.slice(0, -1);
    }

    return cleanedUrl;
  } catch (error) {
    console.error("Error cleaning URL:", error);
    return url; // Return original URL if parsing fails
  }
}

/**
 * Copy text to clipboard
 * @param {string} text - The text to copy
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
}

/**
 * Copy image blob to clipboard
 * @param {Blob} blob - The image blob to copy
 */
async function copyImageToClipboard(blob) {
  try {
    const item = new ClipboardItem({ "image/png": blob });
    await navigator.clipboard.write([item]);
    return true;
  } catch (error) {
    console.error("Failed to copy image to clipboard:", error);
    return false;
  }
}

/**
 * Show toast notification
 * @param {string} message - The message to display
 */
function showToast(message) {
  try {
    // Remove any existing toast
    const existingToast = document.getElementById("clean-link-copy-toast");
    if (existingToast) {
      existingToast.remove();
    }

    // Create toast element
    const toast = document.createElement("div");
    toast.id = "clean-link-copy-toast";
    toast.className = "clean-link-copy-toast";
    toast.textContent = message;

    // Add to page
    if (!document.body) {
      console.error(
        "[Clean Link Copy] Cannot show toast: document body not available",
      );
      return;
    }

    document.body.appendChild(toast);

    // Trigger fade-in animation
    setTimeout(() => {
      try {
        toast.classList.add("show");
      } catch (error) {
        console.error(
          "[Clean Link Copy] Error adding show class to toast:",
          error,
        );
      }
    }, 10);

    // Remove after 2.5 seconds
    setTimeout(() => {
      try {
        toast.classList.remove("show");
        // Remove from DOM after fade-out animation completes
        setTimeout(() => {
          if (toast.parentNode) {
            toast.remove();
          }
        }, 300);
      } catch (error) {
        console.error("[Clean Link Copy] Error removing toast:", error);
        // Force remove if error occurs
        if (toast.parentNode) {
          toast.remove();
        }
      }
    }, 2500);
  } catch (error) {
    console.error("[Clean Link Copy] Error showing toast:", error);
    // Fallback: log to console if toast fails
    console.log("[Clean Link Copy] Toast message:", message);
  }
}

/**
 * Get the page title
 * @returns {string} - The page title
 */
function getPageTitle() {
  return document.title || "Untitled";
}

/**
 * Create a markdown link
 * @param {string} url - The URL
 * @param {string} title - The link title
 * @returns {string} - The markdown formatted link
 */
function createMarkdownLink(url, title) {
  // Escape square brackets in title
  const escapedTitle = title.replace(/\[/g, "\\[").replace(/\]/g, "\\]");
  return `[${escapedTitle}](${url})`;
}

/**
 * Handle the copy clean URL action
 */
async function handleCopyCleanUrl() {
  const currentUrl = window.location.href;
  const cleanedUrl = cleanUrl(currentUrl);

  const success = await copyToClipboard(cleanedUrl);

  if (success) {
    showToast("✓ Link copied");
  } else {
    showToast("× Failed to copy link");
  }
}

/**
 * Handle the copy markdown link action
 */
async function handleCopyMarkdownLink() {
  const currentUrl = window.location.href;
  const cleanedUrl = cleanUrl(currentUrl);
  const pageTitle = getPageTitle();
  const markdownLink = createMarkdownLink(cleanedUrl, pageTitle);

  const success = await copyToClipboard(markdownLink);

  if (success) {
    showToast("✓ Link copied");
  } else {
    showToast("× Failed to copy link");
  }
}

/**
 * Element Picker State
 */
let elementPickerActive = false;
let currentHighlightedElement = null;
let pickerOverlay = null;
let selectedElement = null;
let forcedType = null; // null = auto, or 'table', 'text', 'image', 'visual'

/**
 * Set the forced type for element picking
 * @param {string|null} type - The type to force, or null for auto
 */
function setForcedType(type) {
  forcedType = type;
}

/**
 * Create and show the picker overlay
 */
function createPickerOverlay() {
  try {
    if (pickerOverlay) {
      return pickerOverlay;
    }

    const overlay = document.createElement("div");
    overlay.id = "element-picker-overlay";
    overlay.className = "element-picker-overlay";
    overlay.innerHTML = `
      <div class="element-picker-page-button" id="element-picker-page-button">Page</div>
      <div class="element-picker-message">
        <span>Select element to copy</span>
        <div class="element-picker-toolbar">
          <select class="element-picker-type-select" id="element-picker-type-select">
            <option value="auto">auto</option>
            <option value="table">table</option>
            <option value="text">text</option>
            <option value="visual">visual</option>
          </select>
          <span class="element-picker-type" id="element-picker-type"></span>
        </div>
      </div>
    `;

    // Prevent toolbar interactions from triggering picker
    const toolbar = overlay.querySelector(".element-picker-toolbar");
    toolbar.addEventListener("click", (e) => e.stopPropagation());
    toolbar.addEventListener("mousedown", (e) => e.stopPropagation());

    // Add click handler for Page button
    const pageButton = overlay.querySelector(".element-picker-page-button");
    pageButton.addEventListener("click", async (e) => {
      e.stopPropagation();
      e.preventDefault();
      await handlePageSelection();
    });
    pageButton.addEventListener("mousedown", (e) => e.stopPropagation());

    // Add change handler for type select
    const typeSelect = overlay.querySelector(".element-picker-type-select");
    typeSelect.addEventListener("change", (e) => {
      e.stopPropagation();
      const type = typeSelect.value;
      setForcedType(type === "auto" ? null : type);
      // Update the type indicator if there's a highlighted element
      if (currentHighlightedElement) {
        const displayType =
          forcedType || detectElementType(currentHighlightedElement);
        updateTypeIndicator(displayType);
      }
    });

    if (!document.body) {
      throw new Error("Document body not available");
    }

    document.body.appendChild(overlay);
    pickerOverlay = overlay;
    return overlay;
  } catch (error) {
    console.error("[Clean Link Copy] Error creating picker overlay:", error);
    throw error;
  }
}

/**
 * Remove the picker overlay
 */
function removePickerOverlay() {
  try {
    if (pickerOverlay) {
      if (pickerOverlay.parentNode) {
        pickerOverlay.remove();
      }
      pickerOverlay = null;
    }
  } catch (error) {
    console.error("[Clean Link Copy] Error removing picker overlay:", error);
    pickerOverlay = null;
  }
}

/**
 * Highlight an element with a visual border
 */
function highlightElement(element) {
  // Remove previous highlight
  if (currentHighlightedElement && currentHighlightedElement !== element) {
    currentHighlightedElement.classList.remove("element-picker-highlight");
  }

  // Add highlight to new element
  if (element) {
    element.classList.add("element-picker-highlight");
    currentHighlightedElement = element;
  }
}

/**
 * Remove highlight from current element
 */
function removeHighlight() {
  if (currentHighlightedElement) {
    currentHighlightedElement.classList.remove("element-picker-highlight");
    currentHighlightedElement = null;
  }
}

/**
 * Start element picker mode
 */
function startElementPicker() {
  try {
    if (elementPickerActive) {
      return; // Already active
    }

    elementPickerActive = true;
    forcedType = null; // Reset to auto mode

    try {
      createPickerOverlay();
    } catch (error) {
      console.error(
        "[Clean Link Copy] Failed to create picker overlay:",
        error,
      );
      elementPickerActive = false;
      showToast("× Failed to start element picker");
      throw error;
    }

    // Change cursor to crosshair
    if (document.body) {
      document.body.style.cursor = "crosshair";
    }

    // Add mousemove listener for highlighting
    document.addEventListener("mousemove", handlePickerMouseMove, true);

    // Add click listener for selection
    document.addEventListener("click", handlePickerClick, true);

    // Add keydown listener for escape
    document.addEventListener("keydown", handlePickerKeydown, true);
  } catch (error) {
    console.error("[Clean Link Copy] Error starting element picker:", error);
    // Ensure cleanup on error
    elementPickerActive = false;
    throw error;
  }
}

/**
 * Update the type indicator in the picker overlay
 * @param {string|null} type - The detected type or null to hide
 */
function updateTypeIndicator(type) {
  const typeIndicator = document.getElementById("element-picker-type");
  if (typeIndicator) {
    if (type) {
      typeIndicator.textContent = type;
      typeIndicator.classList.add("visible");
    } else {
      typeIndicator.textContent = "";
      typeIndicator.classList.remove("visible");
    }
  }
}

/**
 * Handle mouse move during picker mode
 */
function handlePickerMouseMove(event) {
  if (!elementPickerActive) return;

  // Get the element under the cursor (excluding the overlay)
  const element = document.elementFromPoint(event.clientX, event.clientY);

  // Don't highlight the overlay itself or body/html
  if (
    element &&
    element !== pickerOverlay &&
    element.parentElement !== pickerOverlay &&
    element.tagName !== "HTML" &&
    element.tagName !== "BODY"
  ) {
    highlightElement(element);
    // Update type indicator with forced or detected type
    const elementType = forcedType || detectElementType(element);
    updateTypeIndicator(elementType);
  } else {
    removeHighlight();
    updateTypeIndicator(null);
  }
}

/**
 * Handle click during picker mode
 */
async function handlePickerClick(event) {
  if (!elementPickerActive) return;

  // Ignore clicks on the overlay toolbar (select, etc.)
  if (pickerOverlay && pickerOverlay.contains(event.target)) {
    return;
  }

  try {
    event.preventDefault();
    event.stopPropagation();

    // Store the selected element
    const element = document.elementFromPoint(event.clientX, event.clientY);

    // Don't select the overlay itself or body/html
    if (
      element &&
      element !== pickerOverlay &&
      element.parentElement !== pickerOverlay &&
      element.tagName !== "HTML" &&
      element.tagName !== "BODY"
    ) {
      selectedElement = element;
      console.log("[Clean Link Copy] Element selected:", element);

      // Use forced type or detect element type
      const elementType = forcedType || detectElementType(element);
      console.log(
        "[Clean Link Copy] Element type:",
        elementType,
        forcedType ? "(forced)" : "(auto)",
      );

      // Exit picker mode before handling copy
      stopElementPicker();

      // Handle the copy based on element type
      try {
        if (elementType === "table") {
          await handleTableCopy(element);
        } else if (elementType === "text") {
          await handleTextCopy(element);
        } else if (elementType === "svg") {
          await handleSvgCopy(element);
        } else if (elementType === "image" || elementType === "visual") {
          await handleImageCopy(element);
        }
      } catch (error) {
        console.error("[Clean Link Copy] Error handling element copy:", error);
        showToast("× Error copying element");
      }
    } else {
      // Exit picker mode without selection
      stopElementPicker();
    }
  } catch (error) {
    console.error("[Clean Link Copy] Error in picker click handler:", error);
    stopElementPicker();
    showToast("× Error in element picker");
  }
}

/**
 * Handle keydown during picker mode
 */
function handlePickerKeydown(event) {
  if (!elementPickerActive) return;

  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    stopElementPicker();
  }
}

/**
 * Stop element picker mode
 */
function stopElementPicker() {
  try {
    if (!elementPickerActive) return;

    elementPickerActive = false;

    // Restore cursor
    if (document.body) {
      document.body.style.cursor = "auto";
    }

    // Remove event listeners
    document.removeEventListener("mousemove", handlePickerMouseMove, true);
    document.removeEventListener("click", handlePickerClick, true);
    document.removeEventListener("keydown", handlePickerKeydown, true);

    // Remove highlight and overlay
    removeHighlight();
    removePickerOverlay();

    // If no element was selected (e.g., Escape was pressed), clear the selection
    if (!selectedElement) {
      console.log(
        "[Clean Link Copy] Element picker cancelled without selection",
      );
    }
  } catch (error) {
    console.error("[Clean Link Copy] Error stopping element picker:", error);
    // Ensure cleanup even on error
    elementPickerActive = false;
    if (document.body) {
      document.body.style.cursor = "auto";
    }
  }
}

/**
 * Get the currently selected element
 * @returns {Element|null} - The selected element or null if none selected
 */
function getSelectedElement() {
  return selectedElement;
}

/**
 * Clear the selected element
 */
function clearSelectedElement() {
  selectedElement = null;
}

/**
 * Handle table copy
 * @param {Element} element - The table element or element containing a table
 */
async function handleTableCopy(element) {
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
async function handlePageSelection() {
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
 * Handle full page screenshot - capture the entire visible viewport
 */
async function handleFullPageScreenshot() {
  try {
    console.log("[Clean Link Copy] Capturing full page screenshot");

    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const devicePixelRatio = window.devicePixelRatio || 1;

    const message = {
      action: "captureFullPage",
      devicePixelRatio: devicePixelRatio,
    };

    console.log(
      "[Clean Link Copy] Requesting full page screenshot, viewport:",
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
          console.error(
            "[Clean Link Copy] Background failed to capture page:",
            response?.error,
          );
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
              showToast("✓ Page screenshot copied");
            } else {
              showToast("× Failed to copy page screenshot");
            }
          })
          .catch((error) => {
            console.error(
              "[Clean Link Copy] Error processing captured page:",
              error,
            );
            showToast("× Failed to copy page screenshot");
          });
      } catch (error) {
        console.error(
          "[Clean Link Copy] Error in capture response handler:",
          error,
        );
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
 * @param {Element} element - The text element
 */
async function handleTextCopy(element) {
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
      console.error(
        "[Clean Link Copy] Error converting HTML to markdown:",
        error,
      );
      // Fallback to plain text if conversion fails
      markdown = element.innerText || element.textContent || "";
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
 * @param {HTMLVideoElement} videoElement - The video element to capture from
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
async function captureVideoFrame(videoElement) {
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
 * @param {HTMLCanvasElement} canvasElement - The canvas element to export
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
async function captureCanvasFrame(canvasElement) {
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
 * @param {Element} element - The SVG element or element containing SVG
 */
async function handleSvgCopy(element) {
  try {
    // Find the actual SVG element if the selected element contains an SVG
    const svgElement =
      element.tagName === "SVG" ? element : element.querySelector("svg");

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
 * @param {string} imageSrc - The image source URL
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
async function fetchAndCopyImage(imageSrc) {
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
 * @param {Element} element - The element to capture as image
 */
async function handleImageCopy(element) {
  try {
    // Route direct media elements first (before checking for nested elements)

    // Handle direct video elements - capture current frame
    if (element.tagName === "VIDEO") {
      console.log("[Clean Link Copy] Detected direct <video> element");
      await captureVideoFrame(element);
      return;
    }

    // Handle direct canvas elements - export to PNG
    if (element.tagName === "CANVAS") {
      console.log("[Clean Link Copy] Detected direct <canvas> element");
      await captureCanvasFrame(element);
      return;
    }

    // Handle direct image elements - try direct copy
    if (element.tagName === "IMG") {
      const imageSrc = element.src || element.getAttribute("src");
      if (imageSrc) {
        console.log(
          "[Clean Link Copy] Detected direct <img> element, attempting direct copy",
        );
        const success = await fetchAndCopyImage(imageSrc);
        if (success) {
          showToast("✓ Image copied");
          return;
        }
        console.log(
          "[Clean Link Copy] Direct image copy failed, falling back to screenshot",
        );
      }
    }

    // Check for nested media elements (containers with media inside)

    // Check if element contains a video element
    const videoElement = element.querySelector("video");
    if (videoElement) {
      console.log("[Clean Link Copy] Detected nested <video> element");
      await captureVideoFrame(videoElement);
      return;
    }

    // Check if element contains a canvas element
    const canvasElement = element.querySelector("canvas");
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
        console.log(
          "[Clean Link Copy] Detected nested <img> element, attempting direct copy",
        );
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
          console.error(
            "[Clean Link Copy] Background failed to capture image:",
            response?.error,
          );
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
            console.error(
              "[Clean Link Copy] Error processing captured image:",
              error,
            );
            showToast("× Failed to copy image");
          });
      } catch (error) {
        console.error(
          "[Clean Link Copy] Error in capture response handler:",
          error,
        );
        showToast("× Failed to capture image");
      }
    });
  } catch (error) {
    console.error("[Clean Link Copy] Error in handleImageCopy:", error);
    showToast("× Failed to capture image");
  }
}

/**
 * Check if an element has visual styling (gradients, shadows, transforms, etc.)
 * @param {Element} element - The element to check
 * @returns {boolean} - True if element has significant visual styling
 */
function hasVisualStyling(element) {
  if (!element) return false;

  const computedStyle = window.getComputedStyle(element);

  // Check for background images
  const backgroundImage = computedStyle.backgroundImage;
  if (backgroundImage && backgroundImage !== "none") {
    return true;
  }

  // Check for gradients in background
  if (
    backgroundImage &&
    (backgroundImage.includes("gradient") || backgroundImage.includes("url"))
  ) {
    return true;
  }

  // Check for box-shadow or text-shadow
  const boxShadow = computedStyle.boxShadow;
  const textShadow = computedStyle.textShadow;
  if (
    (boxShadow && boxShadow !== "none") ||
    (textShadow && textShadow !== "none")
  ) {
    return true;
  }

  // Check for transforms
  const transform = computedStyle.transform;
  if (transform && transform !== "none") {
    return true;
  }

  // Check for filters
  const filter = computedStyle.filter;
  if (filter && filter !== "none") {
    return true;
  }

  return false;
}

/**
 * Calculate the text-to-element ratio for an element
 * @param {Element} element - The element to analyze
 * @returns {number} - Ratio of text content to descendant elements (higher = more text-heavy)
 */
function calculateTextRatio(element) {
  if (!element) return 0;

  // Get total text content length (all text recursively, trimmed)
  const text = (element.innerText || element.textContent || "").trim();
  const totalCharacters = text.length;

  // Count all descendant elements (not just direct children)
  const descendantElementCount = element.querySelectorAll("*").length;

  // If no descendant elements, it's text-heavy if there's text
  if (descendantElementCount === 0) {
    return totalCharacters > 0 ? 100 : 0;
  }

  // Calculate ratio: text characters per descendant element
  // Higher ratio means more text relative to structure
  const ratio = totalCharacters / descendantElementCount;

  return ratio;
}

/**
 * Check if an element is text-heavy (high ratio of text to visual complexity)
 * @param {Element} element - The element to check
 * @returns {boolean} - True if element is text-heavy
 */
function isTextHeavy(element) {
  if (!element) return false;

  // Don't consider elements with visual styling as text-heavy
  if (hasVisualStyling(element)) {
    return false;
  }

  // Calculate text ratio
  const textRatio = calculateTextRatio(element);

  // Threshold: if ratio is >= 20 characters per child element, consider it text-heavy
  // This accounts for typical text content while filtering out structure-heavy elements
  const TEXT_RATIO_THRESHOLD = 20;

  return textRatio >= TEXT_RATIO_THRESHOLD;
}

/**
 * Detect the type of element for copying
 * @param {Element} element - The element to detect
 * @returns {string} - The element type: 'table', 'text', 'image', 'svg', or 'visual'
 */
function detectElementType(element) {
  if (!element) {
    return "text";
  }

  // Check if element is or contains a table
  if (element.tagName === "TABLE" || element.querySelector("table")) {
    return "table";
  }

  // Check if element is or contains images
  if (element.tagName === "IMG" || element.querySelector("img")) {
    return "image";
  }

  // Check if element is or contains video
  if (element.tagName === "VIDEO" || element.querySelector("video")) {
    return "visual";
  }

  // Check if element is or contains SVG (before canvas check)
  if (element.tagName === "SVG" || element.querySelector("svg")) {
    return "svg";
  }

  // Check if element is or contains canvas
  if (element.tagName === "CANVAS" || element.querySelector("canvas")) {
    return "visual";
  }

  // Check if element is text-heavy (high text-to-element ratio, minimal visual styling)
  if (isTextHeavy(element)) {
    return "text";
  }

  // Default to visual for other elements (complex/styled content)
  return "visual";
}

/**
 * Convert a table element to CSV format
 * @param {Element} tableElement - The table element to convert
 * @returns {string} - CSV formatted string
 */
function tableToCSV(tableElement) {
  try {
    // Find the actual table element if the selected element contains a table
    const table =
      tableElement.tagName === "TABLE"
        ? tableElement
        : tableElement.querySelector("table");

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
          colCount += parseInt(cell.getAttribute("colspan") || 1);
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

        const colspan = parseInt(cell.getAttribute("colspan") || 1);
        const rowspan = parseInt(cell.getAttribute("rowspan") || 1);
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
            if (
              escaped.includes(",") ||
              escaped.includes("\n") ||
              escaped.includes('"')
            ) {
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

// Log that the content script has loaded
// console.log('[Clean Link Copy] Content script loaded');

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.action === "copyCleanUrl") {
      handleCopyCleanUrl()
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error("[Clean Link Copy] Error in copyCleanUrl:", error);
          sendResponse({ success: false, error: error.message });
        });
    } else if (message.action === "copyMarkdownLink") {
      handleCopyMarkdownLink()
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error("[Clean Link Copy] Error in copyMarkdownLink:", error);
          sendResponse({ success: false, error: error.message });
        });
    } else if (message.action === "startElementPicker") {
      try {
        startElementPicker();
        sendResponse({ success: true });
      } catch (error) {
        console.error("[Clean Link Copy] Error in startElementPicker:", error);
        sendResponse({ success: false, error: error.message });
      }
    } else {
      console.warn("[Clean Link Copy] Unknown message action:", message.action);
      sendResponse({ success: false, error: "Unknown action" });
    }
  } catch (error) {
    console.error(
      "[Clean Link Copy] Unexpected error in message listener:",
      error,
    );
    sendResponse({ success: false, error: error.message });
  }
  return true; // Keep the message channel open for async response
});
