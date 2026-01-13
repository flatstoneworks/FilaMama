import { useRef, useState } from 'react'
import { FileIcon, isPreviewable } from './FileIcon'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Copy, Scissors, Trash2, Pencil, Eye, Download, FolderOpen } from 'lucide-react'
import type { FileInfo } from '@/api/client'
import { cn } from '@/lib/utils'

interface FileGridProps {
  files: FileInfo[]
  selectedFiles: Set<string>
  gridSize: number
  onSelect: (file: FileInfo, e: React.MouseEvent) => void
  onOpen: (file: FileInfo) => void
  onRename: (file: FileInfo) => void
  onDelete: (files: FileInfo[]) => void
  onCopy: (files: FileInfo[]) => void
  onCut: (files: FileInfo[]) => void
  onPreview: (file: FileInfo) => void
  onDownload: (file: FileInfo) => void
}

export function FileGrid({
  files,
  selectedFiles,
  gridSize,
  onSelect,
  onOpen,
  onRename,
  onDelete,
  onCopy,
  onCut,
  onPreview,
  onDownload,
}: FileGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [lastClickTime, setLastClickTime] = useState(0)
  const [lastClickedFile, setLastClickedFile] = useState<string | null>(null)

  const handleClick = (file: FileInfo, e: React.MouseEvent) => {
    const now = Date.now()
    const isDoubleClick = lastClickedFile === file.name && now - lastClickTime < 300

    if (isDoubleClick) {
      onOpen(file)
    } else {
      onSelect(file, e)
    }

    setLastClickTime(now)
    setLastClickedFile(file.name)
  }

  const getSelectedFiles = (file: FileInfo): FileInfo[] => {
    if (selectedFiles.has(file.name)) {
      return files.filter((f) => selectedFiles.has(f.name))
    }
    return [file]
  }

  return (
    <div
      ref={containerRef}
      className="grid gap-2 p-4"
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(${gridSize}px, 1fr))`,
      }}
    >
      {files.map((file) => (
        <ContextMenu key={file.name}>
          <ContextMenuTrigger>
            <div
              className={cn(
                'flex flex-col items-center p-2 rounded-lg cursor-pointer transition-colors',
                'hover:bg-accent/50',
                selectedFiles.has(file.name) && 'bg-accent ring-2 ring-primary'
              )}
              onClick={(e) => handleClick(file, e)}
            >
              {file.thumbnail_url ? (
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
                    isDirectory={file.is_directory}
                    size={Math.min(gridSize * 0.5, 64)}
                  />
                </div>
              )}
              <span
                className="mt-2 text-xs text-center line-clamp-2 w-full px-1"
                title={file.name}
              >
                {file.name}
              </span>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            {file.is_directory ? (
              <ContextMenuItem onClick={() => onOpen(file)}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Open
              </ContextMenuItem>
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
            <ContextMenuItem onClick={() => onCopy(getSelectedFiles(file))}>
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onCut(getSelectedFiles(file))}>
              <Scissors className="mr-2 h-4 w-4" />
              Cut
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="text-destructive"
              onClick={() => onDelete(getSelectedFiles(file))}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ))}
    </div>
  )
}
