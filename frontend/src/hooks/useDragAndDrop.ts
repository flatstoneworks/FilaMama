import { useState, useCallback } from 'react'
import type { FileInfo } from '@/api/client'
import { isFileSelected } from '@/lib/utils'

interface UseDragAndDropOptions {
  files: FileInfo[]
  selectedFiles: Set<string>
  onMove?: (files: FileInfo[], targetFolder: FileInfo) => void
}

export function useDragAndDrop({ files, selectedFiles, onMove }: UseDragAndDropOptions) {
  const [draggedFiles, setDraggedFiles] = useState<FileInfo[]>([])
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const handleDragStart = useCallback((e: React.DragEvent, file: FileInfo) => {
    e.stopPropagation()

    const filesToDrag = isFileSelected(file, selectedFiles)
      ? files.filter(f => selectedFiles.has(f.path))
      : [file]

    setDraggedFiles(filesToDrag)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', JSON.stringify(filesToDrag.map(f => f.path)))
  }, [files, selectedFiles])

  const handleDragEnd = useCallback(() => {
    setDraggedFiles([])
    setDropTarget(null)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, file: FileInfo) => {
    const isExternalDrag = e.dataTransfer.types.includes('Files')
    const isInternalDrag = draggedFiles.length > 0

    if (!isInternalDrag || isExternalDrag) return

    if (file.is_directory) {
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'move'
      setDropTarget(file.path)
    }
  }, [draggedFiles])

  const handleDragLeave = useCallback((e: React.DragEvent, file: FileInfo) => {
    e.stopPropagation()
    if (dropTarget === file.path) {
      setDropTarget(null)
    }
  }, [dropTarget])

  const handleDrop = useCallback((e: React.DragEvent, targetFolder: FileInfo) => {
    const isExternalDrag = e.dataTransfer.types.includes('Files')
    const isInternalDrag = draggedFiles.length > 0

    if (!isInternalDrag || isExternalDrag) return

    e.preventDefault()
    e.stopPropagation()

    if (!targetFolder.is_directory || !onMove) return

    const isDroppingOnSelf = draggedFiles.some(f => f.path === targetFolder.path)
    if (isDroppingOnSelf) {
      setDropTarget(null)
      setDraggedFiles([])
      return
    }

    onMove(draggedFiles, targetFolder)
    setDropTarget(null)
    setDraggedFiles([])
  }, [draggedFiles, onMove])

  return {
    draggedFiles,
    dropTarget,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  }
}
