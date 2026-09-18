import {
  activeDeadline,
  formatUnlockTime,
  getWebsiteHostname,
  getWebsiteLock,
  setWebsiteLock,
  websiteLockKey,
} from "../../services/website-locks.js";

function localDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return new Date(timestamp - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export async function initializeWebsiteLockForm(): Promise<void> {
  const form = document.querySelector<HTMLFormElement>("#websiteLockForm");
  const input = document.querySelector<HTMLInputElement>("#websiteUnlockAt");
  const buttons = document.querySelectorAll<HTMLButtonElement>("#websiteLockForm button");
  const site = document.querySelector<HTMLElement>("#websiteLockHost");
  const status = document.querySelector<HTMLElement>("#websiteLockStatus");
  if (!form || !input || buttons.length === 0 || !site || !status) return;

  let deadline: number | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let saving = false;
  let notice = "";

  function setButtonsDisabled(disabled: boolean): void {
    for (const button of buttons) button.disabled = disabled;
  }

  function render(): void {
    clearTimeout(timer);
    deadline = activeDeadline(deadline ?? undefined);
    form!.hidden = deadline !== null;
    status!.textContent = deadline
      ? `Locked until ${formatUnlockTime(deadline)}. It will unlock automatically.${notice}`
      : "Applies to every page on this site. Subdomains are separate.";
    if (deadline) timer = setTimeout(render, Math.min(deadline - Date.now(), 1000));
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const hostname = getWebsiteHostname(tab?.url ?? "");
    if (!hostname || tab?.id === undefined) {
      site.textContent = "Unavailable on this page";
      status.textContent = "Open a website to set a lock.";
      return;
    }
    const tabId = tab.id;
    site.textContent = hostname;
    deadline = await getWebsiteLock(hostname);
    input.value = localDateTime(Math.ceil((Date.now() + 60 * 60_000) / 60_000) * 60_000);
    input.min = localDateTime(Math.ceil((Date.now() + 1) / 60_000) * 60_000);
    setButtonsDisabled(false);
    render();

    const onStorageChanged = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string,
    ): void => {
      const key = websiteLockKey(hostname);
      if (area === "local" && Object.hasOwn(changes, key)) {
        deadline = activeDeadline(changes[key].newValue);
        render();
      }
    };
    chrome.storage.onChanged.addListener(onStorageChanged);
    window.addEventListener(
      "pagehide",
      () => {
        clearTimeout(timer);
        chrome.storage.onChanged.removeListener(onStorageChanged);
      },
      { once: true },
    );

    const lockWebsite = async (unlockAt: number): Promise<void> => {
      if (saving) return;
      if (!activeDeadline(unlockAt)) {
        status.textContent = "Choose a date and time in the future.";
        input.focus();
        return;
      }
      saving = true;
      setButtonsDisabled(true);
      try {
        const currentTab = await chrome.tabs.get(tabId);
        if (getWebsiteHostname(currentTab.url ?? "") !== hostname) {
          throw new Error("The website changed. Reopen the popup to lock the current website.");
        }
        try {
          await chrome.scripting.executeScript({ target: { tabId }, files: ["website-lock.js"] });
        } catch {
          throw new Error("This page does not allow website locks. Try a regular website page.");
        }
        await setWebsiteLock(hostname, unlockAt);
        deadline = unlockAt;
        render();

        const tabs = await chrome.tabs.query({});
        const results = await Promise.allSettled(
          tabs
            .filter(
              (other) =>
                other.id !== undefined &&
                other.id !== tabId &&
                getWebsiteHostname(other.url ?? "") === hostname,
            )
            .map((other) =>
              chrome.scripting.executeScript({
                target: { tabId: other.id! },
                files: ["website-lock.js"],
              }),
            ),
        );
        if (results.some((result) => result.status === "rejected")) {
          notice = " Reload other open tabs if they do not show the lock.";
          render();
        }
      } catch (error) {
        status.textContent =
          error instanceof Error ? error.message : "Could not save the lock. Try again.";
      } finally {
        saving = false;
        setButtonsDisabled(false);
      }
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void lockWebsite(new Date(input.value).getTime());
    });
    for (const button of buttons) {
      const minutes = Number(button.getAttribute("data-lock-minutes"));
      if (minutes === 30 || minutes === 60) {
        button.addEventListener("click", () => {
          void lockWebsite(Date.now() + minutes * 60_000);
        });
      }
    }
  } catch {
    status.textContent = "Could not load website locks. Reopen the popup to try again.";
  }
}
