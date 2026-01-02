/**
 * Popup script for Cool Copy extension
 */

document.addEventListener('DOMContentLoaded', (): void => {
  document.getElementById('openChatBtn')?.addEventListener('click', async (): Promise<void> => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.sidePanel.open({ tabId: tab.id });
    }
    window.close();
  });

  document.getElementById('viewClippedPagesBtn')?.addEventListener('click', (): void => {
    chrome.tabs.create({ url: chrome.runtime.getURL('pages/clipped-pages.html') });
    window.close();
  });

  document.getElementById('openSettingsBtn')?.addEventListener('click', (): void => {
    chrome.tabs.create({ url: chrome.runtime.getURL('pages/settings.html') });
    window.close();
  });

  document.getElementById('openShortcutsBtn')?.addEventListener('click', (): void => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    window.close();
  });
});

