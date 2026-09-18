import { activeDeadline, formatUnlockTime, websiteLockKey } from "../../services/website-locks.js";
import styles from "./website-lock.css";

export async function initializeWebsiteLock(hostname: string): Promise<() => void> {
  const key = websiteLockKey(hostname);
  let deadline: number | null = null;
  let host: HTMLDivElement | null = null;
  let dialog: HTMLDialogElement | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let revision = 0;
  const blockedEvents = [
    "keydown",
    "keyup",
    "keypress",
    "click",
    "dblclick",
    "pointerdown",
    "pointerup",
    "mousedown",
    "mouseup",
    "touchstart",
    "touchmove",
    "wheel",
    "contextmenu",
    "beforeinput",
  ];

  function blockInteraction(event: Event): void {
    if (deadline && activeDeadline(deadline)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    } else {
      render();
    }
  }

  function removeOverlay(): void {
    dialog?.close();
    host?.remove();
    host = null;
    dialog = null;
    for (const event of blockedEvents) {
      window.removeEventListener(event, blockInteraction, true);
    }
  }

  function render(): void {
    clearTimeout(timer);
    deadline = activeDeadline(deadline ?? undefined);
    if (!deadline) {
      removeOverlay();
      return;
    }

    if (!host) {
      host = document.createElement("div");
      host.id = "cool-copy-website-lock";
      host.style.setProperty("all", "initial", "important");
      host.style.setProperty("position", "fixed", "important");
      const shadow = host.attachShadow({ mode: "closed" });
      const style = document.createElement("style");
      style.textContent = styles;
      dialog = document.createElement("dialog");
      dialog.setAttribute("aria-labelledby", "lock-title");
      dialog.setAttribute("aria-describedby", "lock-description");
      dialog.innerHTML =
        '<section><p class="hostname"></p><h1 id="lock-title">This website is locked.</h1><p class="unlock-time" id="lock-description">It will unlock automatically on<time></time></p></section>';
      const hostnameLabel = dialog.querySelector(".hostname");
      if (hostnameLabel) hostnameLabel.textContent = hostname;
      dialog.addEventListener("cancel", (event) => event.preventDefault());
      shadow.append(style, dialog);
      for (const event of blockedEvents) {
        window.addEventListener(event, blockInteraction, { capture: true, passive: false });
      }
    }

    if (document.documentElement && !host.isConnected) {
      dialog?.close();
      document.documentElement.append(host);
    }
    const time = dialog?.querySelector("time");
    if (time) {
      time.dateTime = new Date(deadline).toISOString();
      time.textContent = formatUnlockTime(deadline);
    }
    if (host.isConnected && dialog && !dialog.open) dialog.showModal();
    timer = setTimeout(render, Math.min(deadline - Date.now(), 1000));
  }

  function onStorageChanged(
    changes: { [key: string]: chrome.storage.StorageChange },
    area: string,
  ): void {
    if (area !== "local" || !Object.hasOwn(changes, key)) return;
    revision += 1;
    deadline = activeDeadline(changes[key].newValue);
    render();
  }

  chrome.storage.onChanged.addListener(onStorageChanged);
  window.addEventListener("pageshow", render);
  window.addEventListener("focus", render);
  document.addEventListener("visibilitychange", render);

  function dispose(): void {
    clearTimeout(timer);
    chrome.storage.onChanged.removeListener(onStorageChanged);
    window.removeEventListener("pageshow", render);
    window.removeEventListener("focus", render);
    document.removeEventListener("visibilitychange", render);
    removeOverlay();
  }

  try {
    const stored = await chrome.storage.local.get(key);
    if (revision === 0) {
      deadline = activeDeadline(stored[key]);
      render();
    }
  } catch (error) {
    dispose();
    throw error;
  }
  return dispose;
}
