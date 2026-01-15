/**
 * Show toast notification in the clips viewer
 * @param message - The message to display
 */
export function showToast(message: string): void {
  try {
    // Remove any existing toast
    const existingToast = document.getElementById("clips-viewer-toast");
    if (existingToast) {
      existingToast.remove();
    }

    // Create toast element
    const toast = document.createElement("div");
    toast.id = "clips-viewer-toast";
    toast.className = "clips-viewer-toast";
    toast.textContent = message;

    // Add to page
    if (!document.body) {
      console.error("[Clips Viewer] Cannot show toast: document body not available");
      return;
    }

    document.body.appendChild(toast);

    // Trigger fade-in animation
    setTimeout(() => {
      try {
        toast.classList.add("show");
      } catch (error) {
        console.error("[Clips Viewer] Error adding show class to toast:", error);
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
        console.error("[Clips Viewer] Error removing toast:", error);
        // Force remove if error occurs
        if (toast.parentNode) {
          toast.remove();
        }
      }
    }, 2500);
  } catch (error) {
    console.error("[Clips Viewer] Error showing toast:", error);
    // Fallback: log to console if toast fails
    console.log("[Clips Viewer] Toast message:", message);
  }
}

