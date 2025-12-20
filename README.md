# Cool Copy - Chrome Extension

A Chrome extension that adds cool copy features to Chrome, including:
- copying clean URLs without tracking parameters
- copying markdown formatted links
- copying any element on the page to the clipboard
- **clipping entire web pages to AgentDB for persistent storage and later retrieval**

All features are accessible through a unified **Command Palette** (`Cmd+Shift+P` / `Ctrl+Shift+P`) with fuzzy search, or via preserved keyboard shortcuts for frequently used actions.

## Features

### Command Palette
- **Open Command Palette**: `Cmd+Shift+P` (macOS) / `Ctrl+Shift+P` (Windows/Linux)
- Searchable overlay with fuzzy search for quick command access
- Keyboard navigation (arrow keys, Enter to execute, Escape to close)
- Displays keyboard shortcuts next to commands
- Works on all pages
- Clean, minimal design inspired by Dieter Rams principles

### Copy Features
- **Copy clean URL**: `Cmd+Shift+C` (macOS) / `Ctrl+Shift+C` (Windows/Linux) - Direct shortcut or via Command Palette
- **Copy markdown link**: `Cmd+Shift+X` (macOS) / `Ctrl+Shift+X` (Windows/Linux) - Direct shortcut or via Command Palette
- **Copy element**: Access via Command Palette - Select any element on the page to copy to clipboard

### Page Clipper
- **Clip current page**: Access via Command Palette - Saves the entire page to AgentDB
- **Persistent storage**: Pages are saved to AgentDB for later retrieval
- **Full content capture**: Captures both DOM content and text content
- **Metadata extraction**: Automatically extracts page title, description, keywords, and Open Graph data
- **Clipped pages viewer**: Access all clipped pages via the extension popup or Command Palette
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
2. Install dependencies: `npm install` or `pnpm install`
3. Build the extension: `npm run build` (creates `dist/` folder)
4. Open Chrome and navigate to `chrome://extensions/`
5. Enable "Developer mode" (toggle in the top-right corner)
6. Click "Load unpacked"
7. Select the `dist/` folder (not the root directory)
8. (Optional) Configure AgentDB for page clipping feature (see [AgentDB Setup](#agentdb-setup) below)

### Development

To watch for changes and rebuild automatically:
```bash
npm run watch
```

Then reload the extension in Chrome after each build.

### Migration Cleanup

If you're migrating from an older version of the codebase, you can clean up leftover files:
```bash
npm run cleanup
```

This script removes old root-level JS/HTML/CSS files that have been moved to the new `src/pages/` structure.

## Upgrading from Previous Versions

### Version 1.0 - Command Palette Refactor

If you're upgrading from a version before the Command Palette feature, here are the key changes:

**What's New:**
- **Command Palette** (`Cmd+Shift+P` / `Ctrl+Shift+P`) - Unified interface for all extension features
- Fuzzy search for quick command access
- All commands accessible in one place

**What Changed:**
- `Cmd+Shift+P` now opens the Command Palette instead of directly copying an element
- `Cmd+Shift+S` (Clip page) is now accessed through the Command Palette
- The preserved shortcuts (`Cmd+Shift+C` and `Cmd+Shift+X`) still work as before

**Migration Steps:**
1. Update the extension to the latest version
2. Reload the extension in Chrome (`chrome://extensions/`)
3. Start using the Command Palette with `Cmd+Shift+P` / `Ctrl+Shift+P`
4. Your existing keyboard shortcuts for "Copy clean URL" and "Copy markdown link" continue to work

**No Action Required:**
- Your AgentDB configuration is preserved
- Your clipped pages are not affected
- All existing functionality remains available

## Usage

### Using the Command Palette

The Command Palette is the primary interface for accessing all extension features:

1. Navigate to any webpage
2. Press `Cmd+Shift+P` (macOS) / `Ctrl+Shift+P` (Windows/Linux) to open the Command Palette
3. Type to search for a command (e.g., "copy clean", "clip", "settings")
4. Use arrow keys to navigate, or click with your mouse
5. Press Enter or click to execute the selected command
6. Press Escape to close the palette

**Available Commands:**
- **Copy clean URL** - Copy the current URL without tracking parameters
- **Copy markdown link** - Copy a markdown formatted link to the current page
- **Copy element** - Select any element on the page to copy to clipboard
- **Clip page** - Save the entire page to AgentDB
- **View clipped pages** - Open the clipped pages viewer
- **Settings** - Open extension settings

### Quick Keyboard Shortcuts

For frequently used actions, you can use direct keyboard shortcuts:

1. Navigate to any webpage
2. Press the keyboard shortcut for the desired action:
   - **Copy clean URL**: `Cmd+Shift+C` (macOS) / `Ctrl+Shift+C` (Windows/Linux)
   - **Copy markdown link**: `Cmd+Shift+X` (macOS) / `Ctrl+Shift+X` (Windows/Linux)
3. A toast notification confirms the action
4. The content is copied to your clipboard

### Viewing Clipped Pages

1. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Search for "View clipped pages" and press Enter
3. The clipped pages viewer will open in a new tab
4. In the clipped pages viewer:
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
- **Open Command Palette**: `Cmd+Shift+P` (macOS) / `Ctrl+Shift+P` (Windows/Linux)
- **Copy clean URL**: `Cmd+Shift+C` (macOS) / `Ctrl+Shift+C` (Windows/Linux)
- **Copy markdown link**: `Cmd+Shift+X` (macOS) / `Ctrl+Shift+X` (Windows/Linux)

**Note:** The "Copy element" and "Clip page" commands are now accessed through the Command Palette instead of direct keyboard shortcuts, making the extension more extensible and reducing keyboard shortcut conflicts.

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

### Source Structure (`src/`)

#### Core Files
- `src/background.ts` - Background service worker handling keyboard shortcuts and page capture
- `src/content/index.ts` - Content script entry point for message handling
- `src/content/command-palette.ts` - Command palette UI component and logic
- `src/content/command-palette.css` - Command palette styling
- `src/content/commands.ts` - Command registry and definitions
- `src/content/url-cleaner.ts` - URL cleaning logic
- `src/content/markdown.ts` - Markdown link generation
- `src/content/element-picker.ts` - Element selection and capture
- `src/content/clipboard.ts` - Clipboard operations
- `src/content/toast.ts` - Toast notification display
- `src/services/database.ts` - AgentDB integration for page storage
- `src/styles.css` - Toast notification styling

#### UI Pages
- `src/pages/popup/` - Extension popup UI
  - `popup.ts` - Popup script
  - `popup.html` - Popup markup
  - `popup.css` - Popup styles
- `src/pages/clipped-pages/` - Clipped pages viewer
  - `clipped-pages.ts` - Clipped pages script
  - `clipped-pages.html` - Clipped pages markup
  - `clipped-pages.css` - Clipped pages styles
- `src/pages/settings/` - Settings page
  - `settings.ts` - Settings script
  - `settings.html` - Settings markup
  - `settings.css` - Settings styles

### Build Output (`dist/`)
The `dist/` folder is generated by the build process and contains the complete, self-contained extension ready to load into Chrome. It includes:
- Compiled JavaScript files from TypeScript sources
- HTML and CSS files copied from `src/pages/`
- Manifest configuration
- Icons and vendor libraries

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
