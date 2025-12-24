.PHONY: build clean lint format

build: clean chat extension

chat:
	pnpm build:chat

extension: lint format
	pnpm build:extension
	mkdir -p dist
	cp -r apps/extension/dist/* dist/

lint:
	pnpm -F @repo/extension run lint

format:
	pnpm -F @repo/extension run format

clean:
	rm -rf dist apps/extension/dist
