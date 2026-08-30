# tooltip

2026-08-30, official Base Nova CLI diff plus transformation engine; migrated tooltips to Base UI.

## Changed

- `apps/chat/src/components/ui/tooltip.tsx:1`: replaced Radix Tooltip with Base UI Portal/Positioner/Popup, arrow positioning, and a zero-delay Provider.
- `apps/chat/src/components/ai-elements/message.tsx:76`: converted message-action and attachment triggers from `asChild` to Base UI `render`.

`grep -n "radix-ui\|@radix-ui"` returns no matches for these files.

## Left alone

Tooltip text and button styling were unchanged.

## Behavior changes

None; zero-delay behavior is preserved.

## Verify by hand

Hover and keyboard-focus message actions and attachments; verify immediate display, placement, Escape dismissal, and accessible names.
