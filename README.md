# Cool Copy - Chrome Extension

There are many like it, but this one is mine.

## Features

### Cool Command Palette
- **Open Command Palette**: `Cmd+Shift+P` (macOS) / `Ctrl+Shift+P` (Windows/Linux)
- Searchable overlay with fuzzy search for quick command access
- Keyboard navigation (arrow keys, Enter to execute, Escape to close)
- Displays keyboard shortcuts next to commands
- Works on all pages
- Clean, minimal design

### Cool Copy
- **Copy clean URL**: `Cmd+Shift+C` (macOS) / `Ctrl+Shift+C` (Windows/Linux)
  - Copies the current URL without tracking parameters
- **Copy markdown link**: `Cmd+Shift+X` (macOS) / `Ctrl+Shift+X` (Windows/Linux)
  - Copies a markdown formatted link to the current page
- **Copy element**: Access via Command Palette
  - Select any element on the page to copy to clipboard

### Cool Reader Mode
- **Toggle Reader Mode**: Access via Command Palette
- Distraction-free reading experience
- Automatically extracts main article content
- Filters out navigation, ads, sidebars, and other non-essential elements
- Clean, centered typography optimized for readability
- Dark mode support (follows system preferences)
- Shadow DOM isolation for consistent styling
- ESC key or close button to exit

### Cool Dark Mode
- **Dark Mode: Toggle**: Toggle dark mode on/off for the current domain
- **Dark Mode: Follow System**: Automatically follow system dark mode preference
- **Dark Mode: Adjust**: Fine-tune dark mode settings including:
  - Brightness adjustment
  - Contrast adjustment
  - Sepia filter
  - Grayscale filter
- Per-domain settings are saved and automatically applied on revisit

### Cool Page Clipper
- **Clip page**: Access via Command Palette - Saves the entire page to AgentDB
- **View clipped pages**: Open the clipped pages viewer in a new tab
- **Open side panel**: View clipped pages in a side panel
- Features:
  - Persistent storage in AgentDB
  - Full content capture (DOM and text content)
  - Metadata extraction (title, description, keywords, Open Graph data)
  - Search and filter clipped pages
  - View full content of any clipped page
  - Delete pages with confirmation

### Cool AI Chat
- **Open Chat**: `Cmd+Shift+A` (macOS) / `Ctrl+Shift+A` (Windows/Linux)
- Opens an AI-powered chat assistant in the side panel
- Interact with AI while browsing any webpage

### Cool Grokipedia Integration
- **Toggle Grokipedia Banner**: Enable/disable Grokipedia banner on Wikipedia pages
- Automatically detects Wikipedia article pages
- Shows a banner linking to the corresponding Grokipedia page when available

### Settings
- **Settings**: Access via Command Palette to configure extension options

## Installation

### Install from Source

1. Clone or download this repository
2. Install dependencies: `pnpm install`
3. Build the extension: `pnpm run build` (creates `apps/extension/dist/` folder)
4. Open Chrome and navigate to `chrome://extensions/`
5. Enable "Developer mode" (toggle in the top-right corner)
6. Click "Load unpacked"
7. Select the `apps/extension/dist/` folder (not the root directory)
8. (Optional) Configure AgentDB for page clipping feature (see [AgentDB Setup](#agentdb-setup) below)

