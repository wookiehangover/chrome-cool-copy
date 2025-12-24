/**
 * Popup script for Cool Copy extension
 * Handles navigation to the clipped pages viewer
 */

document.addEventListener('DOMContentLoaded', (): void => {
  const viewClippedPagesBtn = document.getElementById('viewClippedPagesBtn');
  const openSettingsBtn = document.getElementById('openSettingsBtn');

  if (viewClippedPagesBtn) {
    viewClippedPagesBtn.addEventListener('click', (): void => {
      // Open clipped-pages.html in a new tab
      const clippedPagesUrl = chrome.runtime.getURL('pages/clipped-pages.html');
      chrome.tabs.create({ url: clippedPagesUrl });

      // Close the popup after opening the viewer
      window.close();
    });
  }

  if (openSettingsBtn) {
    openSettingsBtn.addEventListener('click', (): void => {
      // Open settings.html in a new tab
      const settingsUrl = chrome.runtime.getURL('pages/settings.html');
      chrome.tabs.create({ url: settingsUrl });

      // Close the popup after opening settings
      window.close();
    });
  }
});

