/**
 * Page Scraper
 * Extracts page content and converts to markdown using Turndown
 */

export interface ScrapedPage {
  url: string;
  title: string;
  content: string;
  excerpt: string;
  siteName: string;
  byline: string;
  characterCount: number;
}

/**
 * Extract metadata from the page
 */
function extractMetadata() {
  const siteName =
    document.querySelector('meta[property="og:site_name"]')?.getAttribute("content") ||
    document.querySelector('meta[name="application-name"]')?.getAttribute("content") ||
    window.location.hostname;

  const byline =
    document.querySelector('meta[name="author"]')?.getAttribute("content") ||
    document.querySelector('[rel="author"]')?.textContent ||
    "";

  const excerpt =
    document.querySelector('meta[name="description"]')?.getAttribute("content") ||
    document.querySelector('meta[property="og:description"]')?.getAttribute("content") ||
    "";

  return { siteName, byline, excerpt };
}

/**
 * Find the main content element on the page
 */
function findMainContent(): Element {
  // Try semantic elements first
  const main = document.querySelector("main");
  if (main) return main;

  const article = document.querySelector("article");
  if (article) return article;

  const roleMain = document.querySelector('[role="main"]');
  if (roleMain) return roleMain;

  // Try common content containers
  const content =
    document.querySelector("#content") ||
    document.querySelector(".content") ||
    document.querySelector("#main-content") ||
    document.querySelector(".main-content");
  if (content) return content;

  // Fall back to body
  return document.body;
}

// Selectors that are always safe to remove (page chrome, scripts, ads)
const CHROME_SELECTORS = [
  "script",
  "style",
  "noscript",
  "iframe",
  "nav",
  "footer",
  "header",
  "aside",
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  ".sidebar",
  ".nav",
  ".menu",
  ".advertisement",
  ".ad",
  ".ads",
  ".social-share",
  ".related-posts",
];

// Comment sections are only removed when they are NOT the bulk of the page.
// On discussion sites (e.g. lobste.rs, Hacker News mirrors, forums) the
// comment thread IS the main content and must be preserved.
const COMMENT_SELECTORS = [".comments", ".comment-section", "#comments"];

// Minimum fraction of text that must survive comment removal for it to apply
const COMMENT_REMOVAL_RETAIN_RATIO = 0.5;

// Thresholds for falling back to <body> when a main-content candidate is too sparse
const MIN_CANDIDATE_CHARS = 500;
const MIN_CANDIDATE_BODY_RATIO = 0.2;

/**
 * Get normalized text length of an element
 */
function getTextLength(element: Element): number {
  return (element.textContent || "").replace(/\s+/g, " ").trim().length;
}

/**
 * Clone element and remove non-content elements
 */
function cleanContent(element: Element): Element {
  const clone = element.cloneNode(true);
  if (!(clone instanceof Element)) throw new Error("Cloned content is not an element");

  CHROME_SELECTORS.forEach((selector) => {
    clone.querySelectorAll(selector).forEach((el) => el.remove());
  });

  // Only strip comment sections when most of the content remains afterwards.
  const withoutComments = clone.cloneNode(true);
  if (!(withoutComments instanceof Element)) throw new Error("Cloned content is not an element");
  COMMENT_SELECTORS.forEach((selector) => {
    withoutComments.querySelectorAll(selector).forEach((el) => el.remove());
  });

  const totalLength = getTextLength(clone);
  if (
    totalLength === 0 ||
    getTextLength(withoutComments) / totalLength >= COMMENT_REMOVAL_RETAIN_RATIO
  ) {
    return withoutComments;
  }

  return clone;
}

/**
 * Scrape the current page and convert to markdown
 */
export function scrapePage(): ScrapedPage {
  const metadata = extractMetadata();
  const mainContent = findMainContent();
  let cleanedContent = cleanContent(mainContent);

  // If the candidate yields too little text compared to the full page,
  // the heuristic picked the wrong container - fall back to <body>.
  if (mainContent !== document.body) {
    const cleanedBody = cleanContent(document.body);
    const candidateLength = getTextLength(cleanedContent);
    const bodyLength = getTextLength(cleanedBody);

    if (
      bodyLength > candidateLength &&
      (candidateLength < MIN_CANDIDATE_CHARS ||
        candidateLength < bodyLength * MIN_CANDIDATE_BODY_RATIO)
    ) {
      console.log("[Page Scraper] Main content candidate too sparse, falling back to body");
      cleanedContent = cleanedBody;
    }
  }

  // Convert to markdown using Turndown
  let markdown = "";
  try {
    const turndownService = new TurndownService();
    markdown = turndownService.turndown(cleanedContent.innerHTML);
  } catch (error) {
    console.error("[Page Scraper] Error converting to markdown:", error);
    // Fallback to plain text (innerText is unreliable on detached clones)
    markdown = cleanedContent.textContent || "";
  }

  // Clean up excessive whitespace
  const content = markdown.replace(/\n{3,}/g, "\n\n").trim();

  return {
    url: window.location.href,
    title: document.title,
    content,
    excerpt: metadata.excerpt || content.slice(0, 200),
    siteName: metadata.siteName,
    byline: metadata.byline,
    characterCount: content.length,
  };
}
