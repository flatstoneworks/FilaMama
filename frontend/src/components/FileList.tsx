import { FileIcon, isPreviewable } from './FileIcon'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Checkbox } from '@/components/ui/checkbox'
import { Copy, Scissors, Trash2, Pencil, Eye, Download, FolderOpen } from 'lucide-react'
import type { FileInfo } from '@/api/client'
import { cn, isFileSelected, getSelectedOrSingle, createCheckboxClickHandler, formatBytes, formatFileDate } from '@/lib/utils'

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
  const handleClick = (file: FileInfo) => {
    // Single click opens the file/folder
    onOpen(file)
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
                  isFileSelected(file, selectedFiles) && 'bg-accent'
                )}
                onClick={() => handleClick(file)}
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
                  ) : (
                    <FileIcon name={file.name} isDirectory={file.is_directory} size={20} />
                  )}
                  <span className="truncate" title={file.name}>
                    {file.name}
                  </span>
                </div>
                <div className="text-right text-muted-foreground">
                  {file.is_directory ? '-' : formatBytes(file.size)}
                </div>
                <div className="text-muted-foreground">
                  {formatFileDate(file.modified)}
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
        ))}
      </div>
    </div>
  )
}
