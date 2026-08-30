# label

2026-08-30, official Base Nova CLI diff plus transformation engine; replaced Radix Label with native label.

## Changed

- `apps/chat/src/components/ui/label.tsx:5`: replaced Radix Label with a native label while preserving existing classes and association props.

`grep -n "radix-ui\|@radix-ui"` returns no matches for this file.

## Left alone

Form layout and field consumers were unchanged.

## Behavior changes

None.

## Verify by hand

Click labels and confirm their associated controls receive focus.
