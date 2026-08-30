# dropdown-menu

2026-08-30, official Base Nova CLI diff plus transformation engine; migrated shared menus to Base UI.

## Changed

`packages/ui/src/components/dropdown-menu.tsx`: Menu positioning, popup, indicator, label, and submenu parts now use Base UI. Chat/clips triggers use render. Leftover scan is clean.

## Left alone

No checkbox/radio menu consumers currently require close-on-click compatibility.

## Behavior changes

Base UI checkbox/radio items default to remaining open; no current consumer exercises them.

## Verify by hand

Open boost and viewer menus; verify keyboard navigation, typeahead, item activation, dismissal, and focus return.
