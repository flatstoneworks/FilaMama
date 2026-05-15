import { useMemo, useState } from 'react'
import {
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  CheckSquare,
  Copy,
  FileText,
  Grid,
  List,
  Menu,
  MoreVertical,
  RefreshCw,
  Scissors,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import type { MountPoint, SortField, SortOrder } from '@/api/client'
import type { ViewMode } from '@/components/Toolbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const sortOptions: { label: string; value: SortField }[] = [
  { label: 'Name', value: 'name' },
  { label: 'Size', value: 'size' },
  { label: 'Date Modified', value: 'modified' },
  { label: 'Type', value: 'type' },
]

interface MobileFileHeaderProps {
  path: string
  mounts?: MountPoint[]
  searchQuery: string
  onSearchChange: (query: string) => void
  searchContent: boolean
  onSearchContentChange: (enabled: boolean) => void
  activeContentType?: string | null
  itemCount: number
  selectedCount: number
  selectionMode: boolean
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  sortBy: SortField
  sortOrder: SortOrder
  onSortChange: (field: SortField, order: SortOrder) => void
  isTrashView?: boolean
  onOpenMenu: () => void
  onStartSelection: () => void
  onRefresh: () => void
  onClearSelection: () => void
  onCopy: () => void
  onCut: () => void
  onDelete: () => void
  onRestore?: () => void
  onEmptyTrash?: () => void
}

function getTitle(path: string, mounts: MountPoint[], activeContentType?: string | null): string {
  if (activeContentType) {
    const labels: Record<string, string> = {
      photos: 'Photos',
      videos: 'Videos',
      gifs: 'GIFs',
      pdfs: 'PDFs',
      audio: 'Audio',
    }
    return labels[activeContentType] || activeContentType
  }

  if (path === '/.deleted_items') return 'Trash'
  if (path === '/') return 'Browse'

  const activeMount = mounts.find(m => path === m.path || path.startsWith(m.path + '/'))
  if (activeMount && path === activeMount.path) return activeMount.name

  return path.split('/').filter(Boolean).pop() || 'Browse'
}

function getSubtitle(path: string, itemCount: number, mounts: MountPoint[], activeContentType?: string | null): string {
  const itemLabel = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`
  if (activeContentType) {
    return `${itemLabel} in ${path === '/' ? 'Home' : path.split('/').filter(Boolean).pop() || 'Home'}`
  }

  const activeMount = mounts.find(m => path === m.path || path.startsWith(m.path + '/'))
  if (activeMount && path !== activeMount.path) {
    return `${activeMount.name} · ${itemLabel}`
  }
  return itemLabel
}

function getNextSortOrder(field: SortField, sortBy: SortField, sortOrder: SortOrder): SortOrder {
  if (field === sortBy) return sortOrder === 'asc' ? 'desc' : 'asc'
  return field === 'modified' ? 'desc' : 'asc'
}

export function MobileFileHeader({
  path,
  mounts = [],
  searchQuery,
  onSearchChange,
  searchContent,
  onSearchContentChange,
  activeContentType,
  itemCount,
  selectedCount,
  selectionMode,
  viewMode,
  onViewModeChange,
  sortBy,
  sortOrder,
  onSortChange,
  isTrashView,
  onOpenMenu,
  onStartSelection,
  onRefresh,
  onClearSelection,
  onCopy,
  onCut,
  onDelete,
  onRestore,
  onEmptyTrash,
}: MobileFileHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const title = useMemo(() => getTitle(path, mounts, activeContentType), [path, mounts, activeContentType])
  const subtitle = useMemo(
    () => getSubtitle(path, itemCount, mounts, activeContentType),
    [path, itemCount, mounts, activeContentType]
  )
  const showSearch = searchOpen || searchQuery.length > 0

  if (selectionMode) {
    return (
      <header className="md:hidden border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-14 items-center gap-1 px-2">
          <Button variant="ghost" size="icon" className="h-11 w-11" onClick={onClearSelection} aria-label="Clear selection">
            <X className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0 px-1">
            <div className="truncate text-base font-semibold">
              {selectedCount > 0 ? `${selectedCount} selected` : 'Select items'}
            </div>
            <div className="text-xs text-muted-foreground">
              {selectedCount > 0 ? 'Choose an action' : 'Tap files to select'}
            </div>
          </div>
          {isTrashView ? (
            <>
              <Button variant="ghost" size="icon" className="h-11 w-11" onClick={onRestore} aria-label="Restore" disabled={selectedCount === 0}>
                <ArchiveRestore className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-11 w-11 text-destructive" onClick={onDelete} aria-label="Delete permanently" disabled={selectedCount === 0}>
                <Trash2 className="h-5 w-5" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="icon" className="h-11 w-11" onClick={onCopy} aria-label="Copy" disabled={selectedCount === 0}>
                <Copy className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-11 w-11" onClick={onCut} aria-label="Cut" disabled={selectedCount === 0}>
                <Scissors className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-11 w-11 text-destructive" onClick={onDelete} aria-label="Delete" disabled={selectedCount === 0}>
                <Trash2 className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>
      </header>
    )
  }

  return (
    <header className="md:hidden border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-14 items-center gap-1 px-2">
        <Button variant="ghost" size="icon" className="h-11 w-11" onClick={onOpenMenu} aria-label="Open navigation">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1 px-1">
          <div className="truncate text-base font-semibold">{title}</div>
          <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-11 w-11', showSearch && 'bg-accent text-accent-foreground')}
          onClick={() => setSearchOpen(open => !open)}
          aria-label="Search files"
        >
          <Search className="h-5 w-5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="More options">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={onStartSelection} disabled={itemCount === 0}>
              <CheckSquare className="mr-2 h-4 w-4" />
              Select
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewModeChange(viewMode === 'grid' ? 'list' : 'grid')}>
              {viewMode === 'grid' ? <List className="mr-2 h-4 w-4" /> : <Grid className="mr-2 h-4 w-4" />}
              {viewMode === 'grid' ? 'List view' : 'Grid view'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSearchContentChange(!searchContent)}>
              <FileText className="mr-2 h-4 w-4" />
              {searchContent ? 'Search filenames' : 'Search file contents'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {sortOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => onSortChange(option.value, getNextSortOrder(option.value, sortBy, sortOrder))}
                className="justify-between"
              >
                <span className="flex items-center">
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  {option.label}
                </span>
                {sortBy === option.value && (
                  sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                )}
              </DropdownMenuItem>
            ))}
            {isTrashView && itemCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={onEmptyTrash}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Empty Trash
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {showSearch && (
        <div className="flex items-center gap-2 px-3 pb-3">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchContent ? 'Search in files...' : 'Search files...'}
              className="h-10 rounded-full bg-muted/50 pl-9 pr-10"
              autoFocus={!searchQuery}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-10 w-10 rounded-full"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Button
            variant={searchContent ? 'default' : 'outline'}
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={() => onSearchContentChange(!searchContent)}
            aria-label="Search file contents"
          >
            {searchContent ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </header>
  )
}
