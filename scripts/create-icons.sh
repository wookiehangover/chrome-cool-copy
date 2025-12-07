#!/bin/bash

# Script to create PNG icons from SVG
# Requires ImageMagick or similar tool

# Check if convert command is available (ImageMagick)
if command -v convert &> /dev/null; then
    echo "Creating icons using ImageMagick..."
    convert -background none icons/icon.svg -resize 16x16 icons/icon16.png
    convert -background none icons/icon.svg -resize 48x48 icons/icon48.png
    convert -background none icons/icon.svg -resize 128x128 icons/icon128.png
    echo "Icons created successfully!"
elif command -v sips &> /dev/null; then
    # macOS built-in tool
    echo "Creating icons using sips..."
    # First convert SVG to PNG at high resolution, then resize
    # Note: sips doesn't handle SVG well, so this is a fallback
    echo "Please install ImageMagick for better icon generation:"
    echo "  brew install imagemagick"
else
    echo "No suitable image conversion tool found."
    echo "Please install ImageMagick:"
    echo "  macOS: brew install imagemagick"
    echo "  Ubuntu/Debian: sudo apt-get install imagemagick"
    echo "  Windows: Download from https://imagemagick.org/script/download.php"
    echo ""
    echo "Or manually create PNG icons at sizes 16x16, 48x48, and 128x128"
    echo "from the icons/icon.svg file using any image editor."
fi

