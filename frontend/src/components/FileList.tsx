import { FileIcon, isPreviewable } from './FileIcon'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Checkbox } from '@/components/ui/checkbox'
import { Copy, Scissors, Trash2, Pencil, Eye, Download, FolderOpen } from 'lucide-react'
import type { FileInfo } from '@/api/client'
import { cn } from '@/lib/utils'

interface FileListProps {
  files: FileInfo[]
  selectedFiles: Set<string>
  onSelect: (file: FileInfo, e: React.MouseEvent) => void
  onOpen: (file: FileInfo) => void
  onRename: (file: FileInfo) => void
  onDelete: (files: FileInfo[]) => void
  onCopy: (files: FileInfo[]) => void
  onCut: (files: FileInfo[]) => void
  onPreview: (file: FileInfo) => void
  onDownload: (file: FileInfo) => void
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function FileList({
  files,
  selectedFiles,
  onSelect,
  onOpen,
  onRename,
  onDelete,
  onCopy,
  onCut,
  onPreview,
  onDownload,
}: FileListProps) {
  const isSelected = (file: FileInfo) => selectedFiles.has(file.path)

  const getSelectedFiles = (file: FileInfo): FileInfo[] => {
    if (isSelected(file)) {
      return files.filter((f) => selectedFiles.has(f.path))
    }
    return [file]
  }

  const handleClick = (file: FileInfo) => {
    // Single click opens the file/folder
    onOpen(file)
  }

  const handleCheckboxClick = (file: FileInfo, e: React.MouseEvent) => {
    e.stopPropagation()
    // Simulate ctrl+click for toggle behavior
    const syntheticEvent = {
      ...e,
      ctrlKey: true,
      metaKey: true,
    } as React.MouseEvent
    onSelect(file, syntheticEvent)
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
        {files.map((file) => (
          <ContextMenu key={file.path}>
            <ContextMenuTrigger>
              <div
                className={cn(
                  'group grid grid-cols-[auto_1fr_100px_150px] gap-4 px-4 py-2 text-sm cursor-pointer transition-colors',
                  'hover:bg-accent/50',
                  isSelected(file) && 'bg-accent'
                )}
                onClick={() => handleClick(file)}
              >
                {/* Checkbox */}
                <div
                  className={cn(
                    'flex items-center transition-opacity',
                    isSelected(file) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  )}
                  onClick={(e) => handleCheckboxClick(file, e)}
                >
                  <Checkbox
                    checked={isSelected(file)}
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
                  ) : (
                    <FileIcon name={file.name} isDirectory={file.is_directory} size={20} />
                  )}
                  <span className="truncate" title={file.name}>
                    {file.name}
                  </span>
                </div>
                <div className="text-right text-muted-foreground">
                  {file.is_directory ? '-' : formatSize(file.size)}
                </div>
                <div className="text-muted-foreground">
                  {formatDate(file.modified)}
                </div>
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
    </div>
  )
}
