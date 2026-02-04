import { Search, X, ChevronRight, Home, HardDrive, FileText } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { MountPoint } from '@/api/client'

interface HeaderProps {
  path: string
  onNavigate: (path: string) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  searchContent?: boolean
  onSearchContentChange?: (enabled: boolean) => void
  mounts?: MountPoint[]
}

export function Header({ path, onNavigate, searchQuery, onSearchChange, searchContent = false, onSearchContentChange, mounts = [] }: HeaderProps) {
  // Check if current path is within a mount
  const activeMount = mounts.find(m => path === m.path || path.startsWith(m.path + '/'))

  // Build breadcrumb parts
  let breadcrumbParts: { label: string; path: string; isMount?: boolean }[] = []

  if (activeMount) {
    // For mounted paths: show mount name, then subfolders
    breadcrumbParts.push({ label: activeMount.name, path: activeMount.path, isMount: true })

    // Add subfolders within the mount
    const relativePath = path.slice(activeMount.path.length)
    const subParts = relativePath.split('/').filter(Boolean)
    let currentPath = activeMount.path
    for (const part of subParts) {
      currentPath += '/' + part
      breadcrumbParts.push({ label: part, path: currentPath })
    }
  } else {
    // Normal path: split into parts
    const parts = path.split('/').filter(Boolean)
    let currentPath = ''
    for (const part of parts) {
      currentPath += '/' + part
      breadcrumbParts.push({ label: part, path: currentPath })
    }
  }

  return (
    <header className="h-12 border-b bg-background flex items-center px-3 gap-4">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-0.5 text-sm flex-1 min-w-0 overflow-x-auto">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 shrink-0"
          onClick={() => onNavigate('/')}
        >
          <Home className="h-4 w-4" />
        </Button>

        {breadcrumbParts.map((part, index) => (
          <div key={part.path} className="flex items-center gap-0.5 shrink-0">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 px-2 max-w-[200px] truncate ${
                index === breadcrumbParts.length - 1 ? 'font-semibold' : ''
              }`}
              onClick={() => onNavigate(part.path)}
            >
              {part.isMount && <HardDrive className="h-3.5 w-3.5 mr-1.5" />}
              {part.label}
            </Button>
          </div>
        ))}
      </nav>

      {/* Search */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchContent ? "Search in files..." : "Search files..."}
            className="pl-9 pr-9 h-8 bg-muted/50"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-8 w-8"
              onClick={() => onSearchChange('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {onSearchContentChange && (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onSearchContentChange(!searchContent)}
                  className={cn(
                    "h-8 w-8",
                    searchContent && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                  )}
                  aria-label="Search file contents"
                >
                  <FileText className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{searchContent ? "Searching file contents (click to search filenames)" : "Search file contents"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </header>
  )
}
