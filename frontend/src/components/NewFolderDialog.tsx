import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface NewFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (name: string) => void
  isLoading?: boolean
}

export function NewFolderDialog({
  open,
  onOpenChange,
  onCreate,
  isLoading = false,
}: NewFolderDialogProps) {
  const [name, setName] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onCreate(name.trim())
      setName('')
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) setName('')
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Folder</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="folder-name">Folder name</Label>
              <Input
                id="folder-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Untitled Folder"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isLoading}>
              {isLoading ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
