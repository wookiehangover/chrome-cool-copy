// Background service worker for handling keyboard shortcuts

/**
 * Send a message to the content script with error handling
 * @param {number} tabId - The tab ID to send the message to
 * @param {Object} message - The message object
 */
function sendMessageToTab(tabId, message) {
  chrome.tabs.sendMessage(tabId, message, (response) => {
    // Check for errors
    if (chrome.runtime.lastError) {
      console.error('[Clean Link Copy] Failed to send message:', chrome.runtime.lastError.message);
      // Silently fail - the user will see the error in the content script if it's available
      return;
    }

    // Log successful response
    if (response && response.success) {
      console.log('[Clean Link Copy] Message sent successfully:', message.action);
    }
  });
}

/**
 * Capture the visible tab and crop to element bounds
 * @param {Object} bounds - Element bounds {top, left, width, height} in CSS pixels
 * @param {number} devicePixelRatio - The device pixel ratio for scaling
 * @returns {Promise<string>} - Data URL of the cropped image
 */
async function captureAndCropImage(bounds, devicePixelRatio = 1) {
  try {
    // Get the active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tabs || tabs.length === 0) {
      throw new Error('No active tab found');
    }

    const tab = tabs[0];

    // Capture the visible tab as PNG
    const screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png'
    });

    // Convert data URL to blob, then create ImageBitmap (service workers don't have Image)
    const screenshotResponse = await fetch(screenshotDataUrl);
    const screenshotBlob = await screenshotResponse.blob();
    const image = await createImageBitmap(screenshotBlob);

    // Scale bounds by devicePixelRatio since captureVisibleTab captures at native resolution
    const scaledBounds = {
      left: Math.round(bounds.left * devicePixelRatio),
      top: Math.round(bounds.top * devicePixelRatio),
      width: Math.round(bounds.width * devicePixelRatio),
      height: Math.round(bounds.height * devicePixelRatio)
    };

    console.log('[Clean Link Copy] Screenshot captured (' + image.width + 'x' + image.height + '), cropping with devicePixelRatio:', devicePixelRatio, 'scaledBounds:', scaledBounds);

    // Clamp bounds to image dimensions to avoid drawing outside the image
    const clampedBounds = {
      left: Math.max(0, Math.min(scaledBounds.left, image.width)),
      top: Math.max(0, Math.min(scaledBounds.top, image.height)),
      width: Math.min(scaledBounds.width, image.width - Math.max(0, scaledBounds.left)),
      height: Math.min(scaledBounds.height, image.height - Math.max(0, scaledBounds.top))
    };

    // Create an offscreen canvas for cropping at the scaled size
    const canvas = new OffscreenCanvas(clampedBounds.width, clampedBounds.height);
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Draw the cropped region from the screenshot
    ctx.drawImage(
      image,
      clampedBounds.left,    // source x
      clampedBounds.top,     // source y
      clampedBounds.width,   // source width
      clampedBounds.height,  // source height
      0,                     // destination x
      0,                     // destination y
      clampedBounds.width,   // destination width
      clampedBounds.height   // destination height
    );

    // Convert canvas to blob and then to data URL
    const blob = await canvas.convertToBlob({ type: 'image/png' });

    // Convert blob to data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('[Clean Link Copy] Error capturing and cropping image:', error);
    throw error;
  }
}

/**
 * Capture the entire page by scrolling and stitching screenshots
 * Uses rate limiting to avoid exceeding MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND
 * @param {number} tabId - The tab ID to capture
 * @param {Object} pageInfo - Page dimensions and scroll info from content script
 * @returns {Promise<string>} - Data URL of the full page screenshot
 */
async function captureEntirePage(tabId, pageInfo) {
  const { scrollWidth, scrollHeight, viewportWidth, viewportHeight, devicePixelRatio } = pageInfo;

  // Rate limit: Chrome allows ~2 captureVisibleTab calls per second
  // Use 600ms delay to stay safely under the limit
  const CAPTURE_DELAY_MS = 600;

  console.log('[Clean Link Copy] Capturing entire page:', scrollWidth + 'x' + scrollHeight,
    'viewport:', viewportWidth + 'x' + viewportHeight, 'dpr:', devicePixelRatio);

  // Get the active tab's window
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || tabs.length === 0) {
    throw new Error('No active tab found');
  }
  const tab = tabs[0];

  // Calculate how many screenshots we need
  const cols = Math.ceil(scrollWidth / viewportWidth);
  const rows = Math.ceil(scrollHeight / viewportHeight);
  const totalCaptures = cols * rows;

  console.log('[Clean Link Copy] Will capture', cols, 'x', rows, '=', totalCaptures, 'screenshots');

  // Create the final canvas at full page size (scaled by devicePixelRatio)
  const finalWidth = Math.round(scrollWidth * devicePixelRatio);
  const finalHeight = Math.round(scrollHeight * devicePixelRatio);
  const finalCanvas = new OffscreenCanvas(finalWidth, finalHeight);
  const finalCtx = finalCanvas.getContext('2d');

  if (!finalCtx) {
    throw new Error('Failed to get canvas context');
  }

  // Fill with white background
  finalCtx.fillStyle = '#ffffff';
  finalCtx.fillRect(0, 0, finalWidth, finalHeight);

  // Capture each section with rate limiting
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const scrollX = col * viewportWidth;
      const scrollY = row * viewportHeight;

      // Tell content script to scroll to position
      await chrome.tabs.sendMessage(tabId, {
        action: 'scrollTo',
        x: scrollX,
        y: scrollY
      });

      // Wait for scroll and render to complete
      await new Promise(resolve => setTimeout(resolve, 150));

      // Capture the visible viewport
      const screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'png'
      });

      // Convert to ImageBitmap
      const response = await fetch(screenshotDataUrl);
      const blob = await response.blob();
      const image = await createImageBitmap(blob);

      // Calculate where to draw this piece
      const destX = Math.round(scrollX * devicePixelRatio);
      const destY = Math.round(scrollY * devicePixelRatio);

      // Calculate how much of this screenshot to use (handle edge cases)
      const remainingWidth = scrollWidth - scrollX;
      const remainingHeight = scrollHeight - scrollY;
      const srcWidth = Math.min(image.width, Math.round(remainingWidth * devicePixelRatio));
      const srcHeight = Math.min(image.height, Math.round(remainingHeight * devicePixelRatio));

      // Draw this piece onto the final canvas
      finalCtx.drawImage(
        image,
        0, 0,           // source x, y
        srcWidth, srcHeight,  // source width, height
        destX, destY,   // destination x, y
        srcWidth, srcHeight   // destination width, height
      );

      const captureNum = row * cols + col + 1;
      console.log('[Clean Link Copy] Captured section', captureNum, '/', totalCaptures,
        'at scroll', scrollX + ',' + scrollY);

      // Rate limit: wait before next capture (skip delay on last capture)
      if (captureNum < totalCaptures) {
        await new Promise(resolve => setTimeout(resolve, CAPTURE_DELAY_MS));
      }
    }
  }

  // Convert final canvas to data URL
  const blob = await finalCanvas.convertToBlob({ type: 'image/png' });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

chrome.commands.onCommand.addListener((command) => {
  // Get the active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    // Handle query errors
    if (chrome.runtime.lastError) {
      console.error('[Clean Link Copy] Failed to query tabs:', chrome.runtime.lastError.message);
      return;
    }

    if (tabs.length === 0) {
      console.warn('[Clean Link Copy] No active tab found');
      return;
    }

    const tab = tabs[0];

    // Send message to content script based on the command
    if (command === 'copy-clean-url') {
      sendMessageToTab(tab.id, { action: 'copyCleanUrl' });
    } else if (command === 'copy-markdown-link') {
      sendMessageToTab(tab.id, { action: 'copyMarkdownLink' });
    } else if (command === 'copy-element') {
      sendMessageToTab(tab.id, { action: 'startElementPicker' });
    } else if (command === 'clip-page') {
      sendMessageToTab(tab.id, { action: 'clipPage' });
    }
  });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.action === 'captureElement') {
      // Handle element capture request
      captureAndCropImage(message.bounds, message.devicePixelRatio || 1)
        .then(imageData => {
          sendResponse({
            success: true,
            imageData: imageData
          });
        })
        .catch(error => {
          console.error('[Clean Link Copy] Error in captureElement handler:', error);
          sendResponse({
            success: false,
            error: error.message
          });
        });

      // Return true to indicate we'll send response asynchronously
      return true;
    } else if (message.action === 'captureFullPage') {
      // Handle full page capture request by scrolling and stitching with rate limiting
      captureEntirePage(sender.tab.id, message.pageInfo)
        .then(imageData => {
          // Restore original scroll position
          chrome.tabs.sendMessage(sender.tab.id, {
            action: 'scrollTo',
            x: message.pageInfo.originalScrollX,
            y: message.pageInfo.originalScrollY
          });
          sendResponse({
            success: true,
            imageData: imageData
          });
        })
        .catch(error => {
          console.error('[Clean Link Copy] Error in captureFullPage handler:', error);
          // Try to restore scroll position even on error
          chrome.tabs.sendMessage(sender.tab.id, {
            action: 'scrollTo',
            x: message.pageInfo.originalScrollX,
            y: message.pageInfo.originalScrollY
          });
          sendResponse({
            success: false,
            error: error.message
          });
        });

      // Return true to indicate we'll send response asynchronously
      return true;
    } else if (message.action === 'savePageToDatabase') {
      // Handle page clip request - save to AgentDB
      (async () => {
        try {
          // Dynamically import the database service
          const { initializeDatabase, saveWebpage } = await import('./services/database.ts');

          // Get AgentDB config from chrome.storage.sync
          const storageData = await new Promise((resolve) => {
            chrome.storage.sync.get(['agentdbConfig'], (result) => {
              resolve(result);
            });
          });

          const config = storageData.agentdbConfig;
          if (!config || !config.baseUrl || !config.apiKey || !config.token || !config.dbName) {
            throw new Error('AgentDB configuration not found. Please configure AgentDB settings.');
          }

          // Initialize database connection
          await initializeDatabase(config);

          // Save the webpage
          const webpage = {
            url: message.url,
            title: message.title,
            dom_content: message.domContent,
            text_content: message.textContent,
            metadata: message.metadata || {}
          };

          await saveWebpage(webpage);

          sendResponse({
            success: true,
            message: 'Page clipped successfully'
          });
        } catch (error) {
          console.error('[Clean Link Copy] Error saving page to database:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      })();

      // Return true to indicate we'll send response asynchronously
      return true;
    }
  } catch (error) {
    console.error('[Clean Link Copy] Error in message listener:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
});

