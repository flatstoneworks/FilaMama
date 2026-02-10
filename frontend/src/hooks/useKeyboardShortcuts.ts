import { useState, useEffect } from 'react'
import type { FileInfo } from '@/api/client'
import type { ViewMode } from '@/components/Toolbar'

interface UseKeyboardShortcutsOptions {
  displayedFiles: FileInfo[]
  selectedFilesList: FileInfo[]
  hasClipboard: boolean
  currentPath: string
  viewMode: ViewMode
  gridSize: number
  isAudioPlayerOpen?: boolean
  selectFile: (file: FileInfo, e: React.MouseEvent) => void
  clearSelection: () => void
  onCopy: (files: FileInfo[]) => void
  onCut: (files: FileInfo[]) => void
  onPaste: () => void
  onDelete: (files: FileInfo[]) => void
  onOpen: (file: FileInfo) => void
  onNavigate: (path: string) => void
  onRename: (file: FileInfo) => void
  onClearSearch: () => void
  onShowHelp?: () => void
}

export function useKeyboardShortcuts({
  displayedFiles,
  selectedFilesList,
  hasClipboard,
  currentPath,
  viewMode,
  gridSize,
  isAudioPlayerOpen = false,
  selectFile,
  clearSelection,
  onCopy,
  onCut,
  onPaste,
  onDelete,
  onOpen,
  onNavigate,
  onRename,
  onClearSearch,
  onShowHelp,
}: UseKeyboardShortcutsOptions) {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)

  // Reset focused index when path or files change
  useEffect(() => {
    setFocusedIndex(-1)
  }, [currentPath, displayedFiles.length === 0])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return
      }

      // Ctrl/Cmd + A: Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        displayedFiles.forEach((file) => selectFile(file, { ctrlKey: true } as React.MouseEvent))
      }

      // Ctrl/Cmd + C: Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedFilesList.length > 0) {
        e.preventDefault()
        onCopy(selectedFilesList)
      }

      // Ctrl/Cmd + X: Cut
      if ((e.ctrlKey || e.metaKey) && e.key === 'x' && selectedFilesList.length > 0) {
        e.preventDefault()
        onCut(selectedFilesList)
      }

      // Ctrl/Cmd + V: Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && hasClipboard) {
        e.preventDefault()
        onPaste()
      }

      // Delete
      if (e.key === 'Delete' && selectedFilesList.length > 0) {
        e.preventDefault()
        onDelete(selectedFilesList)
      }

      // Enter: Open selected file (if only one is selected)
      if (e.key === 'Enter' && selectedFilesList.length === 1) {
        e.preventDefault()
        onOpen(selectedFilesList[0])
      }

      // Escape: Clear selection
      if (e.key === 'Escape') {
        e.preventDefault()
        clearSelection()
        onClearSearch()
      }

      // F2: Rename
      if (e.key === 'F2' && selectedFilesList.length === 1) {
        e.preventDefault()
        onRename(selectedFilesList[0])
      }

      // Backspace: Navigate to parent
      if (e.key === 'Backspace' && currentPath !== '/') {
        e.preventDefault()
        const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/'
        onNavigate(parentPath)
      }

      // ?: Show keyboard shortcuts help
      if (e.key === '?' && onShowHelp) {
        e.preventDefault()
        onShowHelp()
      }

      // Arrow key navigation
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && displayedFiles.length > 0) {
        e.preventDefault()

        const columns = viewMode === 'list' ? 1 : Math.max(1, Math.floor((window.innerWidth - 208) / (gridSize + 8)))

        let newIndex = focusedIndex
        if (focusedIndex === -1) {
          newIndex = 0
        } else {
          switch (e.key) {
            case 'ArrowUp':
              newIndex = Math.max(0, focusedIndex - columns)
              break
            case 'ArrowDown':
              newIndex = Math.min(displayedFiles.length - 1, focusedIndex + columns)
              break
            case 'ArrowLeft':
              if (viewMode === 'grid') {
                newIndex = Math.max(0, focusedIndex - 1)
              }
              break
            case 'ArrowRight':
              if (viewMode === 'grid') {
                newIndex = Math.min(displayedFiles.length - 1, focusedIndex + 1)
              }
              break
          }
        }

        setFocusedIndex(newIndex)

        if (e.shiftKey && newIndex !== focusedIndex) {
          selectFile(displayedFiles[newIndex], { shiftKey: true, ctrlKey: false } as React.MouseEvent)
        } else if (!e.shiftKey && !e.ctrlKey) {
          clearSelection()
          selectFile(displayedFiles[newIndex], { ctrlKey: true } as React.MouseEvent)
        }
      }

      // Space: toggle selection of focused item (skip when audio player handles it)
      if (e.key === ' ' && !isAudioPlayerOpen && focusedIndex >= 0 && focusedIndex < displayedFiles.length) {
        e.preventDefault()
        selectFile(displayedFiles[focusedIndex], { ctrlKey: true } as React.MouseEvent)
      }

      // Enter with focused item (no selection): open focused item
      if (e.key === 'Enter' && selectedFilesList.length === 0 && focusedIndex >= 0) {
        e.preventDefault()
        onOpen(displayedFiles[focusedIndex])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    displayedFiles,
    selectedFilesList,
    hasClipboard,
    currentPath,
    isAudioPlayerOpen,
    selectFile,
    clearSelection,
    onCopy,
    onCut,
    onPaste,
    onDelete,
    onOpen,
    onNavigate,
    onRename,
    onClearSearch,
    onShowHelp,
    focusedIndex,
    viewMode,
    gridSize,
  ])

  return { focusedIndex }
}
