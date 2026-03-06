import { DeleteConfirmDialog, type DeleteItem } from '@flatstone/ui'

interface DeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  files: { name: string; is_directory?: boolean }[]
  onConfirm: () => void
  isLoading?: boolean
  permanent?: boolean
}

export function DeleteDialog({ files, ...props }: DeleteDialogProps) {
  const items: DeleteItem[] = files.map(f => ({
    name: f.name,
    isContainer: f.is_directory,
  }))

  return <DeleteConfirmDialog items={items} {...props} />
}
