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

// Log that the content script has loaded
// console.log('[Clean Link Copy] Content script loaded');

// Listen for keyboard shortcut: Cmd+Shift+P (macOS) or Ctrl+Shift+P (Windows/Linux)
document.addEventListener('keydown', (event) => {
  // Check for Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows/Linux)
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const correctModifier = isMac ? event.metaKey : event.ctrlKey;

  if (correctModifier && event.shiftKey && (event.key === 'C' || event.key === 'c')) {
    // console.log('[Clean Link Copy] Keyboard shortcut triggered!');
    // Prevent default browser behavior (e.g., print dialog)
    event.preventDefault();
    event.stopPropagation();

    // Handle the copy action
    handleCopyCleanUrl();
  }
}, true); // Use capture phase to intercept before other handlers
