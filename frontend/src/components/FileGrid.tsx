import { useRef } from 'react'
import { FileIcon, isTextFile, isAudioFile } from './FileIcon'
import { VideoPreview } from './VideoPreview'
import { TextPreview } from './TextPreview'
import { AudioCover } from './AudioCover'
import { FileContextMenu } from './FileContextMenu'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Checkbox } from '@/components/ui/checkbox'
import type { FileInfo } from '@/api/client'
import { api } from '@/api/client'
import { cn, isFileSelected, createCheckboxClickHandler, isVideoFile, videoNeedsTranscoding } from '@/lib/utils'
import { useDragAndDrop } from '@/hooks/useDragAndDrop'

interface FileGridProps {
  files: FileInfo[]
  selectedFiles: Set<string>
  gridSize: number
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
}

export function FileGrid({
  files,
  selectedFiles,
  gridSize,
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
}: FileGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { draggedFiles, dropTarget, handleDragStart, handleDragEnd, handleDragOver, handleDragLeave, handleDrop } =
    useDragAndDrop({ files, selectedFiles, onMove })

  return (
    <div
      ref={containerRef}
      role="grid"
      aria-label="File browser"
      className="grid gap-2 p-4"
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(${gridSize}px, 1fr))`,
      }}
    >
      {files.map((file, index) => {
        const isDragging = draggedFiles.some(f => f.path === file.path)
        const isDroppable = dropTarget === file.path && file.is_directory
        const isFocused = index === focusedIndex
        const isFileFavorite = file.is_directory && isFavorite?.(file.path)

        return (
          <ContextMenu key={file.path}>
            <ContextMenuTrigger>
              <div
                role="gridcell"
                aria-label={file.name}
                aria-selected={isFileSelected(file, selectedFiles)}
                className={cn(
                  'group relative flex flex-col items-center p-2 rounded-lg cursor-pointer transition-colors',
                  'hover:bg-accent/50',
                  isFileSelected(file, selectedFiles) && 'bg-primary/10 ring-2 ring-primary',
                  isFocused && !isFileSelected(file, selectedFiles) && 'ring-2 ring-primary/50 bg-primary/5',
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
                className="absolute top-1 left-1 z-10"
                onClick={createCheckboxClickHandler(file, onSelect)}
              >
                <Checkbox
                  checked={isFileSelected(file, selectedFiles)}
                  className={cn(
                    'h-5 w-5 bg-background/80 backdrop-blur transition-opacity',
                    isFileSelected(file, selectedFiles) ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'
                  )}
                />
              </div>

              {file.thumbnail_url && isVideoFile(file.name) ? (
                <div
                  className="rounded-md overflow-hidden bg-muted flex items-center justify-center"
                  style={{ width: gridSize - 16, height: gridSize - 16 }}
                >
                  <VideoPreview
                    src={videoNeedsTranscoding(file.name)
                      ? api.getTranscodeStreamUrl(file.path)
                      : api.getStreamUrl(file.path)
                    }
                    posterUrl={file.thumbnail_url}
                    width={gridSize - 16}
                    height={gridSize - 16}
                  />
                </div>
              ) : isTextFile(file.name) ? (
                <TextPreview
                  src={api.getDownloadUrl(file.path)}
                  fileName={file.name}
                  width={gridSize - 16}
                  height={gridSize - 16}
                />
              ) : isAudioFile(file.name) ? (
                <AudioCover
                  path={file.path}
                  size={gridSize - 16}
                />
              ) : file.thumbnail_url ? (
                <div
                  className="rounded-md overflow-hidden bg-muted flex items-center justify-center"
                  style={{ width: gridSize - 16, height: gridSize - 16 }}
                >
                  <img
                    src={file.thumbnail_url}
                    alt={file.name}
                    className="max-w-full max-h-full object-contain"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div
                  className="flex items-center justify-center"
                  style={{ width: gridSize - 16, height: gridSize - 16 }}
                >
                  <FileIcon
                    name={file.name}
                    isDirectory={file.is_directory ?? false}
                    size={Math.min(gridSize * 0.5, 64)}
                  />
                </div>
              )}
              <span
                className={cn(
                  'mt-2 text-center line-clamp-2 w-full px-1',
                  file.is_directory ? 'text-sm font-medium' : 'text-xs text-muted-foreground'
                )}
                title={file.name}
              >
                {file.name}
              </span>
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
          />
        </ContextMenu>
        )
      })}
    </div>
  )
}
