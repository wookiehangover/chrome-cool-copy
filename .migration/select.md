# select

2026-08-30, official Base Nova CLI dry-run/diff plus transformation engine; migrated model selection to Base UI.

## Changed

`apps/chat/src/components/ui/select.tsx`: migrated Positioner/Popup/List, group label, item indicator, and scroll arrows. Model callbacks handle Base UI nullable values. Leftover scan is clean.

## Left alone

Model catalog and visual classes were unchanged.

## Behavior changes

None.

## Verify by hand

Open the model picker; verify keyboard navigation, typeahead, selection, scrolling, and focus return.
