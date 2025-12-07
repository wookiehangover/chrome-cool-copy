# Cool Copy - Chrome Extension

A Chrome extension that adds cool copy features to Chrome, including:
- copying clean URLs without tracking parameters using a simple keyboard shortcut
- copying markdown formatted links using a simple keyboard shortcut
- copying any element on the page to the clipboard using a simple keyboard shortcut

## Features

- **Copy link to clipboard**: `Cmd+Shift+C` (macOS) / `Ctrl+Shift+C` (Windows/Linux) - Configurable via `chrome://extensions/shortcuts`
- **Copy markdown link to clipboard**: `Cmd+Shift+X` (macOS) / `Ctrl+Shift+X` (Windows/Linux) - Configurable via `chrome://extensions/shortcuts`
- **Copy element to clipboard**: `Cmd+Shift+P` (macOS) / `Ctrl+Shift+P` (Windows/Linux) - Configurable via `chrome://extensions/shortcuts`
- **Automatic URL Cleaning**: Removes common tracking parameters including:
  - UTM parameters (`utm_source`, `utm_medium`, `utm_campaign`, etc.)
  - Facebook tracking (`fbclid`, `fb_action_ids`, etc.)
  - Google tracking (`gclid`, `gclsrc`, `dclid`, etc.)
  - Other common trackers (`ref`, `source`, `msclkid`, etc.)
- **Toast Notification**: Displays "Link Copied" confirmation message
- **Works Everywhere**: Functions on any webpage

## Installation

### Install from Source

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked"
5. Select the extension directory

## Usage

1. Navigate to any webpage
2. Press the keyboard shortcut (default: `Cmd+Shift+C` on macOS or `Ctrl+Shift+C` on Windows/Linux)
3. The clean URL is copied to your clipboard
4. A toast notification confirms the action

### Customizing Keyboard Shortcuts

You can customize the keyboard shortcuts by:
1. Navigate to `chrome://extensions/shortcuts`
2. Find "Clean Link Copy" in the list
3. Click the pencil icon next to the command you want to customize
4. Press your desired keyboard shortcut

The default shortcuts are:
- **Copy clean URL**: `Cmd+Shift+C` (macOS) / `Ctrl+Shift+C` (Windows/Linux)
- **Copy markdown link**: `Cmd+Shift+X` (macOS) / `Ctrl+Shift+X` (Windows/Linux)

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
- **Content Scripts**: Injected into all pages for URL processing and toast display
- **Background Service Worker**: Handles keyboard shortcut commands via Chrome's Commands API
- **Architecture**: Uses Chrome's Commands API for configurable keyboard shortcuts, with background script communicating to content script via messaging

## Files

- `manifest.json` - Extension configuration with commands definitions
- `background.js` - Background service worker that handles keyboard shortcut commands
- `content.js` - URL cleaning logic, clipboard operations, and message listener
- `toast.css` - Toast notification styling
- `icons/` - Extension icons
- `test.html` - Test page with sample URLs

## Privacy

This extension:
- Does NOT collect any data
- Does NOT send any information to external servers
- Only accesses the current page's URL when you trigger the shortcut
- All processing happens locally in your browser

## License

MIT License - Feel free to use and modify as needed.

