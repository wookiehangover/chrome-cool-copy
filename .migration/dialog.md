# dialog

2026-08-30, official Base Nova CLI diff plus transformation engine; migrated shared dialogs to Base UI.

## Changed

`packages/ui/src/components/dialog.tsx`: Overlay/Content became Backdrop/Popup and state hooks were converted. Chat and clips consumers retain controlled state. Leftover scan is clean.

## Left alone

Dialog styling and application form behavior were unchanged.

## Behavior changes

None.

## Verify by hand

Open each delete/save/TTS dialog; verify focus trap, Escape/outside dismissal, Close button, and focus return.
