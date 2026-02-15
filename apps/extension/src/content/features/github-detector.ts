/**
 * GitHub Detection and URL Parsing Module
 * Detects GitHub repository pages and extracts owner/repo from URLs
 */

/**
 * Non-repo GitHub paths that should not trigger the banner.
 * These are top-level paths that are not user/org pages.
 */
const NON_REPO_PATHS = new Set([
  "settings",
  "marketplace",
  "explore",
  "notifications",
  "new",
  "login",
  "signup",
  "join",
  "organizations",
  "sponsors",
  "topics",
  "trending",
  "collections",
  "events",
  "features",
  "security",
  "pricing",
  "enterprise",
  "team",
  "customer-stories",
  "readme",
  "about",
  "codespaces",
  "issues",
  "pulls",
  "discussions",
  "search",
  "stars",
  "404",
  "500",
]);

/**
 * Check if the current page is on GitHub
 * @returns true if on github.com
 */
export function isGitHubPage(): boolean {
  try {
    return window.location.hostname === "github.com";
  } catch {
    return false;
  }
}

/**
 * Extract owner and repo from a GitHub URL.
 * Returns null for non-repo pages (homepage, settings, marketplace, etc.)
 * @param url - The URL to parse (defaults to current location)
 * @returns Object with owner and repo, or null if not a repo page
 */
export function getGitHubRepo(
  url: string = window.location.href,
): { owner: string; repo: string } | null {
  try {
    const urlObj = new URL(url);

    if (urlObj.hostname !== "github.com") {
      return null;
    }

    // Split pathname into segments: ["", "owner", "repo", ...]
    const segments = urlObj.pathname.split("/").filter(Boolean);

    // Need at least owner and repo
    if (segments.length < 2) {
      return null;
    }

    const [owner, repo] = segments;

    // Exclude known non-repo top-level paths
    if (NON_REPO_PATHS.has(owner.toLowerCase())) {
      return null;
    }

    // Exclude paths that start with a dot (e.g., .github)
    if (owner.startsWith(".") || repo.startsWith(".")) {
      return null;
    }

    return { owner, repo };
  } catch {
    return null;
  }
}

/**
 * Check if the current repository is public.
 * Uses GitHub's meta tag that indicates repository visibility.
 * @returns true if the repo is public, false if private or unknown
 */
export function isPublicRepo(): boolean {
  try {
    const meta = document.querySelector('meta[name="octolytics-dimension-repository_public"]');
    return meta?.getAttribute("content") === "true";
  } catch {
    return false;
  }
}

