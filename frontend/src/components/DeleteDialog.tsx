import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import type { FileInfo } from '@/api/client'

interface DeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  files: FileInfo[]
  onConfirm: () => void
  isLoading?: boolean
  permanent?: boolean
}

export function DeleteDialog({
  open,
  onOpenChange,
  files,
  onConfirm,
  isLoading = false,
  permanent = false,
}: DeleteDialogProps) {
  const itemCount = files.length
  const hasDirectories = files.some((f) => f.is_directory)
  const hasFiles = files.some((f) => !f.is_directory)

  let itemDescription: string
  if (itemCount === 1) {
    itemDescription = files[0].is_directory ? `folder "${files[0].name}"` : `file "${files[0].name}"`
  } else if (hasDirectories && hasFiles) {
    itemDescription = `${itemCount} items`
  } else if (hasDirectories) {
    itemDescription = `${itemCount} folders`
  } else {
    itemDescription = `${itemCount} files`
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {permanent ? 'Permanently delete' : 'Move to Trash'}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {permanent ? (
              <>
                Are you sure you want to permanently delete {itemDescription}?
                {hasDirectories && ' This will also delete all contents inside.'}
                {' '}This action cannot be undone.
              </>
            ) : (
              <>
                {itemCount === 1
                  ? `"${files[0].name}" will be moved to Trash.`
                  : `${itemDescription} will be moved to Trash.`
                }
                {' '}You can restore {itemCount === 1 ? 'it' : 'them'} later from the Trash.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className={permanent
              ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              : ''
            }
          >
            {isLoading
              ? (permanent ? 'Deleting...' : 'Moving...')
              : (permanent ? 'Delete Permanently' : 'Move to Trash')
            }
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
