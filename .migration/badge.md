# badge

2026-08-30, official Base Nova CLI diff plus transformation engine; migrated polymorphism to Base UI render utilities.

## Changed

- `packages/ui/src/components/badge.tsx:2`: replaced Radix Slot/asChild with Base UI useRender/mergeProps while preserving variants.

`grep -n "radix-ui\|@radix-ui"` returns no matches for this file.

## Left alone

Unrelated badge consumers and styling were unchanged.

## Behavior changes

None.

## Verify by hand

Confirm badges render correctly as spans and custom rendered elements.
