# button

2026-08-30, official Base Nova CLI diff plus transformation engine; migrated to Base UI while retaining existing variants and classes.

## Changed

- `packages/ui/src/components/button.tsx:1`: replaced Radix Slot/asChild with the real Base UI Button/render primitive while preserving variants.

`grep -n "radix-ui\|@radix-ui"` returns no matches for this file.

## Left alone

`apps/share/app/components/ui/button.tsx`: separate out-of-scope share-app Radix system.

## Behavior changes

None.

## Verify by hand

Activate buttons by mouse and keyboard; confirm disabled and focus-visible states.
