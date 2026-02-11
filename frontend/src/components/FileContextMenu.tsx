import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu'
import { isPreviewable } from './FileIcon'
import { Copy, Scissors, Trash2, Pencil, Eye, Download, FolderOpen, Star, StarOff, ArchiveRestore, ExternalLink } from 'lucide-react'
import type { FileInfo } from '@/api/client'
import { getSelectedOrSingle } from '@/lib/utils'

interface FileContextMenuProps {
  file: FileInfo
  files: FileInfo[]
  selectedFiles: Set<string>
  isFileFavorite?: boolean
  trashMode?: boolean
  onOpen: (file: FileInfo) => void
  onRename: (file: FileInfo) => void
  onDelete: (files: FileInfo[]) => void
  onCopy: (files: FileInfo[]) => void
  onCut: (files: FileInfo[]) => void
  onPreview: (file: FileInfo) => void
  onDownload: (file: FileInfo) => void
  onRestore?: (files: FileInfo[]) => void
  onAddFavorite?: (path: string) => void
  onRemoveFavorite?: (path: string) => void
  extraItems?: React.ReactNode
}

export function FileContextMenu({
  file,
  files,
  selectedFiles,
  isFileFavorite,
  trashMode,
  onOpen,
  onRename,
  onDelete,
  onCopy,
  onCut,
  onPreview,
  onDownload,
  onRestore,
  onAddFavorite,
  onRemoveFavorite,
  extraItems,
}: FileContextMenuProps) {
  if (trashMode) {
    return (
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onRestore?.(getSelectedOrSingle(file, files, selectedFiles))}>
          <ArchiveRestore className="mr-2 h-4 w-4" />
          Restore
        </ContextMenuItem>
        {!file.is_directory && isPreviewable(file.name) && (
          <ContextMenuItem onClick={() => onPreview(file)}>
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </ContextMenuItem>
        )}
        {!file.is_directory && (
          <ContextMenuItem onClick={() => onDownload(file)}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-destructive"
          onClick={() => onDelete(getSelectedOrSingle(file, files, selectedFiles))}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Permanently
        </ContextMenuItem>
      </ContextMenuContent>
    )
  }

  return (
    <ContextMenuContent>
      {file.is_directory ? (
        <>
          <ContextMenuItem onClick={() => onOpen(file)}>
            <FolderOpen className="mr-2 h-4 w-4" />
            Open
          </ContextMenuItem>
          <ContextMenuItem onClick={() => window.open(`/browse${file.path}`, '_blank')}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Open in New Tab
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
          {extraItems}
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
  )
}
