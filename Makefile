# Chrome Cool Copy - Build System
# All build outputs go to apps/extension/dist (the loadable extension directory)

.PHONY: build clean lint format dev watch-extension watch-chat help extension chat typecheck

# Default target
all: build

#------------------------------------------------------------------------------
# Spinner Helper
#------------------------------------------------------------------------------

# Usage: $(call spinner,Task Name,command to run)
# Shows an animated spinner while the command runs, hides output unless there's an error
define spinner
	@tmpfile=$$(mktemp); \
	$(2) > "$$tmpfile" 2>&1 & pid=$$!; \
	frames='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'; \
	while kill -0 $$pid 2>/dev/null; do \
		for i in $$(seq 0 9); do \
			printf "\r  $${frames:$$i:1} $(1)"; \
			sleep 0.1; \
		done; \
	done; \
	wait $$pid; status=$$?; \
	if [ $$status -eq 0 ]; then \
		printf "\r  \033[32m✓\033[0m $(1)\n"; \
	else \
		printf "\r  \033[31m✗\033[0m $(1)\n"; \
		cat "$$tmpfile"; \
		rm -f "$$tmpfile"; \
		exit $$status; \
	fi; \
	rm -f "$$tmpfile"
endef

#------------------------------------------------------------------------------
# Production Build
#------------------------------------------------------------------------------

# Full production build: extension + chat sidepanel
build: clean lint typecheck format extension chat
	@echo ""
	@echo "\033[32m✓\033[0m Build complete: apps/extension/dist/"

# Build extension scripts and static assets
extension:
	$(call spinner,Building extension...,pnpm -F @repo/extension build)

# Build chat sidepanel (outputs to apps/extension/dist/sidepanel)
chat:
	$(call spinner,Building chat sidepanel...,pnpm -F @repo/chat build)

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
	$(call spinner,Linting...,pnpm -F @repo/extension lint)

format:
	$(call spinner,Formatting...,pnpm -F @repo/extension format)

typecheck:
	$(call spinner,Typechecking...,pnpm -F @repo/extension typecheck)

#------------------------------------------------------------------------------
# Utilities
#------------------------------------------------------------------------------

clean:
	$(call spinner,Cleaning build artifacts...,rm -rf apps/extension/dist)

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
