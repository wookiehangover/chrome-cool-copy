# hover-card

2026-08-30, official Base Nova CLI diff plus transformation engine; migrated hover cards to Base UI Preview Card.

## Changed

`apps/chat/src/components/ui/hover-card.tsx`: added Portal/Positioner/Popup composition. Attachment consumers use render and trigger-level delays. Leftover scan is clean.

## Left alone

Attachment preview content and styling were unchanged.

## Behavior changes

None; the custom zero-delay open/close behavior is preserved on the trigger.

## Verify by hand

Hover and keyboard-focus attachments; verify instant preview, positioning, dismissal, and focus behavior.
