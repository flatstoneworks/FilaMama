import { useState, useCallback, useRef } from 'react'
import { FileInfo } from '@/api/client'

export function useFileSelection(files: FileInfo[]) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const lastSelectedRef = useRef<string | null>(null)

  const selectFile = useCallback((file: FileInfo, event?: React.MouseEvent) => {
    const path = file.path
    if (event?.shiftKey && lastSelectedRef.current) {
      const lastIndex = files.findIndex(f => f.path === lastSelectedRef.current)
      const currentIndex = files.findIndex(f => f.path === path)
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex)
        const end = Math.max(lastIndex, currentIndex)
        const range = files.slice(start, end + 1).map(f => f.path)
        setSelectedFiles(prev => { const next = new Set(prev); range.forEach(p => next.add(p)); return next })
      }
    } else if (event?.ctrlKey || event?.metaKey) {
      setSelectedFiles(prev => { const next = new Set(prev); next.has(path) ? next.delete(path) : next.add(path); return next })
      lastSelectedRef.current = path
    } else {
      setSelectedFiles(new Set([path]))
      lastSelectedRef.current = path
    }
  }, [files])

  const clearSelection = useCallback(() => { setSelectedFiles(new Set()); lastSelectedRef.current = null }, [])
  const selectAll = useCallback(() => { setSelectedFiles(new Set(files.map(f => f.path))) }, [files])

  return { selectedFiles, selectFile, clearSelection, selectAll, selectedCount: selectedFiles.size }
}
