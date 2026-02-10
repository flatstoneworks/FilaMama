import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface KeyboardShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface Shortcut {
  keys: string
  description: string
}

interface ShortcutSection {
  title: string
  shortcuts: Shortcut[]
}

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

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 mt-2">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">{section.title}</h3>
              <div className="space-y-1">
                {section.shortcuts.map((shortcut) => (
                  <div key={shortcut.keys} className="flex items-center justify-between py-1">
                    <span className="text-sm">{shortcut.description}</span>
                    <kbd className="px-2 py-0.5 text-xs font-mono bg-muted rounded border">
                      {shortcut.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Press <kbd className="px-1 py-0.5 text-xs font-mono bg-muted rounded border">?</kbd> to open this dialog
        </p>
      </DialogContent>
    </Dialog>
  )
}
