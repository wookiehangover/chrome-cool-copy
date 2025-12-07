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
    }
  } catch (error) {
    console.error('[Clean Link Copy] Error in message listener:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
});

