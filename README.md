# Clean Link Copy - Chrome Extension

A Chrome extension that copies clean URLs without tracking parameters using a simple keyboard shortcut.

## Features

- **Copy link to clipboard**: `Cmd+Shift+C` (macOS) / `Ctrl+Shift+C` (Windows/Linux)
- **Copy markdown link to clipboard**: `Cmd+Shift+X` (macOS) / `Ctrl+Shift+X` (Windows/Linux)
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
2. Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
3. The clean URL is copied to your clipboard
4. A toast notification confirms the action

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
- **Content Scripts**: Injected into all pages for keyboard shortcut handling, URL processing, and toast display
- **Architecture**: Uses content script with keyboard event listener (no background script needed)

## Files

- `manifest.json` - Extension configuration
- `content.js` - Keyboard shortcut handler, URL cleaning logic, and clipboard operations
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

