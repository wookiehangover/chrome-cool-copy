/**
 * X.com Tweet Renderer
 * Converts extracted tweet data into clean, readable HTML for reader mode.
 */

import type {
  Tweet,
  QuoteTweet,
  TweetMedia,
  XContentResult,
} from "./x-extractor.js";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format ISO timestamp to human-readable string
 */
function formatTime(isoString: string | null): string {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

/**
 * Build tweet URL from author handle and tweet ID
 */
function buildTweetUrl(handle: string, id: string | null): string | null {
  if (!id || !handle) return null;
  const cleanHandle = handle.replace(/^@/, "");
  return `https://x.com/${cleanHandle}/status/${id}`;
}

// =============================================================================
// Rendering Functions
// =============================================================================

/**
 * Render media gallery
 */
function renderMediaGallery(media: TweetMedia[]): HTMLElement {
  const gallery = document.createElement("div");
  gallery.className = `x-tweet-media x-tweet-media-${Math.min(media.length, 4)}`;

  for (const item of media) {
    if (item.type === "image") {
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = item.alt || "Tweet image";
      img.loading = "lazy";
      gallery.appendChild(img);
    } else if (item.type === "video" || item.type === "gif") {
      const thumb = document.createElement("div");
      thumb.className = "x-tweet-video-thumb";
      const img = document.createElement("img");
      img.src = item.thumbnailUrl || item.url;
      img.alt = item.alt || (item.type === "gif" ? "GIF" : "Video thumbnail");
      img.loading = "lazy";
      thumb.appendChild(img);
      // Play icon overlay
      const playIcon = document.createElement("span");
      playIcon.className = "x-tweet-play-icon";
      playIcon.textContent = item.type === "gif" ? "GIF" : "▶";
      thumb.appendChild(playIcon);
      gallery.appendChild(thumb);
    }
  }

  return gallery;
}

/**
 * Render a quote tweet as a blockquote element
 */
function renderQuoteTweet(quote: QuoteTweet): HTMLElement {
  const blockquote = document.createElement("blockquote");
  blockquote.className = "x-tweet-quote";

  // Author section (flat layout for quote tweets)
  const authorSection = document.createElement("div");
  authorSection.className = "x-tweet-author";

  if (quote.author.avatarUrl) {
    const avatar = document.createElement("img");
    avatar.className = "x-tweet-avatar";
    avatar.src = quote.author.avatarUrl;
    avatar.alt = `${quote.author.name} avatar`;
    avatar.loading = "lazy";
    authorSection.appendChild(avatar);
  }

  const authorInfo = document.createElement("div");
  authorInfo.className = "x-tweet-author-info";

  const authorName = document.createElement("span");
  authorName.className = "x-tweet-name";
  authorName.textContent = quote.author.name;
  if (quote.author.verified) {
    const badge = document.createElement("span");
    badge.className = "x-verified-badge";
    badge.textContent = "✓";
    badge.title = "Verified";
    authorName.appendChild(badge);
  }
  authorInfo.appendChild(authorName);

  const authorHandle = document.createElement("span");
  authorHandle.className = "x-tweet-handle";
  authorHandle.textContent = quote.author.handle;
  authorInfo.appendChild(authorHandle);

  authorSection.appendChild(authorInfo);
  blockquote.appendChild(authorSection);

  // Text content
  const content = document.createElement("div");
  content.className = "x-tweet-content";
  content.textContent = quote.text;
  blockquote.appendChild(content);

  // Media
  if (quote.media.length > 0) {
    blockquote.appendChild(renderMediaGallery(quote.media));
  }

  return blockquote;
}

/**
 * Render a single tweet as an article element
 */
function renderTweetCard(tweet: Tweet): HTMLElement {
  const article = document.createElement("article");
  article.className = "x-tweet";

  // Reply context
  if (tweet.replyContext) {
    const replyContext = document.createElement("div");
    replyContext.className = "x-tweet-reply-context";
    replyContext.textContent = `Replying to ${tweet.replyContext.replyingTo.join(", ")}`;
    article.appendChild(replyContext);
  }

  // Author section
  const authorSection = document.createElement("div");
  authorSection.className = "x-tweet-author";

  // if (tweet.author.avatarUrl) {
  //   const avatar = document.createElement("img");
  //   avatar.className = "x-tweet-avatar";
  //   avatar.src = tweet.author.avatarUrl;
  //   avatar.alt = `${tweet.author.name} avatar`;
  //   avatar.loading = "lazy";
  //   authorSection.appendChild(avatar);
  // }

  const authorInfo = document.createElement("div");
  authorInfo.className = "x-tweet-author-info";

  const authorName = document.createElement("span");
  authorName.className = "x-tweet-name";
  authorName.textContent = tweet.author.name;
  // if (tweet.author.verified) {
  //   const badge = document.createElement("span");
  //   badge.className = "x-verified-badge";
  //   badge.textContent = "✓";
  //   badge.title = "Verified";
  //   authorName.appendChild(badge);
  // }
  authorInfo.appendChild(authorName);

  const authorHandle = document.createElement("span");
  authorHandle.className = "x-tweet-handle";
  authorHandle.textContent = tweet.author.handle;
  authorInfo.appendChild(authorHandle);

  authorSection.appendChild(authorInfo);
  article.appendChild(authorSection);

  // Tweet text content
  const content = document.createElement("div");
  content.className = "x-tweet-content";
  content.textContent = tweet.text;
  article.appendChild(content);

  // Media gallery
  if (tweet.media.length > 0) {
    article.appendChild(renderMediaGallery(tweet.media));
  }

  // Quote tweet (nested)
  if (tweet.quoteTweet) {
    article.appendChild(renderQuoteTweet(tweet.quoteTweet));
  }

  // Timestamp
  const timestamp = document.createElement("div");
  timestamp.className = "x-tweet-timestamp";

  const time = document.createElement("time");
  if (tweet.isoTimestamp) {
    time.dateTime = tweet.isoTimestamp;
  }
  time.textContent = tweet.timestamp || formatTime(tweet.isoTimestamp);

  const tweetUrl = buildTweetUrl(tweet.author.handle, tweet.id);
  if (tweetUrl) {
    const link = document.createElement("a");
    link.href = tweetUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.appendChild(time);
    timestamp.appendChild(link);
  } else {
    timestamp.appendChild(time);
  }

  article.appendChild(timestamp);

  return article;
}

// =============================================================================
// Main Export
// =============================================================================

/**
 * Render extracted X.com content (single tweet or thread) as HTML
 * @param result - XContentResult from extractXContent()
 * @returns Container element with rendered tweets
 */
export function renderXContent(result: XContentResult): Element {
  const container = document.createElement("div");
  container.className = "x-thread";

  result.tweets.forEach((tweet, index) => {
    const card = renderTweetCard(tweet);

    // Add thread line styling for thread replies
    if (tweet.isThread && index > 0) {
      card.classList.add("x-thread-item");
    }

    container.appendChild(card);
  });

  return container;
}
