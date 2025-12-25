# Chrome Cool Copy - Build System
# All build outputs go to apps/extension/dist (the loadable extension directory)

.PHONY: build clean lint format dev dev-chat dev-reset watch help extension chat

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

# Watch mode for extension only
watch:
	pnpm -F @repo/extension watch

# Full development setup with HMR for sidepanel
# 1. Builds extension
# 2. Sets up dev manifest pointing to Vite dev server
# 3. Starts Vite dev server with HMR
dev: extension
	@echo "Setting up dev mode..."
	node scripts/setup-dev.js
	@echo ""
	@echo "Starting chat dev server with HMR..."
	pnpm -F @repo/chat dev

# Start chat dev server only (assumes dev mode already set up)
dev-chat:
	pnpm -F @repo/chat dev

# Switch back to production mode after dev session
dev-reset:
	node scripts/setup-dev.js --prod
	@echo "Rebuild for production with: make build"

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
	@echo "  make build       - Full production build"
	@echo "  make extension   - Build extension only"
	@echo "  make chat        - Build chat sidepanel only"
	@echo ""
	@echo "Development:"
	@echo "  make dev         - Full dev setup with HMR for sidepanel"
	@echo "  make dev-chat    - Start chat dev server only"
	@echo "  make dev-reset   - Switch back to production mode"
	@echo "  make watch       - Watch mode for extension scripts"
	@echo ""
	@echo "Utilities:"
	@echo "  make lint        - Run linter"
	@echo "  make format      - Format code"
	@echo "  make clean       - Remove build artifacts"
	@echo ""
	@echo "Output directory: apps/extension/dist/"
	@echo ""
	@echo "Dev workflow:"
	@echo "  1. make dev      - Builds extension and starts HMR server"
	@echo "  2. Load extension from apps/extension/dist/"
	@echo "  3. Open sidepanel - it loads from localhost with HMR"
	@echo "  4. Edit code - changes reflect immediately"
	@echo "  5. make dev-reset - Reset to production before final build"
