// Content script for URL cleaning and clipboard operations

// List of common tracking parameters to remove
const TRACKING_PARAMS = [
  // UTM parameters
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'utm_source_platform',
  'utm_creative_format',
  'utm_marketing_tactic',
  
  // Facebook
  'fbclid',
  'fb_action_ids',
  'fb_action_types',
  'fb_ref',
  'fb_source',
  
  // Google
  'gclid',
  'gclsrc',
  'dclid',
  'gbraid',
  'wbraid',
  
  // Other common tracking parameters
  'ref',
  'source',
  'mc_cid',
  'mc_eid',
  '_ga',
  '_gl',
  'msclkid',
  'igshid',
  'twclid',
  'li_fat_id',
  'wickedid',
  'yclid',
  'ncid',
  'srsltid',
  'si',
  'feature',
  'app',
  'ved',
  'usg',
  'sa',
  'ei',
  'bvm',
  'sxsrf'
];

/**
 * Clean URL by removing tracking parameters
 * @param {string} url - The URL to clean
 * @returns {string} - The cleaned URL
 */
function cleanUrl(url) {
  try {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);
    
    // Remove tracking parameters
    TRACKING_PARAMS.forEach(param => {
      params.delete(param);
    });
    
    // Reconstruct the URL
    urlObj.search = params.toString();
    
    // Return the clean URL (remove trailing '?' if no params remain)
    let cleanedUrl = urlObj.toString();
    if (cleanedUrl.endsWith('?')) {
      cleanedUrl = cleanedUrl.slice(0, -1);
    }
    
    return cleanedUrl;
  } catch (error) {
    console.error('Error cleaning URL:', error);
    return url; // Return original URL if parsing fails
  }
}

/**
 * Copy text to clipboard
 * @param {string} text - The text to copy
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Show toast notification
 * @param {string} message - The message to display
 */
function showToast(message) {
  // Remove any existing toast
  const existingToast = document.getElementById('clean-link-copy-toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  // Create toast element
  const toast = document.createElement('div');
  toast.id = 'clean-link-copy-toast';
  toast.className = 'clean-link-copy-toast';
  toast.textContent = message;
  
  // Add to page
  document.body.appendChild(toast);
  
  // Trigger fade-in animation
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Remove after 2.5 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    // Remove from DOM after fade-out animation completes
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  }, 2500);
}

/**
 * Get the page title
 * @returns {string} - The page title
 */
function getPageTitle() {
  return document.title || 'Untitled';
}

/**
 * Create a markdown link
 * @param {string} url - The URL
 * @param {string} title - The link title
 * @returns {string} - The markdown formatted link
 */
function createMarkdownLink(url, title) {
  // Escape square brackets in title
  const escapedTitle = title.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
  return `[${escapedTitle}](${url})`;
}

/**
 * Handle the copy clean URL action
 */
async function handleCopyCleanUrl() {
  const currentUrl = window.location.href;
  const cleanedUrl = cleanUrl(currentUrl);

  const success = await copyToClipboard(cleanedUrl);

  if (success) {
    showToast('✓ Link copied');
  } else {
    showToast('× Failed to copy link');
  }
}

/**
 * Handle the copy markdown link action
 */
async function handleCopyMarkdownLink() {
  const currentUrl = window.location.href;
  const cleanedUrl = cleanUrl(currentUrl);
  const pageTitle = getPageTitle();
  const markdownLink = createMarkdownLink(cleanedUrl, pageTitle);

  const success = await copyToClipboard(markdownLink);

  if (success) {
    showToast('✓ Link copied');
  } else {
    showToast('× Failed to copy link');
  }
}

// Log that the content script has loaded
// console.log('[Clean Link Copy] Content script loaded');

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'copyCleanUrl') {
    handleCopyCleanUrl();
    sendResponse({ success: true });
  } else if (message.action === 'copyMarkdownLink') {
    handleCopyMarkdownLink();
    sendResponse({ success: true });
  }
  return true; // Keep the message channel open for async response
});
