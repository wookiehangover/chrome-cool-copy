/**
 * Wikipedia Detection and URL Parsing Module
 * Detects Wikipedia pages and extracts article titles from URLs
 */

/**
 * Check if the current page is on Wikipedia
 * Supports all language subdomains (en.wikipedia.org, fr.wikipedia.org, etc.)
 * @returns true if on a Wikipedia page, false otherwise
 */
export function isWikipediaPage(): boolean {
  try {
    const hostname = window.location.hostname;
    // Match any subdomain followed by .wikipedia.org
    return /^[a-z]{2,}\.wikipedia\.org$/.test(hostname);
  } catch {
    return false;
  }
}

/**
 * Extract article title from Wikipedia URL
 * Handles URL encoding and special page detection
 * @param url - The URL to parse (defaults to current location)
 * @returns The article title, or null if not a valid article page
 */
export function getWikipediaArticleTitle(url: string = window.location.href): string | null {
  try {
    const urlObj = new URL(url);
    
    // Only process Wikipedia URLs
    if (!/^[a-z]{2,}\.wikipedia\.org$/.test(urlObj.hostname)) {
      return null;
    }

    // Extract the pathname and remove leading slash
    const pathname = urlObj.pathname;
    
    // Wikipedia article URLs follow the pattern: /wiki/Article_Title
    // or /w/index.php?title=Article_Title for old-style URLs
    
    // Handle standard wiki URLs: /wiki/Article_Title
    const wikiMatch = pathname.match(/^\/wiki\/(.+)$/);
    if (wikiMatch) {
      const encodedTitle = wikiMatch[1];
      return decodeURIComponent(encodedTitle);
    }

    // Handle old-style URLs: /w/index.php?title=Article_Title
    const titleParam = urlObj.searchParams.get("title");
    if (titleParam) {
      return decodeURIComponent(titleParam);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Check if a Wikipedia article title is a special page
 * Special pages include Main_Page, Special:*, etc.
 * @param title - The article title to check
 * @returns true if it's a special page, false otherwise
 */
export function isWikipediaSpecialPage(title: string | null): boolean {
  if (!title) {
    return true;
  }

  // Check for Main_Page
  if (title === "Main_Page") {
    return true;
  }

  // Check for Special: namespace pages
  if (title.startsWith("Special:")) {
    return true;
  }

  // Check for other non-article namespaces
  const nonArticleNamespaces = [
    "Wikipedia:",
    "Template:",
    "Help:",
    "Category:",
    "File:",
    "MediaWiki:",
    "User:",
    "User_talk:",
    "Wikipedia_talk:",
    "Template_talk:",
    "Help_talk:",
    "Category_talk:",
    "File_talk:",
    "MediaWiki_talk:",
  ];

  for (const namespace of nonArticleNamespaces) {
    if (title.startsWith(namespace)) {
      return true;
    }
  }

  return false;
}

/**
 * Get the Wikipedia article title if on a valid article page
 * Returns null for special pages, non-Wikipedia pages, or invalid URLs
 * @param url - The URL to parse (defaults to current location)
 * @returns The article title, or null if not a valid article page
 */
export function getWikipediaArticle(url: string = window.location.href): string | null {
  const title = getWikipediaArticleTitle(url);
  
  if (isWikipediaSpecialPage(title)) {
    return null;
  }

  return title;
}

