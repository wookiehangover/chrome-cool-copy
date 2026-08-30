# Repository guide

## Architecture

This is a pnpm monorepo. `apps/extension` is the Chrome extension and owns browser integration, background/content scripts, and extension pages. `apps/chat` and `apps/clips` are Vite React surfaces embedded by the extension. `apps/share` is the React Router sharing app, and `apps/safari` packages the built extension on macOS. Reusable domain types and utilities live in `packages/shared`; reusable React primitives live in `packages/ui`. Keep browser-specific behavior in the extension and shared code platform-neutral.

## Workflow

- Use the Corepack-provided pnpm version declared in the root `package.json`; do not use npm or Yarn. Run `corepack pnpm install --frozen-lockfile` after checkout and whenever the lockfile changes.
- Run a package command with `corepack pnpm --filter <package> <script>`. Use the root scripts for repository checks: `corepack pnpm lint`, `corepack pnpm format:check`, `corepack pnpm typecheck`, `corepack pnpm test`, and `corepack pnpm build`.
- `corepack pnpm format` writes formatting changes. Oxlint and oxfmt are the only lint and formatting tools; do not add ESLint or Prettier configuration, dependencies, or directives.

## Models and UI components

- The canonical model catalog, default, and legacy migration live under `packages/shared/src/constants`. Consume those exports rather than copying identifiers into apps. When changing models, update catalog and migration tests and keep persisted legacy selections valid.
- Both shadcn projects are configured by `apps/chat/components.json` and `apps/clips/components.json`; shared generated primitives live in `packages/ui/src/components`. Run `corepack pnpm dlx shadcn@latest` from the configured app. For updates, inspect `add <component> --dry-run`, then `add <component> --diff <file>` and merge upstream changes while preserving repository customizations. Never use `--overwrite` without explicit approval. Check the project `base`, aliases, and icon library before adapting generated code.

## Verification and contribution safety

Keep changes scoped and avoid generated output (`dist`, `build`, `.react-router`) unless a task explicitly requires it. Do not discard unrelated working-tree changes or rewrite history. Add tests beside changed behavior, use package-level checks while iterating, then run the full root lint, format check, typecheck, test, and production build suite before handoff. Lint warnings are existing debt unless the task safely addresses them; new errors are not acceptable. Finish with `git diff --check` and review the complete diff for secrets, credentials, and unintended generated files.
