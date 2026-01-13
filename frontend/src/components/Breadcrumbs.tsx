import { ChevronRight, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BreadcrumbsProps {
  path: string
  onNavigate: (path: string) => void
}

export function Breadcrumbs({ path, onNavigate }: BreadcrumbsProps) {
  const parts = path.split('/').filter(Boolean)

  const handleClick = (index: number) => {
    if (index === -1) {
      onNavigate('/')
    } else {
      const newPath = '/' + parts.slice(0, index + 1).join('/')
      onNavigate(newPath)
    }
  }

  return (
    <nav className="flex items-center gap-1 text-sm overflow-x-auto py-2 px-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 shrink-0"
        onClick={() => handleClick(-1)}
      >
        <Home className="h-4 w-4" />
      </Button>

      {parts.map((part, index) => (
        <div key={index} className="flex items-center gap-1 shrink-0">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-2 max-w-[200px] truncate ${
              index === parts.length - 1 ? 'font-semibold' : ''
            }`}
            onClick={() => handleClick(index)}
          >
            {part}
          </Button>
        </div>
      ))}
    </nav>
  )
}
