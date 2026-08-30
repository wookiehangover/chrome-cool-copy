# hover-card

2026-08-30, official Base Nova CLI diff plus transformation engine; migrated hover cards to Base UI Preview Card.

## Changed

- `apps/chat/src/components/ui/hover-card.tsx:1`: replaced Radix HoverCard with Base UI PreviewCard and added Portal/Positioner/Popup composition.
- `apps/chat/src/components/ai-elements/prompt-input.tsx:281`: converted the attachment trigger to `render`; at line 1170 moved the custom zero-delay behavior from Root to Trigger.

`grep -n "radix-ui\|@radix-ui"` returns no matches for these files.

## Left alone

Attachment preview content and styling were unchanged.

## Behavior changes

None; the custom zero-delay open/close behavior is preserved on the trigger.

## Verify by hand

Hover and keyboard-focus attachments; verify instant preview, positioning, dismissal, and focus behavior.
