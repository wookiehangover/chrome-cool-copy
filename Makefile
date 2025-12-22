.PHONY: build clean lint format

build: lint format
	npm run build

lint:
	npm run lint

format:
	npm run format

clean:
	rm -rf dist

