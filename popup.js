/**
 * Popup script for Cool Copy extension
 * Handles navigation to the clipped pages viewer
 */

document.addEventListener('DOMContentLoaded', () => {
  const viewClippedPagesBtn = document.getElementById('viewClippedPagesBtn');
  const openSettingsBtn = document.getElementById('openSettingsBtn');

  if (viewClippedPagesBtn) {
    viewClippedPagesBtn.addEventListener('click', () => {
      // Open clipped-pages.html in a new tab
      const clippedPagesUrl = chrome.runtime.getURL('clipped-pages.html');
      chrome.tabs.create({ url: clippedPagesUrl });

      // Close the popup after opening the viewer
      window.close();
    });
  }

  if (openSettingsBtn) {
    openSettingsBtn.addEventListener('click', () => {
      // Open settings.html in a new tab
      const settingsUrl = chrome.runtime.getURL('settings.html');
      chrome.tabs.create({ url: settingsUrl });

      // Close the popup after opening settings
      window.close();
    });
  }
});

