#!/bin/bash

# Cleanup script for removing leftover files after migration to new structure
# This script removes old root-level JS/HTML/CSS files that have been moved to src/pages/

set -e

echo "🧹 Cleaning up leftover files from migration..."
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Files that were moved from root to src/pages/
OLD_FILES=(
  "popup.js"
  "popup.html"
  "popup.css"
  "clipped-pages.js"
  "clipped-pages.html"
  "clipped-pages.css"
  "settings.js"
  "settings.html"
  "settings.css"
  "src/turndown.js"
)

# Check if we're in a git repository (handles both regular repos and worktrees)
if [ ! -d ".git" ] && [ ! -f ".git" ]; then
  echo -e "${RED}Error: Not in a git repository${NC}"
  exit 1
fi

echo "The following files will be removed from git:"
echo ""
for file in "${OLD_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo -e "  ${YELLOW}✗${NC} $file (exists - will be deleted)"
  elif git ls-files --error-unmatch "$file" &>/dev/null; then
    echo -e "  ${YELLOW}✗${NC} $file (tracked by git - will be removed)"
  else
    echo -e "  ${GREEN}✓${NC} $file (already removed)"
  fi
done

echo ""
read -p "Continue with cleanup? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cleanup cancelled."
  exit 0
fi

echo ""
echo "Removing old files..."

# Remove files from git and filesystem
for file in "${OLD_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo -e "  Deleting: $file"
    rm "$file"
    git rm "$file" 2>/dev/null || true
  elif git ls-files --error-unmatch "$file" &>/dev/null; then
    echo -e "  Removing from git: $file"
    git rm "$file" 2>/dev/null || true
  fi
done

echo ""
echo -e "${GREEN}✓ Cleanup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Review changes: git status"
echo "  2. Add new files: git add src/pages/ vendor/turndown.js"
echo "  3. Commit changes: git commit -m 'Refactor: migrate to new src/pages structure'"
echo ""

