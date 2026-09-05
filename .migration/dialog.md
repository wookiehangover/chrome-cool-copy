# dialog

2026-08-30, official Base Nova CLI diff plus transformation engine; migrated shared dialogs to Base UI.

## Changed

- `packages/ui/src/components/dialog.tsx:1`: replaced Radix Dialog with Base UI, mapping Overlay/Content to Backdrop/Popup and converting state hooks.
- `apps/chat/src/components/ui/command.tsx:29`: narrowed Dialog children typing to ReactNode for the Base UI root while leaving cmdk unchanged.

`grep -n "radix-ui\|@radix-ui"` returns no matches for these files.

## Left alone

Dialog styling and application form behavior were unchanged.

## Behavior changes

None.

## Verify by hand

Open each delete/save/TTS dialog; verify focus trap, Escape/outside dismissal, Close button, and focus return.
