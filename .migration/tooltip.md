# tooltip

2026-08-30, official Base Nova CLI diff plus transformation engine; migrated tooltips to Base UI.

## Changed

`apps/chat/src/components/ui/tooltip.tsx`: added Portal/Positioner/Popup, render triggers, and Base arrow positioning. Provider delay remains zero. Leftover scan is clean.

## Left alone

Tooltip text and button styling were unchanged.

## Behavior changes

None; zero-delay behavior is preserved.

## Verify by hand

Hover and keyboard-focus message actions and attachments; verify immediate display, placement, Escape dismissal, and accessible names.
