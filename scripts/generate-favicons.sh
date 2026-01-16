#!/bin/bash

# Generate favicons for apps/share from the extension icon
# Usage: ./scripts/generate-favicons.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

SOURCE_ICON="$PROJECT_ROOT/apps/extension/icons/icon.png"
OUTPUT_DIR="$PROJECT_ROOT/apps/share/public"

# Check if source icon exists
if [ ! -f "$SOURCE_ICON" ]; then
    echo "Error: Source icon not found at $SOURCE_ICON"
    exit 1
fi

# Check if ImageMagick is installed
if ! command -v magick &> /dev/null; then
    echo "Error: ImageMagick is required but not installed."
    echo "Install with: brew install imagemagick"
    exit 1
fi

echo "Generating favicons from $SOURCE_ICON"
echo "Output directory: $OUTPUT_DIR"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Generate PNG favicons at various sizes
echo "Generating PNG favicons..."
magick "$SOURCE_ICON" -resize 16x16 "$OUTPUT_DIR/favicon-16x16.png"
magick "$SOURCE_ICON" -resize 32x32 "$OUTPUT_DIR/favicon-32x32.png"
magick "$SOURCE_ICON" -resize 48x48 "$OUTPUT_DIR/favicon-48x48.png"

# Apple Touch Icon (180x180)
echo "Generating Apple Touch Icon..."
magick "$SOURCE_ICON" -resize 180x180 "$OUTPUT_DIR/apple-touch-icon.png"

# Android Chrome icons
echo "Generating Android Chrome icons..."
magick "$SOURCE_ICON" -resize 192x192 "$OUTPUT_DIR/android-chrome-192x192.png"
magick "$SOURCE_ICON" -resize 512x512 "$OUTPUT_DIR/android-chrome-512x512.png"

# Main favicon.png (32x32 is standard)
echo "Generating main favicon.png..."
magick "$SOURCE_ICON" -resize 32x32 "$OUTPUT_DIR/favicon.png"

# Generate favicon.ico (multi-resolution ICO file)
echo "Generating favicon.ico..."
magick "$SOURCE_ICON" \
    \( -clone 0 -resize 16x16 \) \
    \( -clone 0 -resize 32x32 \) \
    \( -clone 0 -resize 48x48 \) \
    -delete 0 \
    "$OUTPUT_DIR/favicon.ico"

# Generate site.webmanifest for PWA support
echo "Generating site.webmanifest..."
cat > "$OUTPUT_DIR/site.webmanifest" << 'EOF'
{
  "name": "Clips",
  "short_name": "Clips",
  "icons": [
    {
      "src": "/android-chrome-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/android-chrome-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ],
  "theme_color": "#ffffff",
  "background_color": "#ffffff",
  "display": "standalone"
}
EOF

echo ""
echo "✓ Favicon generation complete!"
echo ""
echo "Generated files:"
ls -la "$OUTPUT_DIR"/*.png "$OUTPUT_DIR"/*.ico "$OUTPUT_DIR"/*.webmanifest 2>/dev/null

echo ""
echo "Add these tags to your HTML <head>:"
echo '  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">'
echo '  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">'
echo '  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">'
echo '  <link rel="manifest" href="/site.webmanifest">'
