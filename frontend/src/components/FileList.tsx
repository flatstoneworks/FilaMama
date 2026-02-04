import { useState } from 'react'
import { FileIcon, isPreviewable, isAudioFile } from './FileIcon'
import { AudioCover } from './AudioCover'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Checkbox } from '@/components/ui/checkbox'
import { Copy, Scissors, Trash2, Pencil, Eye, Download, FolderOpen, HardDrive, Loader2, Star, StarOff } from 'lucide-react'
import { api, type FileInfo } from '@/api/client'
import { cn, isFileSelected, getSelectedOrSingle, createCheckboxClickHandler, formatBytes, formatFileDate } from '@/lib/utils'

interface FileListProps {
  files: FileInfo[]
  selectedFiles: Set<string>
  focusedIndex?: number
  onSelect: (file: FileInfo, e: React.MouseEvent) => void
  onOpen: (file: FileInfo) => void
  onRename: (file: FileInfo) => void
  onDelete: (files: FileInfo[]) => void
  onCopy: (files: FileInfo[]) => void
  onCut: (files: FileInfo[]) => void
  onPreview: (file: FileInfo) => void
  onDownload: (file: FileInfo) => void
  onMove?: (files: FileInfo[], targetFolder: FileInfo) => void
  onAddFavorite?: (path: string) => void
  onRemoveFavorite?: (path: string) => void
  isFavorite?: (path: string) => boolean
}

export function FileList({
  files,
  selectedFiles,
  focusedIndex = -1,
  onSelect,
  onOpen,
  onRename,
  onDelete,
  onCopy,
  onCut,
  onPreview,
  onDownload,
  onMove,
  onAddFavorite,
  onRemoveFavorite,
  isFavorite,
}: FileListProps) {
  const [draggedFiles, setDraggedFiles] = useState<FileInfo[]>([])
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [folderSizes, setFolderSizes] = useState<Record<string, number | 'loading'>>({})

  const calculateFolderSize = async (file: FileInfo) => {
    if (!file.is_directory || folderSizes[file.path]) return
    setFolderSizes(prev => ({ ...prev, [file.path]: 'loading' }))
    try {
      const size = await api.getFolderSize(file.path)
      setFolderSizes(prev => ({ ...prev, [file.path]: size }))
    } catch {
      // Remove loading state on error
      setFolderSizes(prev => {
        const next = { ...prev }
        delete next[file.path]
        return next
      })
    }
  }

  const getFolderSizeDisplay = (file: FileInfo): React.ReactNode => {
    if (!file.is_directory) return formatBytes(file.size)
    const size = folderSizes[file.path]
    if (size === 'loading') return <Loader2 className="h-3 w-3 animate-spin inline" />
    if (typeof size === 'number') return formatBytes(size)
    return (
      <button
        onClick={(e) => { e.stopPropagation(); calculateFolderSize(file) }}
        className="hover:text-foreground hover:underline"
        title="Click to calculate folder size"
      >
        -
      </button>
    )
  }

  const handleClick = (file: FileInfo) => {
    // Single click opens the file/folder
    onOpen(file)
  }

  const handleDragStart = (e: React.DragEvent, file: FileInfo) => {
    e.stopPropagation()

    // If file is selected, drag all selected files; otherwise just this file
    const filesToDrag = isFileSelected(file, selectedFiles)
      ? files.filter(f => selectedFiles.has(f.path))
      : [file]

    setDraggedFiles(filesToDrag)

    // Set drag data
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', JSON.stringify(filesToDrag.map(f => f.path)))
  }

  const handleDragEnd = () => {
    setDraggedFiles([])
    setDropTarget(null)
  }

  const handleDragOver = (e: React.DragEvent, file: FileInfo) => {
    // Only handle internal drags (moving files), not external drags (uploading)
    // External drags have files in dataTransfer.types
    const isExternalDrag = e.dataTransfer.types.includes('Files')
    const isInternalDrag = draggedFiles.length > 0

    if (!isInternalDrag || isExternalDrag) {
      // Let the event bubble up to UploadDropzone for external file uploads
      return
    }

    // Only allow dropping on folders for internal file moves
    if (file.is_directory) {
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'move'
      setDropTarget(file.path)
    }
  }

  const handleDragLeave = (e: React.DragEvent, file: FileInfo) => {
    e.stopPropagation()
    if (dropTarget === file.path) {
      setDropTarget(null)
    }
  }

  const handleDrop = (e: React.DragEvent, targetFolder: FileInfo) => {
    // Only handle internal drags (moving files), not external drags (uploading)
    const isExternalDrag = e.dataTransfer.types.includes('Files')
    const isInternalDrag = draggedFiles.length > 0

    if (!isInternalDrag || isExternalDrag) {
      // Let the event bubble up to UploadDropzone for external file uploads
      return
    }

    e.preventDefault()
    e.stopPropagation()

    if (!targetFolder.is_directory || !onMove) return

    // Don't drop on itself
    const isDroppingOnSelf = draggedFiles.some(f => f.path === targetFolder.path)
    if (isDroppingOnSelf) {
      setDropTarget(null)
      setDraggedFiles([])
      return
    }

    onMove(draggedFiles, targetFolder)
    setDropTarget(null)
    setDraggedFiles([])
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="grid grid-cols-[auto_1fr_100px_150px] gap-4 px-4 py-2 text-sm font-medium text-muted-foreground border-b bg-muted/30">
        <div className="w-5" /> {/* Checkbox column */}
        <div>Name</div>
        <div className="text-right">Size</div>
        <div>Modified</div>
      </div>

      {/* File list */}
      <div className="flex flex-col">
        {files.map((file, index) => {
          const isDragging = draggedFiles.some(f => f.path === file.path)
          const isDroppable = dropTarget === file.path && file.is_directory
          const isFocused = index === focusedIndex
          const isFileFavorite = file.is_directory && isFavorite?.(file.path)

          return (
            <ContextMenu key={file.path}>
              <ContextMenuTrigger>
                <div
                  className={cn(
                    'group grid grid-cols-[auto_1fr_100px_150px] gap-4 px-4 py-2 text-sm cursor-pointer transition-colors',
                    'hover:bg-accent/50',
                    isFileSelected(file, selectedFiles) && 'bg-accent',
                    isFocused && !isFileSelected(file, selectedFiles) && 'bg-accent/30 ring-1 ring-primary/50',
                    isDragging && 'opacity-50',
                    isDroppable && 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950'
                  )}
                  onClick={() => handleClick(file)}
                  draggable
                  onDragStart={(e) => handleDragStart(e, file)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, file)}
                  onDragLeave={(e) => handleDragLeave(e, file)}
                  onDrop={(e) => handleDrop(e, file)}
                >
                {/* Checkbox */}
                <div
                  className={cn(
                    'flex items-center transition-opacity',
                    isFileSelected(file, selectedFiles) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  )}
                  onClick={createCheckboxClickHandler(file, onSelect)}
                >
                  <Checkbox
                    checked={isFileSelected(file, selectedFiles)}
                    className="h-4 w-4"
                  />
                </div>

                <div className="flex items-center gap-3 min-w-0">
                  {file.thumbnail_url ? (
                    <img
                      src={file.thumbnail_url}
                      alt={file.name}
                      className="w-8 h-8 rounded object-cover"
                    />
                  ) : isAudioFile(file.name) ? (
                    <AudioCover path={file.path} size={32} />
                  ) : (
                    <FileIcon name={file.name} isDirectory={file.is_directory ?? false} size={20} />
                  )}
                  <span className="truncate" title={file.name}>
                    {file.name}
                  </span>
                </div>
                <div className="text-right text-muted-foreground">
                  {getFolderSizeDisplay(file)}
                </div>
                <div className="text-muted-foreground">
                  {formatFileDate(file.modified)}
                </div>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              {file.is_directory ? (
                <>
                  <ContextMenuItem onClick={() => onOpen(file)}>
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Open
                  </ContextMenuItem>
                  {isFileFavorite ? (
                    <ContextMenuItem onClick={() => onRemoveFavorite?.(file.path)}>
                      <StarOff className="mr-2 h-4 w-4" />
                      Remove from Favorites
                    </ContextMenuItem>
                  ) : (
                    <ContextMenuItem onClick={() => onAddFavorite?.(file.path)}>
                      <Star className="mr-2 h-4 w-4" />
                      Add to Favorites
                    </ContextMenuItem>
                  )}
                  {!folderSizes[file.path] && (
                    <ContextMenuItem onClick={() => calculateFolderSize(file)}>
                      <HardDrive className="mr-2 h-4 w-4" />
                      Calculate Size
                    </ContextMenuItem>
                  )}
                </>
              ) : (
                <>
                  {isPreviewable(file.name) && (
                    <ContextMenuItem onClick={() => onPreview(file)}>
                      <Eye className="mr-2 h-4 w-4" />
                      Preview
                    </ContextMenuItem>
                  )}
                  <ContextMenuItem onClick={() => onDownload(file)}>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </ContextMenuItem>
                </>
              )}
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => onRename(file)}>
                <Pencil className="mr-2 h-4 w-4" />
                Rename
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onCopy(getSelectedOrSingle(file, files, selectedFiles))}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onCut(getSelectedOrSingle(file, files, selectedFiles))}>
                <Scissors className="mr-2 h-4 w-4" />
                Cut
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                className="text-destructive"
                onClick={() => onDelete(getSelectedOrSingle(file, files, selectedFiles))}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
          )
        })}
      </div>
    </div>
  )
}
