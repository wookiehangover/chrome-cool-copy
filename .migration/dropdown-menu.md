# dropdown-menu

2026-08-30, official Base Nova CLI diff plus transformation engine; migrated shared menus to Base UI.

## Changed

- `packages/ui/src/components/dropdown-menu.tsx:3`: migrated positioning, popup, indicator, label, and submenu parts to Base UI Menu.
- `apps/chat/src/components/BoostCard.tsx:61`: converted the boost overflow trigger from `asChild` to Base UI `render`.
- `apps/chat/src/components/ai-elements/prompt-input.tsx:917`: converted the prompt action-menu trigger from `asChild` to Base UI `render`.
- `apps/clips/src/components/ViewerToolbar.tsx:296`: converted the viewer overflow trigger from `asChild` to Base UI `render`.

`grep -n "radix-ui\|@radix-ui"` returns no matches for these files.

## Left alone

No checkbox/radio menu consumers currently require close-on-click compatibility.

## Behavior changes

Base UI checkbox/radio items default to remaining open; no current consumer exercises them.

## Verify by hand

Open boost and viewer menus; verify keyboard navigation, typeahead, item activation, dismissal, and focus return.
