import { KeyboardShortcutsDialog as SharedKeyboardShortcutsDialog, type ShortcutSection } from '@flatstoneworks/ui'

const sections: ShortcutSection[] = [
  {
    title: 'File Browser',
    shortcuts: [
      { keys: 'Arrow Keys', description: 'Navigate between files' },
      { keys: 'Shift + Arrow', description: 'Extend selection' },
      { keys: 'Enter', description: 'Open selected file/folder' },
      { keys: 'Space', description: 'Toggle selection of focused item' },
      { keys: 'Ctrl/Cmd + A', description: 'Select all files' },
      { keys: 'Ctrl/Cmd + C', description: 'Copy selected files' },
      { keys: 'Ctrl/Cmd + X', description: 'Cut selected files' },
      { keys: 'Ctrl/Cmd + V', description: 'Paste files' },
      { keys: 'Delete', description: 'Delete selected files' },
      { keys: 'F2', description: 'Rename selected file' },
      { keys: 'Backspace', description: 'Go to parent folder' },
      { keys: 'Escape', description: 'Clear selection and search' },
    ],
  },
  {
    title: 'Video Player',
    shortcuts: [
      { keys: 'Space / K', description: 'Play/Pause' },
      { keys: 'Left / J', description: 'Seek back 10s' },
      { keys: 'Right / L', description: 'Seek forward 10s' },
      { keys: 'Up / Down', description: 'Volume up/down' },
      { keys: 'M', description: 'Mute/unmute' },
      { keys: 'F', description: 'Toggle fullscreen' },
      { keys: '0-9', description: 'Jump to 0%-90%' },
    ],
  },
  {
    title: 'Audio Player',
    shortcuts: [
      { keys: 'Space', description: 'Play/Pause' },
      { keys: 'Shift + Left', description: 'Previous track' },
      { keys: 'Shift + Right', description: 'Next track' },
      { keys: 'M', description: 'Mute/unmute' },
    ],
  },
]

interface KeyboardShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <SharedKeyboardShortcutsDialog
      open={open}
      onOpenChange={onOpenChange}
      sections={sections}
      hint="Press ? to open this dialog"
    />
  )
}
