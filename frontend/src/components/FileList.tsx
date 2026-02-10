import { useState, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { FileIcon, isAudioFile } from './FileIcon'
import { AudioCover } from './AudioCover'
import { FileContextMenu } from './FileContextMenu'
import { ContextMenu, ContextMenuTrigger, ContextMenuItem } from '@/components/ui/context-menu'
import { Checkbox } from '@/components/ui/checkbox'
import { HardDrive, Loader2 } from 'lucide-react'
import { api, type FileInfo } from '@/api/client'
import { cn, isFileSelected, createCheckboxClickHandler, formatBytes, formatFileDate } from '@/lib/utils'
import { useDragAndDrop } from '@/hooks/useDragAndDrop'

const ROW_HEIGHT = 40

interface FileListProps {
  files: FileInfo[]
  selectedFiles: Set<string>
  focusedIndex?: number
  trashMode?: boolean
  onSelect: (file: FileInfo, e: React.MouseEvent) => void
  onOpen: (file: FileInfo) => void
  onRename: (file: FileInfo) => void
  onDelete: (files: FileInfo[]) => void
  onCopy: (files: FileInfo[]) => void
  onCut: (files: FileInfo[]) => void
  onPreview: (file: FileInfo) => void
  onDownload: (file: FileInfo) => void
  onMove?: (files: FileInfo[], targetFolder: FileInfo) => void
  onRestore?: (files: FileInfo[]) => void
  onAddFavorite?: (path: string) => void
  onRemoveFavorite?: (path: string) => void
  isFavorite?: (path: string) => boolean
  parentRef?: React.RefObject<HTMLDivElement>
}

export function FileList({
  files,
  selectedFiles,
  focusedIndex = -1,
  trashMode,
  onSelect,
  onOpen,
  onRename,
  onDelete,
  onCopy,
  onCut,
  onPreview,
  onDownload,
  onMove,
  onRestore,
  onAddFavorite,
  onRemoveFavorite,
  isFavorite,
  parentRef,
}: FileListProps) {
  const [folderSizes, setFolderSizes] = useState<Record<string, number | 'loading'>>({})
  const internalRef = useRef<HTMLDivElement>(null)
  const scrollRef = parentRef || internalRef
  const { draggedFiles, dropTarget, handleDragStart, handleDragEnd, handleDragOver, handleDragLeave, handleDrop } =
    useDragAndDrop({ files, selectedFiles, onMove })

  const virtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  })

  const calculateFolderSize = async (file: FileInfo) => {
    if (!file.is_directory || folderSizes[file.path]) return
    setFolderSizes(prev => ({ ...prev, [file.path]: 'loading' }))
    try {
      const size = await api.getFolderSize(file.path)
      setFolderSizes(prev => ({ ...prev, [file.path]: size }))
    } catch {
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

  return (
    <div className="flex flex-col" role="rowgroup" aria-label="File list">
      {/* Header */}
      <div className="grid grid-cols-[auto_1fr_100px_150px] gap-4 px-4 py-2 text-sm font-medium text-muted-foreground border-b bg-muted/30" role="row" aria-hidden="true">
        <div className="w-5" />
        <div>Name</div>
        <div className="text-right">Size</div>
        <div>Modified</div>
      </div>

      {/* Virtualized file list */}
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const index = virtualRow.index
          const file = files[index]
          const isDragging = draggedFiles.some(f => f.path === file.path)
          const isDroppable = dropTarget === file.path && file.is_directory
          const isFocused = index === focusedIndex
          const isFileFavorite = file.is_directory && isFavorite?.(file.path)

          return (
            <div
              key={file.path}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <ContextMenu>
                <ContextMenuTrigger>
                  <div
                    role="row"
                    aria-selected={isFileSelected(file, selectedFiles)}
                    aria-label={file.name}
                    className={cn(
                      'group grid grid-cols-[auto_1fr_100px_150px] gap-4 px-4 py-2 text-sm cursor-pointer transition-colors h-full',
                      'hover:bg-accent/50',
                      isFileSelected(file, selectedFiles) && 'bg-primary/10 border-l-2 border-primary',
                      isFocused && !isFileSelected(file, selectedFiles) && 'bg-primary/5 ring-1 ring-primary/50',
                      isDragging && 'opacity-50',
                      isDroppable && 'ring-2 ring-primary bg-primary/10'
                    )}
                    onClick={() => onOpen(file)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, file)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, file)}
                    onDragLeave={(e) => handleDragLeave(e, file)}
                    onDrop={(e) => handleDrop(e, file)}
                  >
                    {/* Checkbox - always visible */}
                    <div
                      className="flex items-center"
                      onClick={createCheckboxClickHandler(file, onSelect)}
                    >
                      <Checkbox
                        checked={isFileSelected(file, selectedFiles)}
                        className={cn(
                          'h-4 w-4 transition-opacity',
                          isFileSelected(file, selectedFiles) ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'
                        )}
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
                <FileContextMenu
                  file={file}
                  files={files}
                  selectedFiles={selectedFiles}
                  isFileFavorite={isFileFavorite}
                  trashMode={trashMode}
                  onOpen={onOpen}
                  onRename={onRename}
                  onDelete={onDelete}
                  onCopy={onCopy}
                  onCut={onCut}
                  onPreview={onPreview}
                  onDownload={onDownload}
                  onRestore={onRestore}
                  onAddFavorite={onAddFavorite}
                  onRemoveFavorite={onRemoveFavorite}
                  extraItems={
                    file.is_directory && !folderSizes[file.path] ? (
                      <ContextMenuItem onClick={() => calculateFolderSize(file)}>
                        <HardDrive className="mr-2 h-4 w-4" />
                        Calculate Size
                      </ContextMenuItem>
                    ) : undefined
                  }
                />
              </ContextMenu>
            </div>
          )
        })}
      </div>
    </div>
  )
}
