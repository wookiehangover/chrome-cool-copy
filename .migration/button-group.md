# button-group

2026-08-30, official Base Nova CLI diff plus transformation engine; migrated ButtonGroup polymorphism to Base UI.

## Changed

- `apps/chat/src/components/ui/button-group.tsx:1`: replaced Radix Slot/asChild with Base UI useRender/mergeProps and converted its Separator orientation hook.

`grep -n "radix-ui\|@radix-ui"` returns no matches for this file.

## Left alone

Existing ButtonGroup layout and variants were preserved.

## Behavior changes

None.

## Verify by hand

Render horizontal and vertical button groups; confirm grouping, focus rings, separators, and custom rendered text elements.
