/**
 * X.com Content Extractor Tests
 * Tests tweet extraction from x.com DOM structures
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { isXPage, extractXContent } from "./x-extractor.js";
import { renderXContent } from "./x-renderer.js";

/**
 * Build a minimal tweet DOM structure matching X.com's real HTML.
 * This mirrors the data-testid attributes and nesting the extractor relies on.
 */
function buildTweetHTML(opts: {
  name?: string;
  handle?: string;
  text?: string;
  timestamp?: string;
  isoTimestamp?: string;
  tweetId?: string;
  handleHref?: string;
}): string {
  const {
    name = "Test User",
    handle = "@testuser",
    text = "Hello world",
    timestamp = "Jun 3",
    isoTimestamp = "2025-06-03T12:00:00.000Z",
    tweetId = "1234567890",
    handleHref = "/testuser",
  } = opts;

  return `
    <article role="article" data-testid="tweet" tabindex="0">
      <div data-testid="User-Name">
        <div>
          <div>
            <a role="link" href="${handleHref}">
              <div><span>${name}</span></div>
            </a>
          </div>
        </div>
        <div>
          <div>
            <a role="link" href="${handleHref}" tabindex="-1">
              <div><span>${handle}</span></div>
            </a>
          </div>
          <div><span>·</span></div>
          <div>
            <a href="${handleHref}/status/${tweetId}" role="link">
              <time datetime="${isoTimestamp}">${timestamp}</time>
            </a>
          </div>
        </div>
      </div>
      <div data-testid="tweetText">
        <span>${text}</span>
      </div>
      <div role="group">
        <button data-testid="reply"><span>5</span></button>
        <button data-testid="retweet"><span>10</span></button>
        <button data-testid="like"><span>42</span></button>
        <button data-testid="bookmark"><span></span></button>
      </div>
    </article>
  `;
}

/**
 * Wrap tweet HTML in X.com's timeline container with virtual scrolling cells.
 */
function buildTimelineHTML(tweetsHTML: string): string {
  return `
    <div aria-label="Timeline: Conversation">
      <div style="position: relative; min-height: 1024px;">
        <div data-testid="cellInnerDiv" style="transform: translateY(73px); position: absolute; width: 100%;">
          ${tweetsHTML}
        </div>
      </div>
    </div>
  `;
}

describe("X.com Content Extractor", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("isXPage()", () => {
    it("should detect x.com", () => {
      setLocation("https://x.com/user/status/123");
      expect(isXPage()).toBe(true);
    });

    it("should detect twitter.com", () => {
      setLocation("https://twitter.com/user/status/123");
      expect(isXPage()).toBe(true);
    });

    it("should reject other domains", () => {
      setLocation("https://example.com/page");
      expect(isXPage()).toBe(false);
    });
  });

  describe("extractXContent()", () => {
    it("should extract a single tweet", () => {
      setLocation("https://x.com/MikaelLirbank/status/1930227040815468955");
      document.body.innerHTML = buildTimelineHTML(
        buildTweetHTML({
          name: "Mikael Lirbank",
          handle: "@MikaelLirbank",
          text: "Neon Testing v2.4.0 is out! This release includes some nice improvements.",
          tweetId: "1930227040815468955",
          handleHref: "/MikaelLirbank",
        }),
      );

      const result = extractXContent();

      expect(result.tweets.length).toBeGreaterThan(0);
      expect(result.pageType).toBe("single");
      expect(result.tweets[0].author.name).toBe("Mikael Lirbank");
      expect(result.tweets[0].author.handle).toBe("@MikaelLirbank");
      expect(result.tweets[0].text).toContain("Neon Testing v2.4.0");
      expect(result.tweets[0].id).toBe("1930227040815468955");
    });

    it("should extract tweet with no tweetText element", () => {
      setLocation("https://x.com/user/status/999");
      // Tweet with missing tweetText data-testid
      document.body.innerHTML = buildTimelineHTML(`
        <article role="article" data-testid="tweet" tabindex="0">
          <div data-testid="User-Name">
            <div><div><a role="link" href="/user"><div><span>User</span></div></a></div></div>
            <div><div><a role="link" href="/user"><div><span>@user</span></div></a></div></div>
          </div>
          <div class="tweet-text-container">
            <span>This text is NOT in a data-testid=tweetText element</span>
          </div>
        </article>
      `);

      const result = extractXContent();

      expect(result.tweets.length).toBe(1);
      expect(result.tweets[0].text).toBe(""); // No tweetText testid = empty text
    });

    it("should return empty tweets array when no tweet elements exist", () => {
      setLocation("https://x.com/user/status/999");
      document.body.innerHTML = `
        <div aria-label="Timeline: Conversation">
          <div>Loading...</div>
        </div>
      `;

      const result = extractXContent();

      expect(result.tweets.length).toBe(0);
    });

    it("should extract multiple tweets as a thread", () => {
      setLocation("https://x.com/user/status/111");
      document.body.innerHTML = buildTimelineHTML(
        buildTweetHTML({
          name: "Thread Author",
          handle: "@threadauthor",
          text: "First tweet in thread",
          tweetId: "111",
          handleHref: "/threadauthor",
        }) +
          buildTweetHTML({
            name: "Thread Author",
            handle: "@threadauthor",
            text: "Second tweet in thread",
            tweetId: "222",
            handleHref: "/threadauthor",
          }),
      );

      const result = extractXContent();

      expect(result.tweets.length).toBe(2);
      expect(result.pageType).toBe("thread");
      expect(result.tweets[0].text).toContain("First tweet");
      expect(result.tweets[1].text).toContain("Second tweet");
      expect(result.tweets[1].isThread).toBe(true);
    });
  });

  describe("renderXContent()", () => {
    it("should render tweet with visible text content", () => {
      setLocation("https://x.com/user/status/123");
      document.body.innerHTML = buildTimelineHTML(
        buildTweetHTML({
          name: "Test User",
          handle: "@testuser",
          text: "Hello, this is a test tweet with some content.",
          tweetId: "123",
        }),
      );

      const extracted = extractXContent();
      const rendered = renderXContent(extracted);

      // The rendered element should have actual text content
      expect(rendered.textContent).toContain("Hello, this is a test tweet");
      expect(rendered.textContent).toContain("Test User");
      expect(rendered.textContent).toContain("@testuser");

      // Should have the x-thread container
      expect(rendered.className).toBe("x-thread");

      // Should have an article inside
      const article = rendered.querySelector("article.x-tweet");
      expect(article).not.toBeNull();

      // Content div should have the tweet text
      const contentDiv = rendered.querySelector(".x-tweet-content");
      expect(contentDiv).not.toBeNull();
      expect(contentDiv!.textContent).toContain("Hello, this is a test tweet");
    });

    it("should extract and render content from real X.com DOM structure", () => {
      setLocation("https://x.com/MikaelLirbank/status/2012970288124727531");

      // This is a real DOM structure from X.com (simplified but preserving key data-testid attributes)
      document.body.innerHTML = `
        <div aria-label="Timeline: Conversation" class="css-175oi2r">
          <div style="position: relative; min-height: 1024px;">
            <div class="css-175oi2r" data-testid="cellInnerDiv" style="transform: translateY(0px); position: absolute; width: 100%;">
              <div class="css-175oi2r r-1igl3o0 r-qklmqi r-1adg3ll r-1ny4l3l">
                <div class="css-175oi2r">
                  <article role="article" tabindex="-1" class="css-175oi2r" data-testid="tweet">
                    <div class="css-175oi2r r-eqz5dr r-16y2uox r-1wbh5a2">
                      <div class="css-175oi2r r-16y2uox r-1wbh5a2 r-1ny4l3l">
                        <div class="css-175oi2r">
                          <div class="css-175oi2r r-18u37iz r-136ojw6">
                            <div class="css-175oi2r r-18kxxzh r-1wron08 r-onrtq4 r-1awozwy">
                              <div class="css-175oi2r" data-testid="Tweet-User-Avatar">
                                <div class="css-175oi2r">
                                  <div class="css-175oi2r">
                                    <div class="css-175oi2r" data-testid="UserAvatar-Container-MikaelLirbank" style="width: 40px; height: 40px;">
                                      <div class="css-175oi2r">
                                        <a href="/MikaelLirbank">
                                          <div class="css-175oi2r">
                                            <img alt="" src="https://pbs.twimg.com/profile_images/1636408654315528198/dXTao4ZQ_x96.jpg">
                                          </div>
                                        </a>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div class="css-175oi2r r-18u37iz r-136ojw6">
                            <div class="css-175oi2r r-1iusvr4 r-16y2uox r-1777fci">
                              <div class="css-175oi2r r-zl2h9q">
                                <div class="css-175oi2r r-k4xj1c r-18u37iz r-1wtj0ep">
                                  <div class="css-175oi2r r-1d09ksm r-18u37iz r-1wbh5a2">
                                    <div class="css-175oi2r r-1wbh5a2 r-dnmrzs r-1ny4l3l">
                                      <div class="css-175oi2r" data-testid="User-Name">
                                        <div class="css-175oi2r r-1awozwy r-18u37iz r-1wbh5a2 r-dnmrzs">
                                          <div class="css-175oi2r r-1wbh5a2 r-dnmrzs">
                                            <a href="/MikaelLirbank" role="link">
                                              <div class="css-175oi2r r-1awozwy r-18u37iz r-1wbh5a2 r-dnmrzs">
                                                <div dir="ltr"><span><span>Mikael Lirbank</span></span></div>
                                              </div>
                                            </a>
                                          </div>
                                        </div>
                                        <div class="css-175oi2r r-18u37iz r-1wbh5a2">
                                          <div class="css-175oi2r r-1d09ksm r-18u37iz r-1wbh5a2">
                                            <div class="css-175oi2r r-1wbh5a2 r-dnmrzs">
                                              <a href="/MikaelLirbank" role="link" tabindex="-1">
                                                <div dir="ltr"><span>@MikaelLirbank</span></div>
                                              </a>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div class="css-175oi2r">
                                <div class="css-175oi2r r-1s2bzr4">
                                  <div dir="auto" lang="en" data-testid="tweetText" style="color: rgb(231, 233, 234);">
                                    <span>Neon Testing v2.4.0 is out! </span>
                                    <span>A Vitest utility for integration tests with </span>
                                    <div><span><a dir="ltr" href="/neondatabase" role="link">@neondatabase</a></span></div>
                                    <span>, now with multi-role support for testing row-level security</span>
                                  </div>
                                </div>
                              </div>
                              <div class="css-175oi2r r-12kyg2d">
                                <div class="css-175oi2r r-k4xj1c r-18u37iz r-1wtj0ep">
                                  <div class="css-175oi2r r-1wbh5a2 r-1a11zyx">
                                    <div class="css-175oi2r r-1d09ksm r-18u37iz r-1wbh5a2 r-1471scf">
                                      <div dir="ltr"><a href="/MikaelLirbank/status/2012970288124727531" role="link"><time datetime="2026-01-18T19:28:10.000Z">11:28 AM · Jan 18, 2026</time></a></div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div class="css-175oi2r r-1igl3o0 r-rull8r r-qklmqi">
                                <div class="css-175oi2r">
                                  <div role="group" class="css-175oi2r">
                                    <div class="css-175oi2r"><button aria-label="0 Replies. Reply" data-testid="reply" type="button"><div><div class="css-175oi2r"><svg viewBox="0 0 24 24"><g><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366"></path></g></svg></div><div><span data-testid="app-text-transition-container"><span></span></span></div></div></button></div>
                                    <div class="css-175oi2r"><button aria-label="2 reposts. Repost" data-testid="retweet" type="button"><div><div class="css-175oi2r"><svg viewBox="0 0 24 24"><g><path d="M4.5 3.88l4.432 4.14"></path></g></svg></div><div><span data-testid="app-text-transition-container"><span><span>2</span></span></span></div></div></button></div>
                                    <div class="css-175oi2r"><button aria-label="6 Likes. Like" data-testid="like" type="button"><div><div class="css-175oi2r"><svg viewBox="0 0 24 24"><g><path d="M16.697 5.5c-1.222"></path></g></svg></div><div><span data-testid="app-text-transition-container"><span><span>6</span></span></span></div></div></button></div>
                                    <div class="css-175oi2r"><button aria-label="4 Bookmarks. Bookmarked" data-testid="removeBookmark" type="button"><div><div class="css-175oi2r"><svg viewBox="0 0 24 24"><g><path d="M4 4.5C4 3.12"></path></g></svg></div><div><span data-testid="app-text-transition-container"><span><span>4</span></span></span></div></div></button></div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </div>`;

      const result = extractXContent();

      expect(result.tweets.length).toBe(1);
      expect(result.tweets[0].author.name).toBe("Mikael Lirbank");
      expect(result.tweets[0].author.handle).toBe("@MikaelLirbank");
      expect(result.tweets[0].text).toContain("Neon Testing v2.4.0");
      expect(result.tweets[0].id).toBe("2012970288124727531");
      expect(result.tweets[0].isoTimestamp).toBe("2026-01-18T19:28:10.000Z");

      // Verify rendering produces visible content
      const rendered = renderXContent(result);
      expect(rendered.textContent).toContain("Neon Testing v2.4.0");
      expect(rendered.querySelector(".x-tweet-content")).not.toBeNull();
    });

    it("should handle bookmarked tweet with removeBookmark testid instead of bookmark", () => {
      // X.com uses data-testid="removeBookmark" for already-bookmarked tweets
      // instead of data-testid="bookmark". This should not break extraction.
      setLocation("https://x.com/user/status/123");
      document.body.innerHTML = buildTimelineHTML(
        `<article role="article" data-testid="tweet">
          <div data-testid="User-Name">
            <div><a href="/user" role="link"><div><span>User</span></div></a></div>
            <div><div><a href="/user" role="link" tabindex="-1"><div><span>@user</span></div></a></div></div>
          </div>
          <div data-testid="tweetText"><span>Test tweet</span></div>
          <div><a href="/user/status/123"><time datetime="2026-01-01T00:00:00.000Z">Jan 1</time></a></div>
          <div>
            <button data-testid="reply"><div><span></span></div></button>
            <button data-testid="retweet"><div><span>5</span></div></button>
            <button data-testid="like"><div><span>10</span></div></button>
            <button data-testid="removeBookmark"><div><span>3</span></div></button>
          </div>
        </article>`,
      );

      const result = extractXContent();
      expect(result.tweets.length).toBe(1);
      expect(result.tweets[0].text).toBe("Test tweet");
      // Bookmark count should be null since we look for data-testid="bookmark", not "removeBookmark"
      expect(result.tweets[0].metrics.bookmarks).toBeNull();
    });

    it("should render empty content div when tweet text is empty", () => {
      const result = {
        tweets: [
          {
            id: "123",
            author: { name: "User", handle: "@user", avatarUrl: null, verified: false },
            text: "",
            timestamp: null,
            isoTimestamp: null,
            media: [],
            quoteTweet: null,
            replyContext: null,
            metrics: {
              replies: null,
              reposts: null,
              likes: null,
              views: null,
              bookmarks: null,
            },
            isThread: false,
            threadPosition: null,
          },
        ],
        pageType: "single" as const,
        mainTweetId: "123",
      };

      const rendered = renderXContent(result);
      const contentDiv = rendered.querySelector(".x-tweet-content");
      expect(contentDiv).not.toBeNull();
      // Empty text = empty content div
      expect(contentDiv!.textContent).toBe("");
    });
  });
});

function setLocation(url: string) {
  Object.defineProperty(window, "location", {
    value: new URL(url),
    writable: true,
    configurable: true,
  });
}

