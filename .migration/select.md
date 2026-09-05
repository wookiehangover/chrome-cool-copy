# select

2026-08-30, official Base Nova CLI dry-run/diff plus transformation engine; migrated model selection to Base UI.

## Changed

- `apps/chat/src/components/ui/select.tsx:1`: migrated Positioner/Popup/List, group label, item indicator, and full-width positioned scroll arrows; ItemText retains the official non-wrapping hook and classes.
- `apps/chat/src/components/ai-elements/model-picker.tsx:13`: adapted the model callback to Base UI nullable values without changing the catalog.

`grep -n "radix-ui\|@radix-ui"` returns no matches for these files.

## Left alone

Model catalog and visual classes were unchanged.

## Behavior changes

None.

## Verify by hand

Open the model picker; verify keyboard navigation, typeahead, selection, scrolling, and focus return.
