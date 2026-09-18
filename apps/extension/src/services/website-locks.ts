export function getWebsiteHostname(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.hostname : null;
  } catch {
    return null;
  }
}

export function websiteLockKey(hostname: string): string {
  return `website-lock:${hostname}`;
}

export function activeDeadline(
  value: chrome.storage.StorageChange["newValue"],
  now = Date.now(),
): number | null {
  if (!Number.isFinite(value)) return null;
  const deadline = Number(value);
  return deadline > now && deadline <= 8.64e15 ? deadline : null;
}

export async function getWebsiteLock(hostname: string): Promise<number | null> {
  const key = websiteLockKey(hostname);
  const stored = await chrome.storage.local.get(key);
  return activeDeadline(stored[key]);
}

export async function setWebsiteLock(hostname: string, unlockAt: number): Promise<void> {
  if (!activeDeadline(unlockAt)) {
    throw new Error("Choose a date and time in the future.");
  }
  if (await getWebsiteLock(hostname)) {
    throw new Error("This website is already locked until its scheduled time.");
  }
  await chrome.storage.local.set({ [websiteLockKey(hostname)]: unlockAt });
}

export function formatUnlockTime(unlockAt: number): string {
  return new Date(unlockAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
