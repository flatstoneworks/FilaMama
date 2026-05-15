import { useRef, memo } from 'react'
import { FileIcon, isTextFile, isAudioFile } from './FileIcon'
import { VideoPreview, isVideoFile, videoNeedsTranscoding } from '@flatstoneworks/media-components'
import { TextPreview } from './TextPreview'
import { AudioCover } from './AudioCover'
import { FileContextMenu } from './FileContextMenu'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Checkbox } from '@/components/ui/checkbox'
import type { FileInfo } from '@/api/client'
import { api } from '@/api/client'
import { cn, isFileSelected, createCheckboxClickHandler } from '@/lib/utils'
import { useDragAndDrop } from '@/hooks/useDragAndDrop'

function getRelativeDir(filePath: string, basePath: string): string {
  const dir = filePath.substring(0, filePath.lastIndexOf('/'))
  const prefix = basePath === '/' ? '' : basePath
  if (dir === prefix) return ''
  return dir.substring(prefix.length).replace(/^\//, '') + '/'
}

interface FileGridProps {
  files: FileInfo[]
  selectedFiles: Set<string>
  gridSize: number
  focusedIndex?: number
  trashMode?: boolean
  showPath?: boolean
  basePath?: string
  onSelect: (file: FileInfo, e?: React.MouseEvent) => void
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

export const FileGrid = memo(function FileGrid({
  files,
  selectedFiles,
  gridSize,
  focusedIndex = -1,
  trashMode,
  showPath,
  basePath,
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
  const longPressTimerRef = useRef<number | null>(null)
  const longPressedPathRef = useRef<string | null>(null)
  const lastPointerTypeRef = useRef<string | null>(null)
  const { draggedFiles, dropTarget, handleDragStart, handleDragEnd, handleDragOver, handleDragLeave, handleDrop } =
    useDragAndDrop({ files, selectedFiles, onMove })

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const startLongPress = (file: FileInfo, event: React.PointerEvent) => {
    lastPointerTypeRef.current = event.pointerType
    if (event.pointerType === 'mouse' || selectedFiles.size > 0) return
    clearLongPress()
    longPressTimerRef.current = window.setTimeout(() => {
      longPressedPathRef.current = file.path
      onSelect(file)
    }, 450)
  }

  const toggleSelection = (file: FileInfo, event: React.MouseEvent) => {
    const syntheticEvent = {
      ...event,
      ctrlKey: true,
      metaKey: true,
    } as React.MouseEvent
    onSelect(file, syntheticEvent)
  }

  return (
    <div
      ref={containerRef}
      role="grid"
      aria-label="File browser"
      className="grid gap-3 p-3 md:gap-2 md:p-4"
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(min(${gridSize}px, 45vw), 1fr))`,
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
                tabIndex={isFocused ? 0 : -1}
                className={cn(
                  'group relative flex flex-col items-center p-2 rounded-lg cursor-pointer transition-colors',
                  'hover:bg-accent/50',
                  isFileSelected(file, selectedFiles) && 'bg-primary/10 ring-2 ring-primary',
                  isFocused && !isFileSelected(file, selectedFiles) && 'ring-2 ring-primary/50 bg-primary/5',
                  isDragging && 'opacity-50',
                  isDroppable && 'ring-2 ring-primary bg-primary/10'
                )}
                onClick={(event) => {
                  if (longPressedPathRef.current === file.path) {
                    longPressedPathRef.current = null
                    return
                  }
                  if (selectedFiles.size > 0 && lastPointerTypeRef.current && lastPointerTypeRef.current !== 'mouse') {
                    toggleSelection(file, event)
                    return
                  }
                  onOpen(file)
                }}
                onPointerDown={(event) => startLongPress(file, event)}
                onPointerUp={clearLongPress}
                onPointerMove={clearLongPress}
                onPointerLeave={clearLongPress}
                onPointerCancel={clearLongPress}
                draggable
                onDragStart={(e) => handleDragStart(e, file)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, file)}
                onDragLeave={(e) => handleDragLeave(e, file)}
                onDrop={(e) => handleDrop(e, file)}
              >
              {/* Checkbox - always visible with enlarged click area */}
              <div
                className={cn(
                  'absolute left-0 top-0 z-10 cursor-pointer p-1.5 transition-opacity',
                  selectedFiles.size === 0 && 'pointer-events-none opacity-0 md:pointer-events-auto md:opacity-100'
                )}
                onClick={createCheckboxClickHandler(file, onSelect)}
              >
                <Checkbox
                  checked={isFileSelected(file, selectedFiles)}
                  className={cn(
                    'h-5 w-5 bg-background/80 backdrop-blur transition-opacity',
                    isFileSelected(file, selectedFiles) ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'
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
                  path={file.path}
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
                    onError={(e) => {
                      // Replace broken thumbnail with file icon
                      const target = e.currentTarget
                      target.style.display = 'none'
                      target.parentElement?.classList.add('thumbnail-error')
                    }}
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
              {showPath && basePath && (() => {
                const rel = getRelativeDir(file.path, basePath)
                return rel ? (
                  <span className="text-[10px] text-muted-foreground/60 truncate w-full text-center px-1" title={rel}>
                    {rel}
                  </span>
                ) : null
              })()}
              {file.match_reason && (
                <span className="text-[10px] text-primary truncate w-full text-center px-1">
                  Matched {file.match_reason.replace('_', ' ')}
                </span>
              )}
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
})
