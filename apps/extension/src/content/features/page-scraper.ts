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
function extractMetadata(): { siteName: string; byline: string; excerpt: string } {
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

/**
 * Clone element and remove non-content elements
 */
function cleanContent(element: Element): Element {
  const clone = element.cloneNode(true) as Element;

  // Remove non-content elements
  const selectorsToRemove = [
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
    ".comments",
    ".comment-section",
    ".social-share",
    ".related-posts",
  ];

  selectorsToRemove.forEach((selector) => {
    clone.querySelectorAll(selector).forEach((el) => el.remove());
  });

  return clone;
}

/**
 * Scrape the current page and convert to markdown
 */
export function scrapePage(): ScrapedPage {
  const metadata = extractMetadata();
  const mainContent = findMainContent();
  const cleanedContent = cleanContent(mainContent);

  // Convert to markdown using Turndown
  let markdown = "";
  try {
    const turndownService = new TurndownService();
    markdown = turndownService.turndown(cleanedContent.innerHTML);
  } catch (error) {
    console.error("[Page Scraper] Error converting to markdown:", error);
    // Fallback to plain text
    markdown = (cleanedContent as HTMLElement).innerText || cleanedContent.textContent || "";
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

