import { Search, X, ChevronRight, Home } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  path: string
  onNavigate: (path: string) => void
  searchQuery: string
  onSearchChange: (query: string) => void
}

export function Header({ path, onNavigate, searchQuery, onSearchChange }: HeaderProps) {
  const parts = path.split('/').filter(Boolean)

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      onNavigate('/')
    } else {
      const newPath = '/' + parts.slice(0, index + 1).join('/')
      onNavigate(newPath)
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
          onClick={() => handleBreadcrumbClick(-1)}
        >
          <Home className="h-4 w-4" />
        </Button>

        {parts.map((part, index) => (
          <div key={index} className="flex items-center gap-0.5 shrink-0">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 px-2 max-w-[200px] truncate ${
                index === parts.length - 1 ? 'font-semibold' : ''
              }`}
              onClick={() => handleBreadcrumbClick(index)}
            >
              {part}
            </Button>
          </div>
        ))}
      </nav>

      {/* Search */}
      <div className="relative w-72 shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search files..."
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
    </header>
  )
}
