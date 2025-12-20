# Cool Copy - Chrome Extension

A Chrome extension that adds cool copy features to Chrome, including:
- copying clean URLs without tracking parameters using a simple keyboard shortcut
- copying markdown formatted links using a simple keyboard shortcut
- copying any element on the page to the clipboard using a simple keyboard shortcut
- **clipping entire web pages to AgentDB for persistent storage and later retrieval**

## Features

### Copy Features
- **Copy clean URL**: `Cmd+Shift+C` (macOS) / `Ctrl+Shift+C` (Windows/Linux) - Configurable via `chrome://extensions/shortcuts`
- **Copy markdown link**: `Cmd+Shift+X` (macOS) / `Ctrl+Shift+X` (Windows/Linux) - Configurable via `chrome://extensions/shortcuts`
- **Copy element**: `Cmd+Shift+P` (macOS) / `Ctrl+Shift+P` (Windows/Linux) - Configurable via `chrome://extensions/shortcuts`

### Page Clipper
- **Clip current page**: `Cmd+Shift+S` (macOS) / `Ctrl+Shift+S` (Windows/Linux) - Configurable via `chrome://extensions/shortcuts`
- **Persistent storage**: Pages are saved to AgentDB for later retrieval
- **Full content capture**: Captures both DOM content and text content
- **Metadata extraction**: Automatically extracts page title, description, keywords, and Open Graph data
- **Clipped pages viewer**: Access all clipped pages via the extension popup
- **Search and filter**: Find clipped pages by title or URL
- **View full content**: Expand any clipped page to view its complete text content
- **Delete pages**: Remove clipped pages with confirmation

### URL Cleaning
- **Automatic URL Cleaning**: Removes common tracking parameters including:
  - UTM parameters (`utm_source`, `utm_medium`, `utm_campaign`, etc.)
  - Facebook tracking (`fbclid`, `fb_action_ids`, etc.)
  - Google tracking (`gclid`, `gclsrc`, `dclid`, etc.)
  - Other common trackers (`ref`, `source`, `msclkid`, etc.)

### User Experience
- **Toast Notifications**: Displays confirmation messages for all actions
- **Error Handling**: User-friendly error messages for configuration or database issues
- **Works Everywhere**: Functions on any webpage

## Installation

### Install from Source

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked"
5. Select the extension directory
6. (Optional) Configure AgentDB for page clipping feature (see [AgentDB Setup](#agentdb-setup) below)

## Usage

### Copy Features

1. Navigate to any webpage
2. Press the keyboard shortcut for the desired action:
   - **Copy clean URL**: `Cmd+Shift+C` (macOS) / `Ctrl+Shift+C` (Windows/Linux)
   - **Copy markdown link**: `Cmd+Shift+X` (macOS) / `Ctrl+Shift+X` (Windows/Linux)
   - **Copy element**: `Cmd+Shift+P` (macOS) / `Ctrl+Shift+P` (Windows/Linux)
3. A toast notification confirms the action
4. The content is copied to your clipboard

### Page Clipper

1. Navigate to any webpage you want to save
2. Press `Cmd+Shift+S` (macOS) / `Ctrl+Shift+S` (Windows/Linux) to clip the page
3. A toast notification confirms the page was clipped successfully
4. To view your clipped pages:
   - Click the Cool Copy extension icon in the toolbar
   - Click "View Clipped Pages" button
   - The clipped pages viewer will open in a new tab
5. In the clipped pages viewer:
   - **Search**: Use the search box to find pages by title or URL
   - **View**: Click the "View" button to see the full text content of a page
   - **Delete**: Click the "Delete" button to remove a page (with confirmation)

### Customizing Keyboard Shortcuts

You can customize the keyboard shortcuts by:
1. Navigate to `chrome://extensions/shortcuts`
2. Find "Cool Copy" in the list
3. Click the pencil icon next to the command you want to customize
4. Press your desired keyboard shortcut

The default shortcuts are:
- **Copy clean URL**: `Cmd+Shift+C` (macOS) / `Ctrl+Shift+C` (Windows/Linux)
- **Copy markdown link**: `Cmd+Shift+X` (macOS) / `Ctrl+Shift+X` (Windows/Linux)
- **Copy element**: `Cmd+Shift+P` (macOS) / `Ctrl+Shift+P` (Windows/Linux)
- **Clip page**: `Cmd+Shift+S` (macOS) / `Ctrl+Shift+S` (Windows/Linux)

## AgentDB Setup

The page clipper feature requires AgentDB configuration to store clipped pages. Follow these steps to set up AgentDB:

### Prerequisites
- An AgentDB account with API credentials
- Your AgentDB base URL, API key, and token

### Configuration Steps

1. **Get your AgentDB credentials:**
   - Log in to your AgentDB account
   - Navigate to your API settings
   - Copy your base URL, API key, and token

2. **Configure the extension:**
   - Open Chrome DevTools (F12 or Cmd+Option+I on macOS)
   - Go to the "Console" tab
   - Run the following command to set your AgentDB configuration:

   ```javascript
   chrome.storage.sync.set({
     agentdbConfig: {
       baseUrl: "https://your-agentdb-base-url",
       apiKey: "your-api-key",
       token: "your-token",
       dbName: "webpages"
     }
   }, () => {
     console.log("AgentDB configuration saved!");
   });
   ```

3. **Verify configuration:**
   - Run this command to verify your configuration was saved:
   ```javascript
   chrome.storage.sync.get(['agentdbConfig'], (result) => {
     console.log("Current config:", result.agentdbConfig);
   });
   ```

### Example Configuration

```javascript
chrome.storage.sync.set({
  agentdbConfig: {
    baseUrl: "https://api.agentdb.example.com",
    apiKey: "your-api-key-here",
    token: "your-token-here",
    dbName: "webpages"
  }
});
```

### Troubleshooting

- **"AgentDB configuration not found" error**: Make sure you've run the configuration command above
- **Database connection errors**: Verify your base URL, API key, and token are correct
- **Pages not saving**: Check that your AgentDB account has the necessary permissions

## Example

**Original URL:**
```
https://example.com/article?utm_source=twitter&utm_medium=social&fbclid=abc123&ref=homepage
```

**Cleaned URL:**
```
https://example.com/article
```

## Technical Details

- **Manifest Version**: V3
- **Permissions**:
  - `clipboardWrite`: Write to clipboard
  - `tabs`: Access tab information
  - `activeTab`: Access active tab
  - `storage`: Store AgentDB configuration
- **Host Permissions**: `<all_urls>` - Required for page clipping on any website
- **Content Scripts**: Injected into all pages for URL processing, element picking, and page clipping
- **Background Service Worker**: Handles keyboard shortcut commands via Chrome's Commands API and page capture
- **Database Integration**: Uses AgentDB SDK for persistent storage of clipped pages
- **Architecture**:
  - Chrome's Commands API for configurable keyboard shortcuts
  - Background script communicates with content script via messaging
  - Full page capture with DOM and text content
  - Metadata extraction from page headers
  - AgentDB integration for persistent storage

## Files

### Core Files
- `manifest.json` - Extension configuration with commands and permissions
- `src/background.js` - Background service worker handling keyboard shortcuts and page capture
- `src/content/index.ts` - Content script entry point for message handling
- `src/content/url-cleaner.ts` - URL cleaning logic
- `src/content/markdown.ts` - Markdown link generation
- `src/content/element-picker.ts` - Element selection and capture
- `src/content/clipboard.ts` - Clipboard operations
- `src/content/toast.ts` - Toast notification display
- `src/services/database.ts` - AgentDB integration for page storage
- `src/styles.css` - Toast notification styling

### UI Files
- `popup.html` / `popup.js` / `popup.css` - Extension popup UI
- `clipped-pages.html` / `clipped-pages.js` / `clipped-pages.css` - Clipped pages viewer

### Assets
- `icons/` - Extension icons (16x16, 48x48, 128x128)
- `vendor/` - Third-party libraries (html2canvas, turndown)

## Privacy

This extension:
- Does NOT collect any personal data
- Does NOT send any information to external servers (except when you explicitly configure AgentDB)
- Only accesses the current page's URL and content when you trigger the shortcut
- All local processing happens in your browser
- Page clipping data is sent only to your configured AgentDB instance
- You have full control over your clipped pages and can delete them anytime

## License

MIT License - Feel free to use and modify as needed.
