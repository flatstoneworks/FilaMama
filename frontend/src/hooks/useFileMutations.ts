import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type FileInfo } from '@/api/client'
import { toast } from '@/components/ui/use-toast'
import { getParentPath, joinPath } from '@/lib/utils'

interface UseFileMutationsArgs {
  currentPath: string
  isTrashView: boolean
  clearSelection: () => void
  /** Called after a successful rename so the page can close the dialog. */
  onRenameSuccess?: () => void
  /** Called after a successful create-folder so the page can close the dialog. */
  onCreateFolderSuccess?: () => void
  /** Called after a successful delete (trash or permanent) so the page can close the dialog. */
  onDeleteSuccess?: () => void
}

/**
 * Owns all the TanStack mutations FilesPage drives: rename, create folder,
 * delete (context-aware: trash in browse view, permanent in trash view),
 * restore from trash, empty trash, and move.
 *
 * Query invalidation, toasts, and selection clearing are all handled here so
 * the page component just calls the action.
 */
export function useFileMutations({
  currentPath,
  isTrashView,
  clearSelection,
  onRenameSuccess,
  onCreateFolderSuccess,
  onDeleteSuccess,
}: UseFileMutationsArgs) {
  const queryClient = useQueryClient()

  const renameMutation = useMutation({
    mutationFn: ({ path, newName }: { path: string; newName: string }) =>
      api.rename(path, joinPath(getParentPath(path) || '/', newName)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', currentPath] })
      onRenameSuccess?.()
      toast({ title: 'Renamed successfully' })
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to rename', description: error.message, variant: 'destructive' })
    },
  })

  const createFolderMutation = useMutation({
    mutationFn: (name: string) => api.createFolder(joinPath(currentPath, name)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', currentPath] })
      onCreateFolderSuccess?.()
      toast({ title: 'Folder created' })
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create folder', description: error.message, variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (filesToDelete: FileInfo[]) => {
      if (isTrashView) {
        // Permanently delete — file.path is the trash_name inside the trash dir.
        await api.deletePermanent(filesToDelete.map((f) => f.path))
      } else {
        await api.moveToTrash(filesToDelete.map((f) => f.path))
      }
    },
    onSuccess: () => {
      if (isTrashView) {
        queryClient.invalidateQueries({ queryKey: ['trash-list'] })
      } else {
        queryClient.invalidateQueries({ queryKey: ['files', currentPath] })
      }
      queryClient.invalidateQueries({ queryKey: ['trash-info'] })
      onDeleteSuccess?.()
      clearSelection()
      toast({ title: isTrashView ? 'Permanently deleted' : 'Moved to Trash' })
    },
    onError: (error: Error) => {
      toast({
        title: isTrashView ? 'Failed to delete' : 'Failed to move to Trash',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const restoreMutation = useMutation({
    mutationFn: async (filesToRestore: FileInfo[]) => {
      await api.restoreFromTrash(filesToRestore.map((f) => f.path))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash-list'] })
      queryClient.invalidateQueries({ queryKey: ['trash-info'] })
      queryClient.invalidateQueries({ queryKey: ['files'] })
      clearSelection()
      toast({ title: 'Restored successfully' })
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to restore', description: error.message, variant: 'destructive' })
    },
  })

  const emptyTrashMutation = useMutation({
    mutationFn: () => api.emptyTrash(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash-list'] })
      queryClient.invalidateQueries({ queryKey: ['trash-info'] })
      clearSelection()
      toast({ title: 'Trash emptied' })
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to empty trash', description: error.message, variant: 'destructive' })
    },
  })

  /** Drag-drop move into a target folder (not a TanStack mutation because
   *  the iteration + toast reporting is simpler as a plain async handler). */
  const handleMove = useCallback(
    async (filesToMove: FileInfo[], targetFolder: FileInfo) => {
      try {
        for (const file of filesToMove) {
          await api.move(file.path, targetFolder.path)
        }
        queryClient.invalidateQueries({ queryKey: ['files'] })
        clearSelection()
        toast({ title: `Moved ${filesToMove.length} item(s)` })
      } catch (err) {
        toast({
          title: 'Failed to move files',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        })
      }
    },
    [currentPath, queryClient, clearSelection]
  )

  const handleRestore = useCallback(
    (filesToRestore: FileInfo[]) => {
      restoreMutation.mutate(filesToRestore)
    },
    [restoreMutation]
  )

  return {
    renameMutation,
    createFolderMutation,
    deleteMutation,
    restoreMutation,
    emptyTrashMutation,
    handleMove,
    handleRestore,
  }
}
