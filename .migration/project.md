# Project

2026-08-30, whole-project Base UI migration using official shadcn info/docs/dry-run/diff plus the official migration helper.

## Changed

Both `components.json` files now use `base-nova`; chat/shared wrappers and every chat/clips consumer use Base UI composition; manifests and lockfile use `@base-ui/react` and remove scoped Radix dependencies from the migrated packages. Frozen install, lint, format check, typechecks, tests, builds, and diff checks pass. Leftover scan reports 0 Radix wrappers in `apps/chat`, `apps/clips`, and `packages/ui`.

## Left alone

`apps/share` deliberately retains its independent `radix-ui` component system because it has no shadcn configuration and is outside this task. `cmdk` is intentionally unchanged per the migration helper.

## Behavior changes

Base UI checkbox/radio menu items default to remaining open; no current migrated consumer uses those exports.

## Verify by hand

Exercise model selection, reasoning/code collapsibles, attachment previews/tooltips, boost/viewer menus, and all confirmation dialogs with pointer and keyboard.
