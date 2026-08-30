# button

2026-08-30, official Base Nova CLI diff plus transformation engine; migrated to Base UI while retaining existing variants and classes.

## Changed

`packages/ui/src/components/button.tsx`: replaced Radix Slot/asChild with Base UI Button/render. Leftover scan is clean.

## Left alone

`apps/share/app/components/ui/button.tsx`: separate out-of-scope share-app Radix system.

## Behavior changes

None.

## Verify by hand

Activate buttons by mouse and keyboard; confirm disabled and focus-visible states.
