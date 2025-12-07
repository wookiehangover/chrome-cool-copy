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

