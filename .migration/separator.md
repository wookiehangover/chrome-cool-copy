# separator

2026-08-30, official Base Nova CLI diff plus transformation engine; migrated separators to Base UI.

## Changed

`apps/chat/src/components/ui/separator.tsx`: uses callable Base UI Separator and orientation data hooks. Leftover scan is clean.

## Left alone

Button-group layout styling was preserved.

## Behavior changes

None.

## Verify by hand

Confirm horizontal and vertical separators retain their expected dimensions.
