/**
 * Show toast notification
 * @param message - The message to display
 */
export function showToast(message: string): void {
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
      console.error("[Clean Link Copy] Cannot show toast: document body not available");
      return;
    }

    document.body.appendChild(toast);

    // Trigger fade-in animation
    setTimeout(() => {
      try {
        toast.classList.add("show");
      } catch (error) {
        console.error("[Clean Link Copy] Error adding show class to toast:", error);
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
