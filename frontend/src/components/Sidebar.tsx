import { FileText, Image, Video, Star, Home, FolderOpen, Music, FileImage, Film, FileType, HardDrive, FolderCog, Folder, X } from 'lucide-react'
import type { MountPoint } from '@/api/client'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

interface SidebarItem {
  name: string
  path: string
  icon: React.ReactNode
}

interface ContentTypeItem {
  name: string
  type: string
  icon: React.ReactNode
  extensions: string[]
}

interface SidebarProps {
  currentPath: string
  onNavigate: (path: string) => void
  favorites?: string[]
  onRemoveFavorite?: (path: string) => void
  activeContentType?: string | null
  onContentTypeChange?: (type: string | null) => void
  mounts?: MountPoint[]
}

const mountIconMap: Record<string, React.ReactNode> = {
  'hard-drive': <HardDrive className="h-4 w-4" />,
  'folder-cog': <FolderCog className="h-4 w-4" />,
  'folder': <Folder className="h-4 w-4" />,
}

function getMountIcon(iconName?: string): React.ReactNode {
  return mountIconMap[iconName || 'folder'] || <HardDrive className="h-4 w-4" />
}

const mainFolders: SidebarItem[] = [
  { name: 'Home', path: '/', icon: <Home className="h-4 w-4" /> },
  { name: 'Documents', path: '/Documents', icon: <FileText className="h-4 w-4" /> },
  { name: 'Downloads', path: '/Downloads', icon: <FolderOpen className="h-4 w-4" /> },
  { name: 'Pictures', path: '/Pictures', icon: <Image className="h-4 w-4" /> },
  { name: 'Videos', path: '/Videos', icon: <Video className="h-4 w-4" /> },
  { name: 'Music', path: '/Music', icon: <Music className="h-4 w-4" /> },
]

const contentTypes: ContentTypeItem[] = [
  { name: 'Photos', type: 'photos', icon: <FileImage className="h-4 w-4" />, extensions: ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.raw', '.cr2', '.nef'] },
  { name: 'Videos', type: 'videos', icon: <Film className="h-4 w-4" />, extensions: ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'] },
  { name: 'GIFs', type: 'gifs', icon: <Image className="h-4 w-4" />, extensions: ['.gif'] },
  { name: 'PDFs', type: 'pdfs', icon: <FileType className="h-4 w-4" />, extensions: ['.pdf'] },
  { name: 'Audio', type: 'audio', icon: <Music className="h-4 w-4" />, extensions: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'] },
]

export function Sidebar({
  currentPath,
  onNavigate,
  favorites = [],
  onRemoveFavorite,
  activeContentType,
  onContentTypeChange,
  mounts = [],
}: SidebarProps) {
  return (
    <div className="w-52 border-r bg-muted/30 flex flex-col">
      <ScrollArea className="flex-1">
        <div className="p-3">
          {/* Favorites - on top */}
          <div className="mb-6">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-2">
              Favorites
            </h3>
            <nav className="space-y-0.5">
              {favorites.length === 0 ? (
                <p className="text-xs text-muted-foreground px-2 py-1">
                  No favorites yet
                </p>
              ) : (
                favorites.map((path) => {
                  const name = path.split('/').pop() || path
                  return (
                    <div
                      key={path}
                      className={cn(
                        'group w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                        'hover:bg-accent hover:text-accent-foreground',
                        currentPath === path && !activeContentType
                          ? 'bg-accent text-accent-foreground font-medium'
                          : 'text-muted-foreground'
                      )}
                    >
                      <button
                        onClick={() => {
                          onContentTypeChange?.(null)
                          onNavigate(path)
                        }}
                        className="flex items-center gap-2 flex-1 min-w-0"
                      >
                        <Star className="h-4 w-4 shrink-0" />
                        <span className="truncate">{name}</span>
                      </button>
                      {onRemoveFavorite && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemoveFavorite(path)
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/20 hover:text-destructive transition-opacity"
                          title="Remove from favorites"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </nav>
          </div>

          {/* Main Folders */}
          <div className="mb-6">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-2">
              Main Folders
            </h3>
            <nav className="space-y-0.5">
              {mainFolders.map((item) => (
                <button
                  key={item.path}
                  onClick={() => {
                    onContentTypeChange?.(null)
                    onNavigate(item.path)
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    (currentPath === item.path || currentPath.startsWith(item.path + '/')) && !activeContentType
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground'
                  )}
                >
                  {item.icon}
                  <span>{item.name}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Mounts */}
          {mounts.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-2">
                Mounts
              </h3>
              <nav className="space-y-0.5">
                {mounts.map((mount) => (
                  <button
                    key={mount.path}
                    onClick={() => {
                      onContentTypeChange?.(null)
                      onNavigate(mount.path)
                    }}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      (currentPath === mount.path || currentPath.startsWith(mount.path + '/')) && !activeContentType
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'text-muted-foreground'
                    )}
                  >
                    {getMountIcon(mount.icon)}
                    <span className="truncate">{mount.name}</span>
                  </button>
                ))}
              </nav>
            </div>
          )}

          {/* Content Type */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-2">
              Content Type
            </h3>
            <nav className="space-y-0.5">
              {contentTypes.map((item) => (
                <button
                  key={item.type}
                  onClick={() => onContentTypeChange?.(activeContentType === item.type ? null : item.type)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    activeContentType === item.type
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground'
                  )}
                >
                  {item.icon}
                  <span>{item.name}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      </ScrollArea>

      {/* Logo at bottom */}
      <div className="border-t p-3">
        <div className="flex items-center gap-2 px-2 text-muted-foreground">
          <FolderOpen className="h-5 w-5 text-primary" />
          <span className="font-semibold">FilaMama</span>
        </div>
      </div>
    </div>
  )
}

// Export content types for use in filtering
export { contentTypes }
export type { ContentTypeItem }
