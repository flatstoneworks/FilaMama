import { Grid, List, Upload, FolderPlus, Trash2, Copy, Scissors, Clipboard, RefreshCw, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export type ViewMode = 'grid' | 'list'

interface ToolbarProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  gridSize: number
  onGridSizeChange: (size: number) => void
  selectedCount: number
  hasClipboard: boolean
  onNewFolder: () => void
  onUpload: () => void
  onDelete: () => void
  onCopy: () => void
  onCut: () => void
  onPaste: () => void
  onRefresh: () => void
  searchQuery: string
  onSearchChange: (query: string) => void
}

export function Toolbar({
  viewMode,
  onViewModeChange,
  gridSize,
  onGridSizeChange,
  selectedCount,
  hasClipboard,
  onNewFolder,
  onUpload,
  onDelete,
  onCopy,
  onCut,
  onPaste,
  onRefresh,
  searchQuery,
  onSearchChange,
}: ToolbarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-2 p-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {/* Left actions */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onNewFolder}>
                <FolderPlus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New Folder</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onUpload}>
                <Upload className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Upload Files</TooltipContent>
          </Tooltip>

          <div className="w-px h-6 bg-border mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
        </div>

        {/* Selection actions */}
        {selectedCount > 0 && (
          <>
            <div className="w-px h-6 bg-border mx-1" />
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground px-2">
                {selectedCount} selected
              </span>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onCopy}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onCut}>
                    <Scissors className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Cut</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onDelete}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </div>
          </>
        )}

        {/* Paste action */}
        {hasClipboard && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onPaste}>
                <Clipboard className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Paste</TooltipContent>
          </Tooltip>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search */}
        <div className="relative w-64">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search files..."
            className="pl-8 pr-8 h-8"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-8 w-8"
              onClick={() => onSearchChange('')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* View controls */}
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => v && onViewModeChange(v as ViewMode)}
          >
            <ToggleGroupItem value="grid" size="sm">
              <Grid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" size="sm">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>

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
        </div>
      </div>
    </TooltipProvider>
  )
}
