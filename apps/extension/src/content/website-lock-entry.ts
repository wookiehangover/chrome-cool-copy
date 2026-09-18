import { initializeWebsiteLock } from "./features/website-lock.js";

declare global {
  interface Window {
    coolCopyWebsiteLockStarted?: boolean;
  }
}

if (!window.coolCopyWebsiteLockStarted) {
  window.coolCopyWebsiteLockStarted = true;
  initializeWebsiteLock(window.location.hostname).catch((error) => {
    window.coolCopyWebsiteLockStarted = false;
    console.error("[Website Lock] Could not load website lock:", error);
  });
}
