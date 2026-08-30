# collapsible

2026-08-30, official Base Nova CLI diff plus transformation engine; migrated collapsibles to Base UI.

## Changed

`apps/chat/src/components/ui/collapsible.tsx`: Content became Panel. Reasoning/tool/code-preview consumers use Base state hooks and render composition. Leftover scan is clean.

## Left alone

Streaming auto-close timing was unchanged.

## Behavior changes

None.

## Verify by hand

Toggle reasoning, tool output, and code preview by pointer and keyboard; verify animation and auto-close.
