import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

export type ConflictResolution = 'replace' | 'skip' | 'rename' | 'cancel'

interface ConflictDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conflictFiles: string[]
  operation: 'copy' | 'cut'
  onResolve: (resolution: ConflictResolution) => void
}

export function ConflictDialog({
  open,
  onOpenChange,
  conflictFiles,
  operation,
  onResolve,
}: ConflictDialogProps) {
  const count = conflictFiles.length
  const operationText = operation === 'copy' ? 'copying' : 'moving'

  const handleResolve = (resolution: ConflictResolution) => {
    onOpenChange(false)
    onResolve(resolution)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {count === 1 ? 'File already exists' : `${count} files already exist`}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                {count === 1
                  ? `"${conflictFiles[0]}" already exists in the destination folder.`
                  : `${count} files already exist in the destination folder:`}
              </p>
              {count > 1 && count <= 5 && (
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  {conflictFiles.map((name) => (
                    <li key={name} className="truncate">{name}</li>
                  ))}
                </ul>
              )}
              {count > 5 && (
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  {conflictFiles.slice(0, 4).map((name) => (
                    <li key={name} className="truncate">{name}</li>
                  ))}
                  <li>...and {count - 4} more</li>
                </ul>
              )}
              <p className="text-sm">What would you like to do while {operationText}?</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => handleResolve('cancel')}
            className="sm:mr-auto"
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => handleResolve('skip')}
          >
            Skip {count === 1 ? 'this file' : 'conflicts'}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleResolve('rename')}
          >
            Keep both
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleResolve('replace')}
          >
            Replace {count === 1 ? '' : 'all'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
