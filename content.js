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
 * Copy image blob to clipboard
 * @param {Blob} blob - The image blob to copy
 */
async function copyImageToClipboard(blob) {
  try {
    const item = new ClipboardItem({ 'image/png': blob });
    await navigator.clipboard.write([item]);
    return true;
  } catch (error) {
    console.error('Failed to copy image to clipboard:', error);
    return false;
  }
}

/**
 * Show toast notification
 * @param {string} message - The message to display
 */
function showToast(message) {
  try {
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
    if (!document.body) {
      console.error('[Clean Link Copy] Cannot show toast: document body not available');
      return;
    }

    document.body.appendChild(toast);

    // Trigger fade-in animation
    setTimeout(() => {
      try {
        toast.classList.add('show');
      } catch (error) {
        console.error('[Clean Link Copy] Error adding show class to toast:', error);
      }
    }, 10);

    // Remove after 2.5 seconds
    setTimeout(() => {
      try {
        toast.classList.remove('show');
        // Remove from DOM after fade-out animation completes
        setTimeout(() => {
          if (toast.parentNode) {
            toast.remove();
          }
        }, 300);
      } catch (error) {
        console.error('[Clean Link Copy] Error removing toast:', error);
        // Force remove if error occurs
        if (toast.parentNode) {
          toast.remove();
        }
      }
    }, 2500);
  } catch (error) {
    console.error('[Clean Link Copy] Error showing toast:', error);
    // Fallback: log to console if toast fails
    console.log('[Clean Link Copy] Toast message:', message);
  }
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

/**
 * Element Picker State
 */
let elementPickerActive = false;
let currentHighlightedElement = null;
let pickerOverlay = null;
let selectedElement = null;

/**
 * Create and show the picker overlay
 */
function createPickerOverlay() {
  try {
    if (pickerOverlay) {
      return pickerOverlay;
    }

    const overlay = document.createElement('div');
    overlay.id = 'element-picker-overlay';
    overlay.className = 'element-picker-overlay';
    overlay.innerHTML = `
      <div class="element-picker-message">
        <span>Element Picker Active</span>
      </div>
    `;

    if (!document.body) {
      throw new Error('Document body not available');
    }

    document.body.appendChild(overlay);
    pickerOverlay = overlay;
    return overlay;
  } catch (error) {
    console.error('[Clean Link Copy] Error creating picker overlay:', error);
    throw error;
  }
}

/**
 * Remove the picker overlay
 */
function removePickerOverlay() {
  try {
    if (pickerOverlay) {
      if (pickerOverlay.parentNode) {
        pickerOverlay.remove();
      }
      pickerOverlay = null;
    }
  } catch (error) {
    console.error('[Clean Link Copy] Error removing picker overlay:', error);
    pickerOverlay = null;
  }
}

/**
 * Highlight an element with a visual border
 */
function highlightElement(element) {
  // Remove previous highlight
  if (currentHighlightedElement && currentHighlightedElement !== element) {
    currentHighlightedElement.classList.remove('element-picker-highlight');
  }

  // Add highlight to new element
  if (element) {
    element.classList.add('element-picker-highlight');
    currentHighlightedElement = element;
  }
}

/**
 * Remove highlight from current element
 */
function removeHighlight() {
  if (currentHighlightedElement) {
    currentHighlightedElement.classList.remove('element-picker-highlight');
    currentHighlightedElement = null;
  }
}

/**
 * Start element picker mode
 */
function startElementPicker() {
  try {
    if (elementPickerActive) {
      return; // Already active
    }

    elementPickerActive = true;

    try {
      createPickerOverlay();
    } catch (error) {
      console.error('[Clean Link Copy] Failed to create picker overlay:', error);
      elementPickerActive = false;
      showToast('× Failed to start element picker');
      throw error;
    }

    // Change cursor to crosshair
    if (document.body) {
      document.body.style.cursor = 'crosshair';
    }

    // Add mousemove listener for highlighting
    document.addEventListener('mousemove', handlePickerMouseMove, true);

    // Add click listener for selection
    document.addEventListener('click', handlePickerClick, true);

    // Add keydown listener for escape
    document.addEventListener('keydown', handlePickerKeydown, true);
  } catch (error) {
    console.error('[Clean Link Copy] Error starting element picker:', error);
    // Ensure cleanup on error
    elementPickerActive = false;
    throw error;
  }
}

/**
 * Handle mouse move during picker mode
 */
function handlePickerMouseMove(event) {
  if (!elementPickerActive) return;

  // Get the element under the cursor (excluding the overlay)
  const element = document.elementFromPoint(event.clientX, event.clientY);

  // Don't highlight the overlay itself or body/html
  if (element && element !== pickerOverlay && element.parentElement !== pickerOverlay &&
      element.tagName !== 'HTML' && element.tagName !== 'BODY') {
    highlightElement(element);
  } else {
    removeHighlight();
  }
}

/**
 * Handle click during picker mode
 */
async function handlePickerClick(event) {
  if (!elementPickerActive) return;

  try {
    event.preventDefault();
    event.stopPropagation();

    // Store the selected element
    const element = document.elementFromPoint(event.clientX, event.clientY);

    // Don't select the overlay itself or body/html
    if (element && element !== pickerOverlay && element.parentElement !== pickerOverlay &&
        element.tagName !== 'HTML' && element.tagName !== 'BODY') {
      selectedElement = element;
      console.log('[Clean Link Copy] Element selected:', element);

      // Detect element type and handle copying
      const elementType = detectElementType(element);
      console.log('[Clean Link Copy] Detected element type:', elementType);

      // Exit picker mode before handling copy
      stopElementPicker();

      // Handle the copy based on element type
      try {
        if (elementType === 'table') {
          await handleTableCopy(element);
        } else if (elementType === 'text') {
          await handleTextCopy(element);
        } else if (elementType === 'image' || elementType === 'visual') {
          await handleImageCopy(element);
        }
      } catch (error) {
        console.error('[Clean Link Copy] Error handling element copy:', error);
        showToast('× Error copying element');
      }
    } else {
      // Exit picker mode without selection
      stopElementPicker();
    }
  } catch (error) {
    console.error('[Clean Link Copy] Error in picker click handler:', error);
    stopElementPicker();
    showToast('× Error in element picker');
  }
}

/**
 * Handle keydown during picker mode
 */
function handlePickerKeydown(event) {
  if (!elementPickerActive) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    stopElementPicker();
  }
}

/**
 * Stop element picker mode
 */
function stopElementPicker() {
  try {
    if (!elementPickerActive) return;

    elementPickerActive = false;

    // Restore cursor
    if (document.body) {
      document.body.style.cursor = 'auto';
    }

    // Remove event listeners
    document.removeEventListener('mousemove', handlePickerMouseMove, true);
    document.removeEventListener('click', handlePickerClick, true);
    document.removeEventListener('keydown', handlePickerKeydown, true);

    // Remove highlight and overlay
    removeHighlight();
    removePickerOverlay();

    // If no element was selected (e.g., Escape was pressed), clear the selection
    if (!selectedElement) {
      console.log('[Clean Link Copy] Element picker cancelled without selection');
    }
  } catch (error) {
    console.error('[Clean Link Copy] Error stopping element picker:', error);
    // Ensure cleanup even on error
    elementPickerActive = false;
    if (document.body) {
      document.body.style.cursor = 'auto';
    }
  }
}

/**
 * Get the currently selected element
 * @returns {Element|null} - The selected element or null if none selected
 */
function getSelectedElement() {
  return selectedElement;
}

/**
 * Clear the selected element
 */
function clearSelectedElement() {
  selectedElement = null;
}

/**
 * Handle table copy
 * @param {Element} element - The table element or element containing a table
 */
async function handleTableCopy(element) {
  try {
    const csv = tableToCSV(element);
    const success = await copyToClipboard(csv);

    if (success) {
      showToast('✓ CSV copied');
    } else {
      showToast('× Failed to copy CSV');
    }
  } catch (error) {
    console.error('[Clean Link Copy] Error copying table:', error);
    showToast('× Failed to copy table');
  }
}

/**
 * Handle text copy - extract innerText/textContent from element
 * @param {Element} element - The text element
 */
async function handleTextCopy(element) {
  try {
    // Try to use innerText first (preserves line breaks and formatting)
    // Fall back to textContent if innerText is not available
    let text = '';

    if (element.innerText) {
      text = element.innerText.trim();
    } else if (element.textContent) {
      text = element.textContent.trim();
    }

    if (!text) {
      showToast('× No text content found');
      return;
    }

    const success = await copyToClipboard(text);

    if (success) {
      showToast('✓ Text copied');
    } else {
      showToast('× Failed to copy text');
    }
  } catch (error) {
    console.error('[Clean Link Copy] Error copying text:', error);
    showToast('× Failed to copy text');
  }
}

/**
 * Handle image copy - send element bounds to background service worker
 * @param {Element} element - The element to capture as image
 */
async function handleImageCopy(element) {
  try {
    // Get the bounding client rect of the element
    const rect = element.getBoundingClientRect();

    // Get the device pixel ratio for proper scaling on high-DPI displays
    const devicePixelRatio = window.devicePixelRatio || 1;

    // Prepare the message with element bounds and pixel ratio
    // The bounds are in CSS pixels, the background will scale by devicePixelRatio
    const message = {
      action: 'captureElement',
      bounds: {
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      },
      devicePixelRatio: devicePixelRatio
    };

    console.log('[Clean Link Copy] Sending capture request with bounds:', message.bounds, 'devicePixelRatio:', devicePixelRatio);

    // Send message to background service worker
    chrome.runtime.sendMessage(message, (response) => {
      try {
        // Check for errors
        if (chrome.runtime.lastError) {
          console.error('[Clean Link Copy] Failed to send message to background:', chrome.runtime.lastError.message);
          showToast('× Failed to capture image');
          return;
        }

        // Check if response indicates success
        if (!response || !response.success) {
          console.error('[Clean Link Copy] Background failed to capture image:', response?.error);
          showToast('× Failed to capture image');
          return;
        }

        // Response should contain a data URL or blob
        if (!response.imageData) {
          console.error('[Clean Link Copy] No image data in response');
          showToast('× Failed to capture image');
          return;
        }

        // Convert data URL to blob and copy to clipboard
        fetch(response.imageData)
          .then(res => res.blob())
          .then(blob => copyImageToClipboard(blob))
          .then(success => {
            if (success) {
              showToast('✓ Image copied');
            } else {
              showToast('× Failed to copy image');
            }
          })
          .catch(error => {
            console.error('[Clean Link Copy] Error processing captured image:', error);
            showToast('× Failed to copy image');
          });
      } catch (error) {
        console.error('[Clean Link Copy] Error in capture response handler:', error);
        showToast('× Failed to capture image');
      }
    });
  } catch (error) {
    console.error('[Clean Link Copy] Error in handleImageCopy:', error);
    showToast('× Failed to capture image');
  }
}

/**
 * Check if an element has visual styling (gradients, shadows, transforms, etc.)
 * @param {Element} element - The element to check
 * @returns {boolean} - True if element has significant visual styling
 */
function hasVisualStyling(element) {
  if (!element) return false;

  const computedStyle = window.getComputedStyle(element);

  // Check for background images
  const backgroundImage = computedStyle.backgroundImage;
  if (backgroundImage && backgroundImage !== 'none') {
    return true;
  }

  // Check for gradients in background
  if (backgroundImage && (backgroundImage.includes('gradient') || backgroundImage.includes('url'))) {
    return true;
  }

  // Check for box-shadow or text-shadow
  const boxShadow = computedStyle.boxShadow;
  const textShadow = computedStyle.textShadow;
  if ((boxShadow && boxShadow !== 'none') || (textShadow && textShadow !== 'none')) {
    return true;
  }

  // Check for transforms
  const transform = computedStyle.transform;
  if (transform && transform !== 'none') {
    return true;
  }

  // Check for filters
  const filter = computedStyle.filter;
  if (filter && filter !== 'none') {
    return true;
  }

  return false;
}

/**
 * Calculate the text-to-element ratio for an element
 * @param {Element} element - The element to analyze
 * @returns {number} - Ratio of text content to child elements (higher = more text-heavy)
 */
function calculateTextRatio(element) {
  if (!element) return 0;

  // Count text nodes (excluding whitespace-only nodes)
  let textNodeCount = 0;
  let totalCharacters = 0;

  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      if (text.length > 0) {
        textNodeCount++;
        totalCharacters += text.length;
      }
    }
  }

  // Count child elements
  const childElementCount = element.children.length;

  // If no child elements, it's text-heavy
  if (childElementCount === 0) {
    return totalCharacters > 0 ? 100 : 0;
  }

  // Calculate ratio: text characters per child element
  // Higher ratio means more text relative to structure
  const ratio = totalCharacters / childElementCount;

  return ratio;
}

/**
 * Check if an element is text-heavy (high ratio of text to visual complexity)
 * @param {Element} element - The element to check
 * @returns {boolean} - True if element is text-heavy
 */
function isTextHeavy(element) {
  if (!element) return false;

  // Don't consider elements with visual styling as text-heavy
  if (hasVisualStyling(element)) {
    return false;
  }

  // Calculate text ratio
  const textRatio = calculateTextRatio(element);

  // Threshold: if ratio is >= 20 characters per child element, consider it text-heavy
  // This accounts for typical text content while filtering out structure-heavy elements
  const TEXT_RATIO_THRESHOLD = 20;

  return textRatio >= TEXT_RATIO_THRESHOLD;
}

/**
 * Detect the type of element for copying
 * @param {Element} element - The element to detect
 * @returns {string} - The element type: 'table', 'text', 'image', or 'visual'
 */
function detectElementType(element) {
  if (!element) {
    return 'text';
  }

  // Check if element is or contains a table
  if (element.tagName === 'TABLE' || element.querySelector('table')) {
    return 'table';
  }

  // Check if element is or contains images
  if (element.tagName === 'IMG' || element.querySelector('img')) {
    return 'image';
  }

  // Check if element is or contains canvas or SVG
  if (element.tagName === 'CANVAS' || element.tagName === 'SVG' ||
      element.querySelector('canvas') || element.querySelector('svg')) {
    return 'visual';
  }

  // Check if element is text-heavy (high text-to-element ratio, minimal visual styling)
  if (isTextHeavy(element)) {
    return 'text';
  }

  // Default to visual for other elements (complex/styled content)
  return 'visual';
}

/**
 * Convert a table element to CSV format
 * @param {Element} tableElement - The table element to convert
 * @returns {string} - CSV formatted string
 */
function tableToCSV(tableElement) {
  try {
    // Find the actual table element if the selected element contains a table
    const table = tableElement.tagName === 'TABLE'
      ? tableElement
      : tableElement.querySelector('table');

    if (!table) {
      throw new Error('No table found in element');
    }

    // Get all rows
    const rows = Array.from(table.querySelectorAll('tr'));

    if (rows.length === 0) {
      throw new Error('Table has no rows');
    }

    // Create a 2D array to handle merged cells
    const maxCols = Math.max(...rows.map(row => {
      let colCount = 0;
      Array.from(row.querySelectorAll('td, th')).forEach(cell => {
        colCount += parseInt(cell.getAttribute('colspan') || 1);
      });
      return colCount;
    }));

    // Build the CSV data
    const cellMatrix = Array(rows.length).fill(null).map(() => Array(maxCols).fill(''));

    rows.forEach((row, rowIndex) => {
      let colIndex = 0;
      const cells = Array.from(row.querySelectorAll('td, th'));

      cells.forEach(cell => {
        // Skip already filled cells (from colspan/rowspan)
        while (colIndex < maxCols && cellMatrix[rowIndex][colIndex] !== '') {
          colIndex++;
        }

        const colspan = parseInt(cell.getAttribute('colspan') || 1);
        const rowspan = parseInt(cell.getAttribute('rowspan') || 1);
        const cellText = cell.textContent.trim();

        // Fill the cell and handle colspan/rowspan
        for (let r = 0; r < rowspan; r++) {
          for (let c = 0; c < colspan; c++) {
            if (rowIndex + r < rows.length) {
              cellMatrix[rowIndex + r][colIndex + c] = cellText;
            }
          }
        }

        colIndex += colspan;
      });
    });

    // Convert matrix to CSV
    const csvContent = cellMatrix.map(row => {
      return row.map(cell => {
        // Escape quotes and wrap in quotes if contains comma, newline, or quote
        const escaped = cell.replace(/"/g, '""');
        if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')) {
          return `"${escaped}"`;
        }
        return escaped;
      }).join(',');
    }).join('\n');

    return csvContent;
  } catch (error) {
    console.error('Error converting table to CSV:', error);
    throw error;
  }
}

// Log that the content script has loaded
// console.log('[Clean Link Copy] Content script loaded');

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.action === 'copyCleanUrl') {
      handleCopyCleanUrl()
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error('[Clean Link Copy] Error in copyCleanUrl:', error);
          sendResponse({ success: false, error: error.message });
        });
    } else if (message.action === 'copyMarkdownLink') {
      handleCopyMarkdownLink()
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error('[Clean Link Copy] Error in copyMarkdownLink:', error);
          sendResponse({ success: false, error: error.message });
        });
    } else if (message.action === 'startElementPicker') {
      try {
        startElementPicker();
        sendResponse({ success: true });
      } catch (error) {
        console.error('[Clean Link Copy] Error in startElementPicker:', error);
        sendResponse({ success: false, error: error.message });
      }
    } else {
      console.warn('[Clean Link Copy] Unknown message action:', message.action);
      sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error('[Clean Link Copy] Unexpected error in message listener:', error);
    sendResponse({ success: false, error: error.message });
  }
  return true; // Keep the message channel open for async response
});
