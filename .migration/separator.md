# separator

2026-08-30, official Base Nova CLI diff plus transformation engine; migrated separators to Base UI.

## Changed

- `apps/chat/src/components/ui/separator.tsx:1`: replaced Radix Separator with the callable Base UI primitive and orientation hooks.
- `apps/chat/src/components/ui/button-group.tsx:66`: converted its vertical Separator selector to the Base UI data hook.

`grep -n "radix-ui\|@radix-ui"` returns no matches for these files.

## Left alone

Button-group layout styling was preserved.

## Behavior changes

None.

## Verify by hand

Confirm horizontal and vertical separators retain their expected dimensions.
