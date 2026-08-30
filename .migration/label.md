# label

2026-08-30, official Base Nova CLI diff plus transformation engine; replaced Radix Label with native label.

## Changed

`apps/chat/src/components/ui/label.tsx`: now renders a native label with the existing classes. Leftover scan is clean.

## Left alone

Form layout and field consumers were unchanged.

## Behavior changes

None.

## Verify by hand

Click labels and confirm their associated controls receive focus.
