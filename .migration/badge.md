# badge

2026-08-30, official Base Nova CLI diff plus transformation engine; migrated polymorphism to Base UI render utilities.

## Changed

`packages/ui/src/components/badge.tsx`: replaced Radix Slot/asChild with useRender/mergeProps. Leftover scan is clean.

## Left alone

Unrelated badge consumers and styling were unchanged.

## Behavior changes

None.

## Verify by hand

Confirm badges render correctly as spans and custom rendered elements.
