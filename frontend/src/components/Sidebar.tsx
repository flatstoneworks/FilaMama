import { FileText, Image, Video, Star, Home, FolderOpen, Music, FileImage, Film, FileType, HardDrive, FolderCog, Folder, X, Trash2 } from 'lucide-react'
import type { MountPoint, AppConfig } from '@/api/client'
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
  contentTypes?: AppConfig['content_types']
  trashCount?: number
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

// Default extension lists (used when server config is not yet loaded)
const defaultExtensions: Record<string, string[]> = {
  photos: ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.raw', '.cr2', '.nef'],
  videos: ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.flv', '.wmv'],
  gifs: ['.gif'],
  pdfs: ['.pdf'],
  audio: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma', '.opus'],
}

// Display metadata for content types (icons and labels)
const contentTypeDisplay: { name: string; type: string; icon: React.ReactNode }[] = [
  { name: 'Photos', type: 'photos', icon: <FileImage className="h-4 w-4" /> },
  { name: 'Videos', type: 'videos', icon: <Film className="h-4 w-4" /> },
  { name: 'GIFs', type: 'gifs', icon: <Image className="h-4 w-4" /> },
  { name: 'PDFs', type: 'pdfs', icon: <FileType className="h-4 w-4" /> },
  { name: 'Audio', type: 'audio', icon: <Music className="h-4 w-4" /> },
]

function buildContentTypes(serverTypes?: Record<string, string[]>): ContentTypeItem[] {
  return contentTypeDisplay.map(item => ({
    ...item,
    extensions: serverTypes?.[item.type] || defaultExtensions[item.type] || [],
  }))
}

const contentTypes: ContentTypeItem[] = buildContentTypes()

export function Sidebar({
  currentPath,
  onNavigate,
  favorites = [],
  onRemoveFavorite,
  activeContentType,
  onContentTypeChange,
  mounts = [],
  contentTypes: serverContentTypes,
  trashCount = 0,
}: SidebarProps) {
  const resolvedContentTypes = serverContentTypes
    ? buildContentTypes(serverContentTypes)
    : contentTypes
  return (
    <nav aria-label="File browser navigation" className="border-r bg-muted/30 flex flex-col" style={{ width: 'var(--sidebar-width)' }}>
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
                  Right-click a folder to add
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
              <button
                onClick={() => {
                  onContentTypeChange?.(null)
                  onNavigate('/.deleted_items')
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  currentPath === '/.deleted_items' && !activeContentType
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground'
                )}
              >
                <Trash2 className="h-4 w-4" />
                <span>Trash</span>
                {trashCount > 0 && (
                  <span className="ml-auto text-xs bg-muted-foreground/20 text-muted-foreground rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                    {trashCount}
                  </span>
                )}
              </button>
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
              File Types
            </h3>
            <nav className="space-y-0.5">
              {resolvedContentTypes.map((item) => (
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
    </nav>
  )
}

// Export content types for use in filtering
export { contentTypes }
export type { ContentTypeItem }
