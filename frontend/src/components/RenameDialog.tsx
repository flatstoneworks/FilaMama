import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface RenameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentName: string
  onRename: (newName: string) => void
  isLoading?: boolean
}

const INVALID_CHARS = /[/\\:*?"<>|]/
const INVALID_CHARS_DISPLAY = '/ \\ : * ? " < > |'

function validateName(name: string): string | null {
  if (!name.trim()) return null
  if (INVALID_CHARS.test(name)) return `Name cannot contain: ${INVALID_CHARS_DISPLAY}`
  if (name.trim() === '.' || name.trim() === '..') return 'Invalid name'
  return null
}

export function RenameDialog({
  open,
  onOpenChange,
  currentName,
  onRename,
  isLoading = false,
}: RenameDialogProps) {
  const [newName, setNewName] = useState(currentName)

  useEffect(() => {
    setNewName(currentName)
  }, [currentName, open])

  const validationError = validateName(newName)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newName.trim() && newName !== currentName && !validationError) {
      onRename(newName.trim())
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">New name</Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                onFocus={(e) => {
                  const lastDot = e.target.value.lastIndexOf('.')
                  if (lastDot > 0) {
                    e.target.setSelectionRange(0, lastDot)
                  } else {
                    e.target.select()
                  }
                }}
              />
              {validationError && (
                <p className="text-xs text-destructive">{validationError}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!newName.trim() || newName === currentName || !!validationError || isLoading}>
              {isLoading ? 'Renaming...' : 'Rename'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
