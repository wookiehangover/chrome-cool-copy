/**
 * Element Picker Module
 * Handles element selection UI and interaction for copying elements
 */

import { detectElementType } from "../type-detection.js";
import { showToast } from "../toast.js";
import {
  handleTableCopy,
  handleTextCopy,
  handleSvgCopy,
  handleImageCopy,
  handleFullPageScreenshot,
} from "../copy-handlers.js";
import { captureElementClip } from "./element-clipper.js";

/**
 * Element Picker State
 */
let elementPickerActive: boolean = false;
let currentHighlightedElement: Element | null = null;
let pickerOverlay: HTMLElement | null = null;
let selectedElement: Element | null = null;
let forcedType: string | null = null; // null = auto, or 'table', 'text', 'image', 'visual'
let pickerMode: "copy" | "clip" = "copy"; // "copy" for copy-element, "clip" for clip-element

/**
 * Cleanup handlers for navigation/unload while picker is active
 */
function handlePickerPageHide(): void {
  if (elementPickerActive) {
    stopElementPicker();
  }
}

function handlePickerVisibilityChange(): void {
  if (document.hidden && elementPickerActive) {
    stopElementPicker();
  }
}

/**
 * Set the forced type for element picking
 * @param type - The type to force, or null for auto
 */
export function setForcedType(type: string | null): void {
  forcedType = type;
}

/**
 * Create and show the picker overlay
 */
export function createPickerOverlay(): HTMLElement {
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
    const toolbar = overlay.querySelector(".element-picker-toolbar") as HTMLElement;
    toolbar.addEventListener("click", (e: Event) => e.stopPropagation());
    toolbar.addEventListener("mousedown", (e: Event) => e.stopPropagation());

    // Add click handler for Page button
    const pageButton = overlay.querySelector(".element-picker-page-button") as HTMLElement;
    pageButton.addEventListener("click", async (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
      await handlePageSelection();
    });
    pageButton.addEventListener("mousedown", (e: Event) => e.stopPropagation());

    // Add change handler for type select
    const typeSelect = overlay.querySelector(".element-picker-type-select") as HTMLSelectElement;
    typeSelect.addEventListener("change", (e: Event) => {
      e.stopPropagation();
      const type = (e.target as HTMLSelectElement).value;
      setForcedType(type === "auto" ? null : type);
      // Update the type indicator if there's a highlighted element
      if (currentHighlightedElement) {
        const displayType = forcedType || detectElementType(currentHighlightedElement);
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
export function removePickerOverlay(): void {
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
export function highlightElement(element: Element): void {
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
export function removeHighlight(): void {
  if (currentHighlightedElement) {
    currentHighlightedElement.classList.remove("element-picker-highlight");
    currentHighlightedElement = null;
  }
}

/**
 * Update the type indicator in the picker overlay
 * @param type - The detected type or null to hide
 */
export function updateTypeIndicator(type: string | null): void {
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
 * Start element picker mode
 * @param mode - "copy" for copy-element command, "clip" for clip-element command
 */
export function startElementPicker(mode: "copy" | "clip" = "copy"): void {
  try {
    if (elementPickerActive) {
      return; // Already active
    }

    elementPickerActive = true;
    pickerMode = mode;
    forcedType = null; // Reset to auto mode

    try {
      createPickerOverlay();
    } catch (error) {
      console.error("[Clean Link Copy] Failed to create picker overlay:", error);
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

    // Add lifecycle listeners to ensure cleanup on navigation/tab switch
    window.addEventListener("pagehide", handlePickerPageHide, true);
    document.addEventListener("visibilitychange", handlePickerVisibilityChange, true);
  } catch (error) {
    console.error("[Clean Link Copy] Error starting element picker:", error);
    // Ensure cleanup on error
    stopElementPicker();
    throw error;
  }
}

/**
 * Handle mouse move during picker mode
 */
function handlePickerMouseMove(event: MouseEvent): void {
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
async function handlePickerClick(event: MouseEvent): Promise<void> {
  if (!elementPickerActive) return;

  // Ignore clicks on the overlay toolbar (select, etc.)
  if (pickerOverlay && pickerOverlay.contains(event.target as Node)) {
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

      // Exit picker mode before handling copy/clip
      stopElementPicker();

      // Handle based on picker mode
      try {
        if (pickerMode === "clip") {
          // Clip mode: capture element clip and screenshot, then send to background
          showToast("Clipping element...");
          const clipData = await captureElementClip(element);

          // Capture screenshot of the element
          const rect = element.getBoundingClientRect();
          const devicePixelRatio = window.devicePixelRatio || 1;
          const screenshotDataUrl = await new Promise<string>((resolve, reject) => {
            chrome.runtime.sendMessage(
              {
                action: "captureElement",
                bounds: {
                  top: Math.round(rect.top),
                  left: Math.round(rect.left),
                  width: Math.round(rect.width),
                  height: Math.round(rect.height),
                },
                devicePixelRatio: devicePixelRatio,
              },
              (response) => {
                if (chrome.runtime.lastError) {
                  console.warn("[Element Picker] Failed to capture screenshot:", chrome.runtime.lastError);
                  resolve(""); // Continue without screenshot
                } else if (response && response.success && response.imageData) {
                  resolve(response.imageData);
                } else {
                  console.warn("[Element Picker] No screenshot data received");
                  resolve(""); // Continue without screenshot
                }
              },
            );
          });

          // Send to background script for storage
          chrome.runtime.sendMessage(
            {
              action: "clipElement",
              data: clipData,
              screenshotDataUrl: screenshotDataUrl,
            },
            (response) => {
              if (chrome.runtime.lastError) {
                console.error("[Element Picker] Error clipping element:", chrome.runtime.lastError);
                showToast("× Error clipping element");
              } else if (response && response.success) {
                showToast("✓ Element clipped!");
              } else {
                showToast("× Failed to clip element");
              }
            },
          );
        } else {
          // Copy mode: handle the copy based on element type
          if (elementType === "table") {
            await handleTableCopy(element);
          } else if (elementType === "text") {
            await handleTextCopy(element);
          } else if (elementType === "svg") {
            await handleSvgCopy(element);
          } else if (elementType === "image" || elementType === "visual") {
            await handleImageCopy(element);
          }
        }
      } catch (error) {
        console.error("[Clean Link Copy] Error handling element operation:", error);
        showToast("× Error with element operation");
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
function handlePickerKeydown(event: KeyboardEvent): void {
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
export function stopElementPicker(): void {
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
    window.removeEventListener("pagehide", handlePickerPageHide, true);
    document.removeEventListener("visibilitychange", handlePickerVisibilityChange, true);

    // Remove highlight and overlay
    removeHighlight();
    removePickerOverlay();

    // If no element was selected (e.g., Escape was pressed), clear the selection
    if (!selectedElement) {
      console.log("[Clean Link Copy] Element picker cancelled without selection");
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
 * @returns The selected element or null if none selected
 */
export function getSelectedElement(): Element | null {
  return selectedElement;
}

/**
 * Clear the selected element
 */
export function clearSelectedElement(): void {
  selectedElement = null;
}

/**
 * Handle page selection - copy entire page content
 */
export async function handlePageSelection(): Promise<void> {
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

    let contentElement: Element | null = null;
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
