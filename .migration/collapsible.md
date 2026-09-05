# collapsible

2026-08-30, official Base Nova CLI diff plus transformation engine; migrated collapsibles to Base UI.

## Changed

- `apps/chat/src/components/ui/collapsible.tsx:1`: replaced the Radix primitive with Base UI and mapped Content to Panel.
- `apps/chat/src/components/BoostCodePreview.tsx:26`: replaced trigger `asChild` with Base UI `render` composition.
- `apps/chat/src/components/ai-elements/reasoning.tsx:3`: replaced Radix controllable-state usage locally and converted Collapsible state selectors.
- `apps/chat/src/components/ai-elements/tool.tsx:71`: converted Collapsible state selectors to Base UI hooks.

`grep -n "radix-ui\|@radix-ui"` returns no matches for these files.

## Left alone

Streaming auto-close timing was unchanged.

## Behavior changes

None.

## Verify by hand

Toggle reasoning, tool output, and code preview by pointer and keyboard; verify animation and auto-close.
