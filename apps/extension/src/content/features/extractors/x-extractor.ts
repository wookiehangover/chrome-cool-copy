/**
 * X.com (Twitter) Content Extractor
 * Parses tweets from x.com pages into structured data
 */

// =============================================================================
// Types
// =============================================================================

export interface TweetAuthor {
  name: string;
  handle: string;
  avatarUrl: string | null;
  verified: boolean;
}

export interface TweetMedia {
  type: "image" | "video" | "gif";
  url: string;
  thumbnailUrl?: string;
  alt?: string;
}

export interface QuoteTweet {
  author: TweetAuthor;
  text: string;
  timestamp: string | null;
  media: TweetMedia[];
}

export interface ReplyContext {
  replyingTo: string[]; // Array of handles being replied to
}

export interface Tweet {
  id: string | null;
  author: TweetAuthor;
  text: string;
  timestamp: string | null;
  isoTimestamp: string | null;
  media: TweetMedia[];
  quoteTweet: QuoteTweet | null;
  replyContext: ReplyContext | null;
  metrics: {
    replies: string | null;
    reposts: string | null;
    likes: string | null;
    views: string | null;
    bookmarks: string | null;
  };
  isThread: boolean;
  threadPosition: number | null;
}

export interface XContentResult {
  tweets: Tweet[];
  pageType: "single" | "thread" | "timeline";
  mainTweetId: string | null;
}

// =============================================================================
// Selectors (based on x.com DOM structure)
// =============================================================================

const SELECTORS = {
  tweet: '[data-testid="tweet"]',
  tweetText: '[data-testid="tweetText"]',
  userName: '[data-testid="User-Name"]',
  userAvatar: '[data-testid="Tweet-User-Avatar"] img',
  timestamp: 'time',
  media: '[data-testid="tweetPhoto"], [data-testid="videoPlayer"]',
  quoteTweet: '[data-testid="quoteTweet"]',
  replyingTo: '[data-testid="reply"]',
  verifiedBadge: '[data-testid="icon-verified"]',
  // Metrics
  replyCount: '[data-testid="reply"] span',
  retweetCount: '[data-testid="retweet"] span',
  likeCount: '[data-testid="like"] span',
  viewCount: '[data-testid="views"]',
  bookmarkCount: '[data-testid="bookmark"] span',
} as const;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract author information from a tweet element
 */
function extractAuthor(tweetElement: Element): TweetAuthor {
  const userNameContainer = tweetElement.querySelector(SELECTORS.userName);
  const avatar = tweetElement.querySelector(SELECTORS.userAvatar) as HTMLImageElement | null;
  
  let name = "";
  let handle = "";
  
  if (userNameContainer) {
    // Name is in the first text span, handle starts with @
    const spans = userNameContainer.querySelectorAll("span");
    for (const span of spans) {
      const text = span.textContent?.trim() || "";
      if (text.startsWith("@")) {
        handle = text;
      } else if (text && !text.startsWith("·") && !text.includes("·") && text !== "·") {
        // First meaningful text that isn't a separator
        if (!name && text.length > 0) {
          name = text;
        }
      }
    }
  }

  // Check for verified badge
  const verified = !!tweetElement.querySelector(SELECTORS.verifiedBadge);

  return {
    name,
    handle,
    avatarUrl: avatar?.src || null,
    verified,
  };
}

/**
 * Extract tweet text content
 */
function extractText(tweetElement: Element): string {
  const textElement = tweetElement.querySelector(SELECTORS.tweetText);
  if (!textElement) return "";
  
  // Get text content, preserving line breaks
  return textElement.textContent?.trim() || "";
}

/**
 * Extract timestamp information
 */
function extractTimestamp(tweetElement: Element): { display: string | null; iso: string | null } {
  const timeElement = tweetElement.querySelector(SELECTORS.timestamp);
  if (!timeElement) return { display: null, iso: null };

  return {
    display: timeElement.textContent?.trim() || null,
    iso: timeElement.getAttribute("datetime") || null,
  };
}

/**
 * Extract media (images and videos) from a tweet
 */
function extractMedia(tweetElement: Element): TweetMedia[] {
  const media: TweetMedia[] = [];

  // Extract images
  const photos = tweetElement.querySelectorAll('[data-testid="tweetPhoto"] img');
  for (const img of photos) {
    const imgElement = img as HTMLImageElement;
    media.push({
      type: "image",
      url: imgElement.src,
      alt: imgElement.alt || undefined,
    });
  }

  // Extract videos
  const videos = tweetElement.querySelectorAll('[data-testid="videoPlayer"] video');
  for (const video of videos) {
    const videoElement = video as HTMLVideoElement;
    media.push({
      type: "video",
      url: videoElement.src || "",
      thumbnailUrl: videoElement.poster || undefined,
    });
  }

  // Check for GIFs (often in video elements but marked differently)
  const gifs = tweetElement.querySelectorAll('[data-testid="videoPlayer"][aria-label*="GIF"]');
  for (const gif of gifs) {
    const videoEl = gif.querySelector("video") as HTMLVideoElement | null;
    if (videoEl && !media.some((m) => m.url === videoEl.src)) {
      media.push({
        type: "gif",
        url: videoEl.src || "",
        thumbnailUrl: videoEl.poster || undefined,
      });
    }
  }

  return media;
}

/**
 * Extract quote tweet if present
 */
function extractQuoteTweet(tweetElement: Element): QuoteTweet | null {
  const quoteEl = tweetElement.querySelector(SELECTORS.quoteTweet);
  if (!quoteEl) return null;

  const author = extractAuthor(quoteEl);
  const text = extractText(quoteEl);
  const { display: timestamp } = extractTimestamp(quoteEl);
  const media = extractMedia(quoteEl);

  return { author, text, timestamp, media };
}

/**
 * Extract reply context (who the tweet is replying to)
 */
function extractReplyContext(tweetElement: Element): ReplyContext | null {
  // Look for "Replying to @handle" text
  const replyingToElement = tweetElement.querySelector('[data-testid="socialContext"]');
  if (!replyingToElement) return null;

  const text = replyingToElement.textContent || "";
  if (!text.toLowerCase().includes("replying to")) return null;

  // Extract handles from links
  const handles: string[] = [];
  const links = replyingToElement.querySelectorAll("a");
  for (const link of links) {
    const href = link.getAttribute("href");
    if (href?.startsWith("/")) {
      handles.push(`@${href.slice(1)}`);
    }
  }

  return handles.length > 0 ? { replyingTo: handles } : null;
}

/**
 * Extract engagement metrics
 */
function extractMetrics(tweetElement: Element): Tweet["metrics"] {
  const getMetricValue = (selector: string): string | null => {
    const el = tweetElement.querySelector(selector);
    const text = el?.textContent?.trim();
    return text && text !== "0" ? text : null;
  };

  // Try alternative selectors for metrics (they change based on tweet context)
  const replyButton = tweetElement.querySelector('[data-testid="reply"]');
  const retweetButton = tweetElement.querySelector('[data-testid="retweet"]');
  const likeButton = tweetElement.querySelector('[data-testid="like"]');
  const bookmarkButton = tweetElement.querySelector('[data-testid="bookmark"]');

  return {
    replies: replyButton?.querySelector("span")?.textContent?.trim() || null,
    reposts: retweetButton?.querySelector("span")?.textContent?.trim() || null,
    likes: likeButton?.querySelector("span")?.textContent?.trim() || null,
    views: getMetricValue('[data-testid="app-text-transition-container"]'),
    bookmarks: bookmarkButton?.querySelector("span")?.textContent?.trim() || null,
  };
}

/**
 * Extract tweet ID from the tweet element or URL
 */
function extractTweetId(tweetElement: Element): string | null {
  // Try to find link to the tweet with status ID
  const timeLink = tweetElement.querySelector("time")?.closest("a");
  if (timeLink) {
    const href = timeLink.getAttribute("href");
    const match = href?.match(/\/status\/(\d+)/);
    if (match) return match[1];
  }

  // Fallback: check current URL if this is a single tweet page
  const urlMatch = window.location.pathname.match(/\/status\/(\d+)/);
  return urlMatch ? urlMatch[1] : null;
}

/**
 * Parse a single tweet element into structured data
 */
function parseTweet(tweetElement: Element, threadPosition: number | null = null): Tweet {
  const author = extractAuthor(tweetElement);
  const text = extractText(tweetElement);
  const { display: timestamp, iso: isoTimestamp } = extractTimestamp(tweetElement);
  const media = extractMedia(tweetElement);
  const quoteTweet = extractQuoteTweet(tweetElement);
  const replyContext = extractReplyContext(tweetElement);
  const metrics = extractMetrics(tweetElement);
  const id = extractTweetId(tweetElement);

  return {
    id,
    author,
    text,
    timestamp,
    isoTimestamp,
    media,
    quoteTweet,
    replyContext,
    metrics,
    isThread: threadPosition !== null,
    threadPosition,
  };
}

// =============================================================================
// Main Export
// =============================================================================

/**
 * Check if the current page is an x.com tweet page
 */
export function isXPage(): boolean {
  const hostname = window.location.hostname;
  return hostname === "x.com" || hostname === "twitter.com" || hostname.endsWith(".x.com");
}

/**
 * Determine the page type based on URL and content
 */
function getPageType(): XContentResult["pageType"] {
  const path = window.location.pathname;

  // Single tweet page: /username/status/id
  if (/^\/[^/]+\/status\/\d+/.test(path)) {
    return "single";
  }

  // Could be a timeline or other page
  return "timeline";
}

/**
 * Extract structured content from x.com pages
 * Main entry point for the extractor
 */
export function extractXContent(): XContentResult {
  const pageType = getPageType();
  const tweets: Tweet[] = [];
  let mainTweetId: string | null = null;

  // Find all tweet elements on the page
  const tweetElements = document.querySelectorAll(SELECTORS.tweet);

  if (pageType === "single") {
    // On a single tweet page, first tweet is the main one
    // Subsequent tweets with same author may be a thread
    let threadPosition = 0;
    let mainAuthor: string | null = null;

    for (const element of tweetElements) {
      const tweet = parseTweet(element, threadPosition);

      if (threadPosition === 0) {
        mainTweetId = tweet.id;
        mainAuthor = tweet.author.handle;
        tweet.isThread = false;
        tweet.threadPosition = null;
      } else if (tweet.author.handle === mainAuthor && !tweet.replyContext) {
        // Same author, no reply context = likely thread continuation
        tweet.isThread = true;
        tweet.threadPosition = threadPosition;
      }

      tweets.push(tweet);
      threadPosition++;
    }

    // Determine if this is actually a thread
    const threadTweets = tweets.filter((t) => t.isThread);
    const actualPageType: XContentResult["pageType"] =
      threadTweets.length > 0 ? "thread" : "single";

    return { tweets, pageType: actualPageType, mainTweetId };
  }

  // Timeline page: parse all visible tweets
  for (const element of tweetElements) {
    tweets.push(parseTweet(element));
  }

  return { tweets, pageType, mainTweetId };
}

