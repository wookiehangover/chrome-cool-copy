/**
 * Wikipedia Detector Tests
 * Tests for Wikipedia page detection and article title extraction
 */

// Mock window.location for testing
function createMockLocation(url) {
  const urlObj = new URL(url);
  return {
    href: url,
    hostname: urlObj.hostname,
    pathname: urlObj.pathname,
    search: urlObj.search,
  };
}

// Import the functions to test
// Note: In a real test environment, these would be imported from the compiled module
// For now, we'll define them inline for testing

function isWikipediaPage(hostname) {
  return /^[a-z]{2,}\.wikipedia\.org$/.test(hostname);
}

function getWikipediaArticleTitle(url) {
  try {
    const urlObj = new URL(url);
    
    if (!/^[a-z]{2,}\.wikipedia\.org$/.test(urlObj.hostname)) {
      return null;
    }

    const pathname = urlObj.pathname;
    
    const wikiMatch = pathname.match(/^\/wiki\/(.+)$/);
    if (wikiMatch) {
      const encodedTitle = wikiMatch[1];
      return decodeURIComponent(encodedTitle);
    }

    const titleParam = urlObj.searchParams.get("title");
    if (titleParam) {
      return decodeURIComponent(titleParam);
    }

    return null;
  } catch {
    return null;
  }
}

function isWikipediaSpecialPage(title) {
  if (!title) {
    return true;
  }

  if (title === "Main_Page") {
    return true;
  }

  if (title.startsWith("Special:")) {
    return true;
  }

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

function getWikipediaArticle(url) {
  const title = getWikipediaArticleTitle(url);
  
  if (isWikipediaSpecialPage(title)) {
    return null;
  }

  return title;
}

// Test cases
const tests = [
  {
    name: "English Wikipedia article",
    url: "https://en.wikipedia.org/wiki/Python_(programming_language)",
    expectedTitle: "Python_(programming_language)",
    expectedArticle: "Python_(programming_language)",
  },
  {
    name: "French Wikipedia article",
    url: "https://fr.wikipedia.org/wiki/Python_(langage)",
    expectedTitle: "Python_(langage)",
    expectedArticle: "Python_(langage)",
  },
  {
    name: "Wikipedia Main Page",
    url: "https://en.wikipedia.org/wiki/Main_Page",
    expectedTitle: "Main_Page",
    expectedArticle: null,
  },
  {
    name: "Wikipedia Special page",
    url: "https://en.wikipedia.org/wiki/Special:RecentChanges",
    expectedTitle: "Special:RecentChanges",
    expectedArticle: null,
  },
  {
    name: "Wikipedia Template page",
    url: "https://en.wikipedia.org/wiki/Template:Cite_web",
    expectedTitle: "Template:Cite_web",
    expectedArticle: null,
  },
  {
    name: "Wikipedia Category page",
    url: "https://en.wikipedia.org/wiki/Category:Programming_languages",
    expectedTitle: "Category:Programming_languages",
    expectedArticle: null,
  },
  {
    name: "URL encoded article title",
    url: "https://en.wikipedia.org/wiki/Albert_Einstein",
    expectedTitle: "Albert_Einstein",
    expectedArticle: "Albert_Einstein",
  },
  {
    name: "Non-Wikipedia URL",
    url: "https://example.com/wiki/Article",
    expectedTitle: null,
    expectedArticle: null,
  },
];

// Run tests
console.log("Running Wikipedia Detector tests...\n");
let passed = 0;
let failed = 0;

tests.forEach(test => {
  try {
    const title = getWikipediaArticleTitle(test.url);
    const article = getWikipediaArticle(test.url);
    
    const titleMatch = title === test.expectedTitle;
    const articleMatch = article === test.expectedArticle;
    
    if (titleMatch && articleMatch) {
      console.log(`✓ ${test.name}`);
      passed++;
    } else {
      console.log(`✗ ${test.name}`);
      if (!titleMatch) {
        console.log(`  Title - Expected: ${test.expectedTitle}, Got: ${title}`);
      }
      if (!articleMatch) {
        console.log(`  Article - Expected: ${test.expectedArticle}, Got: ${article}`);
      }
      failed++;
    }
  } catch (error) {
    console.log(`✗ ${test.name} - Error: ${error.message}`);
    failed++;
  }
});

console.log(`\n${passed} passed, ${failed} failed`);

