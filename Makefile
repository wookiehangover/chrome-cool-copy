# Chrome Cool Copy - Build System
# All build outputs go to apps/extension/dist (the loadable extension directory)

.PHONY: build clean lint format dev watch-extension watch-chat help extension chat

# Default target
all: build

#------------------------------------------------------------------------------
# Production Build
#------------------------------------------------------------------------------

# Full production build: extension + chat sidepanel
build: clean lint format extension chat
	@echo "Build complete: apps/extension/dist/"

# Build extension scripts and static assets
extension:
	@echo "Building extension..."
	pnpm -F @repo/extension build

# Build chat sidepanel (outputs to apps/extension/dist/sidepanel)
chat:
	@echo "Building chat sidepanel..."
	pnpm -F @repo/chat build

#------------------------------------------------------------------------------
# Development
#------------------------------------------------------------------------------

# Watch mode for extension scripts only
watch-extension:
	pnpm -F @repo/extension watch

# Watch mode for chat sidepanel only (fast rebuilds on save)
watch-chat:
	pnpm -F @repo/chat watch

# Full development setup:
# 1. Builds extension once
# 2. Starts watch mode for chat sidepanel
# After changes, reload extension in Chrome (Ctrl+R in chrome://extensions)
dev: extension
	@echo ""
	@echo "Extension built. Starting chat watch mode..."
	@echo "Load extension from: apps/extension/dist/"
	@echo ""
	@echo "Development workflow:"
	@echo "  1. Load/reload extension from apps/extension/dist/"
	@echo "  2. Edit chat code - Vite rebuilds automatically (~1-2s)"
	@echo "  3. Right-click extension icon > 'Reload' or close/reopen sidepanel"
	@echo ""
	pnpm -F @repo/chat watch

#------------------------------------------------------------------------------
# Code Quality
#------------------------------------------------------------------------------

lint:
	@echo "Linting..."
	pnpm -F @repo/extension lint

format:
	@echo "Formatting..."
	pnpm -F @repo/extension format

#------------------------------------------------------------------------------
# Utilities
#------------------------------------------------------------------------------

clean:
	@echo "Cleaning build artifacts..."
	rm -rf apps/extension/dist

# Show available targets
help:
	@echo "Chrome Cool Copy Build System"
	@echo ""
	@echo "Production:"
	@echo "  make build          - Full production build"
	@echo "  make extension      - Build extension scripts only"
	@echo "  make chat           - Build chat sidepanel only"
	@echo ""
	@echo "Development:"
	@echo "  make dev            - Build extension + watch chat (recommended)"
	@echo "  make watch-chat     - Watch chat sidepanel only"
	@echo "  make watch-extension - Watch extension scripts only"
	@echo ""
	@echo "Utilities:"
	@echo "  make lint           - Run linter"
	@echo "  make format         - Format code"
	@echo "  make clean          - Remove build artifacts"
	@echo ""
	@echo "Output directory: apps/extension/dist/"
	@echo ""
	@echo "Dev workflow:"
	@echo "  1. make dev           - Builds extension, starts chat watch mode"
	@echo "  2. Load extension from apps/extension/dist/ in Chrome"
	@echo "  3. Edit chat code     - Vite rebuilds in ~1-2 seconds"
	@echo "  4. Reload sidepanel   - Close and reopen, or reload extension"
