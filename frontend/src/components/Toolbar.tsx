import { Grid, List, Upload, FolderPlus, FolderUp, Trash2, Copy, Scissors, Clipboard, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, ArchiveRestore } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { SortField, SortOrder } from '@/api/client'

export type ViewMode = 'grid' | 'list'

const sortOptions: { label: string; value: SortField }[] = [
  { label: 'Name', value: 'name' },
  { label: 'Size', value: 'size' },
  { label: 'Date Modified', value: 'modified' },
  { label: 'Type', value: 'type' },
]

interface ToolbarProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  gridSize: number
  onGridSizeChange: (size: number) => void
  itemCount: number
  selectedCount: number
  hasClipboard: boolean
  isTrashView?: boolean
  sortBy?: SortField
  sortOrder?: SortOrder
  onSortChange?: (field: SortField, order: SortOrder) => void
  onNewFolder: () => void
  onUpload: () => void
  onUploadFolder: () => void
  onDelete: () => void
  onCopy: () => void
  onCut: () => void
  onPaste: () => void
  onRefresh: () => void
  onRestore?: () => void
  onEmptyTrash?: () => void
}

export function Toolbar({
  viewMode,
  onViewModeChange,
  gridSize,
  onGridSizeChange,
  itemCount,
  selectedCount,
  hasClipboard,
  isTrashView,
  sortBy = 'name',
  sortOrder = 'asc',
  onSortChange,
  onNewFolder,
  onUpload,
  onUploadFolder,
  onDelete,
  onCopy,
  onCut,
  onPaste,
  onRefresh,
  onRestore,
  onEmptyTrash,
}: ToolbarProps) {
  const handleSortClick = (field: SortField) => {
    if (!onSortChange) return
    if (field === sortBy) {
      // Toggle order
      onSortChange(field, sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // New field, default to ascending (except date which defaults to newest first)
      onSortChange(field, field === 'modified' ? 'desc' : 'asc')
    }
  }
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {/* Left side: item count, refresh, selection info */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRefresh} aria-label="Refresh">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>

          {/* Selection actions */}
          {selectedCount > 0 && (
            <>
              <div className="w-px h-5 bg-border" />
              <span className="text-sm font-medium">
                {selectedCount} selected
              </span>

              {isTrashView ? (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRestore} aria-label="Restore">
                        <ArchiveRestore className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Restore</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete} aria-label="Delete Permanently">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete Permanently</TooltipContent>
                  </Tooltip>
                </>
              ) : (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCopy} aria-label="Copy">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCut} aria-label="Cut">
                        <Scissors className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Cut</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete} aria-label="Delete">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                </>
              )}
            </>
          )}

          {/* Paste action */}
          {hasClipboard && !isTrashView && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPaste} aria-label="Paste">
                  <Clipboard className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Paste</TooltipContent>
            </Tooltip>
          )}

          {/* Empty Trash button */}
          {isTrashView && itemCount > 0 && (
            <>
              <div className="w-px h-5 bg-border" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:text-destructive" onClick={onEmptyTrash} aria-label="Empty Trash">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Empty Trash
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Permanently delete all items in Trash</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side: sort, slider, view toggle, add folder, upload */}
        <div className="flex items-center gap-2">
          {onSortChange && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" aria-label="Sort files">
                      <ArrowUpDown className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{sortOptions.find(o => o.value === sortBy)?.label}</span>
                      {sortOrder === 'asc' ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Sort files</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                {sortOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => handleSortClick(option.value)}
                    className="flex items-center justify-between gap-4"
                  >
                    <span>{option.label}</span>
                    {sortBy === option.value && (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-primary" />
                      )
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {viewMode === 'grid' && (
            <div className="w-24">
              <Slider
                value={[gridSize]}
                onValueChange={([v]) => onGridSizeChange(v)}
                min={80}
                max={200}
                step={10}
              />
            </div>
          )}

          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => v && onViewModeChange(v as ViewMode)}
          >
            <ToggleGroupItem value="grid" size="sm" aria-label="Grid view">
              <Grid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" size="sm" aria-label="List view">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>

          {!isTrashView && (
            <>
              <div className="w-px h-5 bg-border" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNewFolder} aria-label="New Folder">
                    <FolderPlus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New Folder</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onUpload} aria-label="Upload Files">
                    <Upload className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Upload Files</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onUploadFolder} aria-label="Upload Folder">
                    <FolderUp className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Upload Folder</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
