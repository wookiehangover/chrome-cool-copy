// Background service worker for handling keyboard shortcuts

chrome.commands.onCommand.addListener((command) => {
  // Get the active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) {
      return;
    }

    const tab = tabs[0];
    
    // Send message to content script based on the command
    if (command === 'copy-clean-url') {
      chrome.tabs.sendMessage(tab.id, { action: 'copyCleanUrl' });
    } else if (command === 'copy-markdown-link') {
      chrome.tabs.sendMessage(tab.id, { action: 'copyMarkdownLink' });
    }
  });
});

