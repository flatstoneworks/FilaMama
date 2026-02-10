import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type FileInfo } from '@/api/client'
import type { ConflictResolution } from '@/components/ConflictDialog'
import { toast } from '@/components/ui/use-toast'
import { joinPath } from '@/lib/utils'

interface ClipboardState {
  files: FileInfo[]
  operation: 'copy' | 'cut'
  sourcePath: string
}

export function useClipboard(currentPath: string) {
  const queryClient = useQueryClient()
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null)
  const [conflictFiles, setConflictFiles] = useState<string[]>([])

  const handleCopy = useCallback((files: FileInfo[]) => {
    setClipboard({ files, operation: 'copy', sourcePath: currentPath })
    toast({ title: `${files.length} item(s) copied to clipboard` })
  }, [currentPath])

  const handleCut = useCallback((files: FileInfo[]) => {
    setClipboard({ files, operation: 'cut', sourcePath: currentPath })
    toast({ title: `${files.length} item(s) cut to clipboard` })
  }, [currentPath])

  const executePaste = async (resolution: ConflictResolution) => {
    if (!clipboard) return

    const overwrite = resolution === 'replace'
    const skipConflicts = resolution === 'skip'

    for (const file of clipboard.files) {
      const srcPath = joinPath(clipboard.sourcePath, file.name)
      const destPath = joinPath(currentPath, file.name)

      if (skipConflicts && conflictFiles.includes(file.name)) {
        continue
      }

      if (clipboard.operation === 'copy') {
        await api.copy(srcPath, destPath, overwrite)
      } else {
        await api.move(srcPath, destPath, overwrite)
      }
    }
  }

  const pasteMutation = useMutation({
    mutationFn: async (resolution?: ConflictResolution) => {
      if (!clipboard) return

      if (!resolution) {
        const sourcePaths = clipboard.files.map(f => joinPath(clipboard.sourcePath, f.name))
        const conflicts = await api.checkConflicts(sourcePaths, currentPath)

        if (conflicts.length > 0) {
          const conflictNames = conflicts.map(p => p.split('/').pop() || '')
          setConflictFiles(conflictNames)
          return
        }
      }

      await executePaste(resolution || 'rename')
    },
    onSuccess: (_, resolution) => {
      if (resolution || conflictFiles.length === 0) {
        queryClient.invalidateQueries({ queryKey: ['files'] })
        if (clipboard?.operation === 'cut') {
          setClipboard(null)
        }
        toast({ title: clipboard?.operation === 'copy' ? 'Copied' : 'Moved' })
        setConflictFiles([])
      }
    },
    onError: () => {
      toast({ title: 'Operation failed', variant: 'destructive' })
      setConflictFiles([])
    },
  })

  const handleConflictResolution = useCallback((resolution: ConflictResolution) => {
    setConflictFiles([])
    if (resolution !== 'cancel') {
      pasteMutation.mutate(resolution)
    }
  }, [pasteMutation])

  return {
    clipboard,
    conflictFiles,
    handleCopy,
    handleCut,
    pasteMutation,
    handleConflictResolution,
  }
}
