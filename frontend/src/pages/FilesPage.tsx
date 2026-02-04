import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type FileInfo, type SearchResult, type ContentSearchResult } from '@/api/client'
import { useFileSelection } from '@/hooks/useFileSelection'
import { useDebounce } from '@/hooks/useDebounce'
import { useScrollRestoration } from '@/hooks/useScrollRestoration'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Toolbar, type ViewMode } from '@/components/Toolbar'
import { FileGrid } from '@/components/FileGrid'
import { FileList } from '@/components/FileList'
import { ContentSearchResults } from '@/components/ContentSearchResults'
import { isAudioFile } from '@/components/FileIcon'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'
import { UploadDropzone } from '@/components/UploadDropzone'
import { UploadProgress, type UploadItem } from '@/components/UploadProgress'
import { RenameDialog } from '@/components/RenameDialog'
import { NewFolderDialog } from '@/components/NewFolderDialog'
import { DeleteDialog } from '@/components/DeleteDialog'
import { ConflictDialog, type ConflictResolution } from '@/components/ConflictDialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from '@/components/ui/use-toast'
import { Loader2, X, FolderSearch, FileText, AlertTriangle } from 'lucide-react'
import { joinPath } from '@/lib/utils'

interface ClipboardState {
  files: FileInfo[]
  operation: 'copy' | 'cut'
  sourcePath: string
}

// Maximum files to display without virtualization to prevent performance issues
const MAX_DISPLAY_FILES = 1000

export function FilesPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const scrollViewportRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  // Derive currentPath from URL: /browse/home/user → /home/user
  // Decode URI components to handle spaces and special characters in folder names
  const currentPath = useMemo(() => {
    const path = decodeURIComponent(location.pathname).replace(/^\/browse/, '') || '/'
    return path === '' ? '/' : path
  }, [location.pathname])

  // URL-backed state - read from URL parameters
  const viewMode = (searchParams.get('view') as ViewMode) || 'grid'
  const gridSize = parseInt(searchParams.get('size') || '120')
  const searchQuery = searchParams.get('search') || ''
  const activeContentType = searchParams.get('filter') || null
  const contentSearchMode = searchParams.get('content') === 'true'

  // Helper to update URL parameters
  const updateUrlParam = useCallback((key: string, value: string | null) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev)
      if (value === null || value === '') {
        newParams.delete(key)
      } else {
        newParams.set(key, value)
      }
      return newParams
    }, { replace: true })
  }, [setSearchParams])

  // Setters that update URL
  const setViewMode = useCallback((mode: ViewMode) => {
    updateUrlParam('view', mode === 'grid' ? null : mode)
  }, [updateUrlParam])

  const setGridSize = useCallback((size: number) => {
    updateUrlParam('size', size === 120 ? null : size.toString())
  }, [updateUrlParam])

  const setSearchQuery = useCallback((query: string) => {
    updateUrlParam('search', query)
  }, [updateUrlParam])

  const setActiveContentType = useCallback((type: string | null) => {
    updateUrlParam('filter', type)
  }, [updateUrlParam])

  const setContentSearchMode = useCallback((enabled: boolean) => {
    updateUrlParam('content', enabled ? 'true' : null)
  }, [updateUrlParam])

  // Non-URL state (transient, doesn't need to be bookmarkable)
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [isPreparingUpload, setIsPreparingUpload] = useState(false)

  // Favorites (persisted to localStorage)
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('filamama-favorites')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  // Persist favorites to localStorage
  useEffect(() => {
    localStorage.setItem('filamama-favorites', JSON.stringify(favorites))
  }, [favorites])

  // Global audio player
  const { playTrack, isOpen: isPlayerOpen } = useAudioPlayer()

  // Scroll restoration
  useScrollRestoration(scrollViewportRef)

  // Focused file index for keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)

  // Dialogs
  const [renameFile, setRenameFile] = useState<FileInfo | null>(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [deleteFiles, setDeleteFiles] = useState<FileInfo[]>([])
  const [conflictFiles, setConflictFiles] = useState<string[]>([])  // Filenames that have conflicts

  // Fetch config (for mounts)
  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: () => api.getConfig(),
    staleTime: Infinity,
  })

  // Fetch files
  const { data: listing, isLoading: isLoadingDir, error } = useQuery({
    queryKey: ['files', currentPath],
    queryFn: () => api.listDirectory(currentPath),
  })

  const files = listing?.files || []

  // Debounce search query to avoid excessive API calls
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  // UI mode flags (use non-debounced for immediate UI response when navigating back)
  // These determine which UI to show
  const isFilenameSearchMode = (!!searchQuery || !!activeContentType) && !contentSearchMode
  const isContentSearchMode = !!searchQuery && contentSearchMode && searchQuery.length >= 2

  // API query flags (use debounced to avoid excessive API calls while typing)
  const isFilenameSearchReady = (!!debouncedSearchQuery || !!activeContentType) && !contentSearchMode
  const isContentSearchReady = !!debouncedSearchQuery && contentSearchMode && debouncedSearchQuery.length >= 2

  // Recursive filename search
  const { data: searchResponse, isLoading: isSearching } = useQuery({
    queryKey: ['recursive-search', debouncedSearchQuery, activeContentType, currentPath],
    queryFn: () => api.searchFiles({
      query: debouncedSearchQuery || undefined,
      contentType: activeContentType || undefined,
      path: currentPath,
      maxResults: 500,
    }),
    enabled: isFilenameSearchReady,
  })

  // Content search - search inside files
  const { data: contentSearchResponse, isLoading: isContentSearching } = useQuery({
    queryKey: ['content-search', debouncedSearchQuery, currentPath],
    queryFn: () => api.searchContent({
      query: debouncedSearchQuery,
      path: currentPath,
      maxFiles: 100,
      maxDepth: 3,
    }),
    enabled: isContentSearchReady,
  })

  const searchResults = searchResponse?.results
  const searchHasMore = searchResponse?.has_more ?? false
  const searchTotalScanned = searchResponse?.total_scanned ?? 0

  const contentSearchResults = contentSearchResponse?.results
  const contentSearchFilesSearched = contentSearchResponse?.files_searched ?? 0
  const contentSearchFilesWithMatches = contentSearchResponse?.files_with_matches ?? 0
  const contentSearchHasMore = contentSearchResponse?.has_more ?? false

  // Combined flags for UI (used for determining which view to show)
  const isFilenameSearchActive = isFilenameSearchMode
  const isContentSearchActive = isContentSearchMode

  const isSearchActive = isFilenameSearchActive || isContentSearchActive
  const isLoading = isLoadingDir || (isFilenameSearchActive && isSearching) || (isContentSearchActive && isContentSearching)

  // Reset focused index when path or search changes
  useEffect(() => {
    setFocusedIndex(-1)
  }, [currentPath, isSearchActive])

  // Navigate to preview page
  const openPreview = useCallback((file: FileInfo) => {
    // Use file.path directly - it already contains the full path
    const previewPath = file.path
    // Encode each path segment for URL
    const encodedPath = previewPath.split('/').map(s => encodeURIComponent(s)).join('/')
    navigate(`/view${encodedPath}`)
  }, [navigate])

  // State for showing all files (overriding the limit)
  const [showAllFiles, setShowAllFiles] = useState(false)

  // Reset showAllFiles when path changes
  useEffect(() => {
    setShowAllFiles(false)
  }, [currentPath])

  // Convert filename search results to FileInfo format
  const searchResultsAsFiles: FileInfo[] = useMemo(() => {
    if (!searchResults) return []
    const thumbnailExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.mov', '.avi', '.mkv', '.webm']
    return searchResults.map((r: SearchResult) => {
      const ext = r.name.includes('.') ? '.' + r.name.split('.').pop()?.toLowerCase() : ''
      const hasThumbnail = r.type === 'file' && thumbnailExtensions.includes(ext)
      return {
        name: r.name,
        path: r.path,
        type: r.type,
        size: r.size,
        modified: r.modified,
        is_hidden: false,
        has_thumbnail: hasThumbnail,
        thumbnail_url: hasThumbnail ? api.getThumbnailUrl(r.path) : undefined,
        is_directory: r.type === 'directory',
        extension: ext ? ext.slice(1) : undefined,
      }
    })
  }, [searchResults])

  // Convert content search results to FileInfo format (with matches stored for display)
  const contentSearchResultsAsFiles: (FileInfo & { contentMatches?: ContentSearchResult['matches'] })[] = useMemo(() => {
    if (!contentSearchResults) return []
    const thumbnailExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.mov', '.avi', '.mkv', '.webm']
    return contentSearchResults.map((r: ContentSearchResult) => {
      const ext = r.name.includes('.') ? '.' + r.name.split('.').pop()?.toLowerCase() : ''
      const hasThumbnail = r.type === 'file' && thumbnailExtensions.includes(ext)
      return {
        name: r.name,
        path: r.path,
        type: r.type,
        size: r.size,
        modified: r.modified,
        is_hidden: false,
        has_thumbnail: hasThumbnail,
        thumbnail_url: hasThumbnail ? api.getThumbnailUrl(r.path) : undefined,
        is_directory: r.type === 'directory',
        extension: ext ? ext.slice(1) : undefined,
        contentMatches: r.matches,
      }
    })
  }, [contentSearchResults])

  // Use search results when search is active, otherwise show directory listing
  const filteredFiles = useMemo(() => {
    // Use content search results
    if (isContentSearchActive) {
      return contentSearchResultsAsFiles
    }
    // Use filename search results
    if (isFilenameSearchActive) {
      return searchResultsAsFiles
    }
    return files
  }, [files, isFilenameSearchActive, isContentSearchActive, searchResultsAsFiles, contentSearchResultsAsFiles])

  // Limit displayed files for performance (unless user explicitly wants all)
  const displayedFiles = useMemo(() => {
    if (showAllFiles || filteredFiles.length <= MAX_DISPLAY_FILES) {
      return filteredFiles
    }
    return filteredFiles.slice(0, MAX_DISPLAY_FILES)
  }, [filteredFiles, showAllFiles])

  const hasMoreFiles = filteredFiles.length > MAX_DISPLAY_FILES && !showAllFiles
  const hiddenFilesCount = filteredFiles.length - MAX_DISPLAY_FILES

  // Selection (based on displayed files only)
  const { selectedFiles, selectFile, clearSelection } = useFileSelection(displayedFiles)

  // Mutations
  const renameMutation = useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) =>
      api.rename(joinPath(currentPath, oldName), joinPath(currentPath, newName)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', currentPath] })
      setRenameFile(null)
      toast({ title: 'Renamed successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to rename', variant: 'destructive' })
    },
  })

  const createFolderMutation = useMutation({
    mutationFn: (name: string) => api.createFolder(joinPath(currentPath, name)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', currentPath] })
      setShowNewFolder(false)
      toast({ title: 'Folder created' })
    },
    onError: () => {
      toast({ title: 'Failed to create folder', variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (files: FileInfo[]) => {
      for (const file of files) {
        await api.delete(joinPath(currentPath, file.name))
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', currentPath] })
      setDeleteFiles([])
      clearSelection()
      toast({ title: 'Deleted successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to delete', variant: 'destructive' })
    },
  })

  // Execute paste with a specific conflict resolution
  const executePaste = async (resolution: ConflictResolution) => {
    if (!clipboard) return

    const overwrite = resolution === 'replace'
    const skipConflicts = resolution === 'skip'

    for (const file of clipboard.files) {
      const srcPath = joinPath(clipboard.sourcePath, file.name)
      const destPath = joinPath(currentPath, file.name)

      // Skip this file if user chose to skip conflicts and this file conflicts
      if (skipConflicts && conflictFiles.includes(file.name)) {
        continue
      }

      if (clipboard.operation === 'copy') {
        await api.copy(srcPath, destPath, overwrite)
      } else {
        await api.move(srcPath, destPath, overwrite)
      }
    }
  }

  const pasteMutation = useMutation({
    mutationFn: async (resolution?: ConflictResolution) => {
      if (!clipboard) return

      // If no resolution provided, check for conflicts first
      if (!resolution) {
        const sourcePaths = clipboard.files.map(f => joinPath(clipboard.sourcePath, f.name))
        const conflicts = await api.checkConflicts(sourcePaths, currentPath)

        if (conflicts.length > 0) {
          // Extract just the filenames from the conflict paths
          const conflictNames = conflicts.map(p => p.split('/').pop() || '')
          setConflictFiles(conflictNames)
          return // Don't proceed, dialog will handle it
        }
      }

      // No conflicts or resolution provided - execute paste
      await executePaste(resolution || 'rename')
    },
    onSuccess: (_, resolution) => {
      // Only show success if we actually did the paste (resolution was provided or no conflicts)
      if (resolution || conflictFiles.length === 0) {
        queryClient.invalidateQueries({ queryKey: ['files'] })
        if (clipboard?.operation === 'cut') {
          setClipboard(null)
        }
        toast({ title: clipboard?.operation === 'copy' ? 'Copied' : 'Moved' })
        setConflictFiles([])
      }
    },
    onError: () => {
      toast({ title: 'Operation failed', variant: 'destructive' })
      setConflictFiles([])
    },
  })

  // Handle conflict resolution from dialog
  const handleConflictResolution = (resolution: ConflictResolution) => {
    setConflictFiles([])
    if (resolution !== 'cancel') {
      pasteMutation.mutate(resolution)
    }
  }

  // Handlers
  // Helper to encode path for URL (encode each segment, preserve slashes)
  const encodePathForUrl = (path: string) => {
    return path.split('/').map(segment => encodeURIComponent(segment)).join('/')
  }

  const handleNavigate = (path: string) => {
    // Convert filesystem path to URL: /home/user → /browse/home/user
    // Encode path segments to handle spaces and special characters
    const encodedPath = encodePathForUrl(path)
    const urlPath = path === '/' ? '/browse' : `/browse${encodedPath}`

    // Preserve view settings but clear search/filter/preview
    const newParams = new URLSearchParams()
    const currentView = searchParams.get('view')
    const currentSize = searchParams.get('size')

    if (currentView) newParams.set('view', currentView)
    if (currentSize) newParams.set('size', currentSize)

    const fullUrl = newParams.toString() ? `${urlPath}?${newParams.toString()}` : urlPath
    navigate(fullUrl)
    clearSelection()
  }

  const handleOpen = (file: FileInfo) => {
    if (file.is_directory) {
      // Use file.path directly - it contains the full path
      handleNavigate(file.path)
    } else if (isAudioFile(file.name)) {
      // For audio files, play using global audio player with all audio files as playlist
      playTrack(file, displayedFiles)
    } else {
      openPreview(file)
    }
  }

  const handleCopy = (files: FileInfo[]) => {
    setClipboard({ files, operation: 'copy', sourcePath: currentPath })
    toast({ title: `${files.length} item(s) copied to clipboard` })
  }

  const handleCut = (files: FileInfo[]) => {
    setClipboard({ files, operation: 'cut', sourcePath: currentPath })
    toast({ title: `${files.length} item(s) cut to clipboard` })
  }

  const handleDownload = (file: FileInfo) => {
    const link = document.createElement('a')
    link.href = `/api/files/download?path=${encodeURIComponent(joinPath(currentPath, file.name))}`
    link.download = file.name
    link.click()
  }

  const handleMove = async (filesToMove: FileInfo[], targetFolder: FileInfo) => {
    try {
      const targetPath = joinPath(currentPath, targetFolder.name)
      for (const file of filesToMove) {
        const sourcePath = joinPath(currentPath, file.name)
        const destPath = joinPath(targetPath, file.name)
        await api.move(sourcePath, destPath)
      }
      queryClient.invalidateQueries({ queryKey: ['files'] })
      clearSelection()
      toast({ title: `Moved ${filesToMove.length} item(s)` })
    } catch (error) {
      toast({ title: 'Failed to move files', variant: 'destructive' })
    }
  }

  // Favorites management
  const addToFavorites = useCallback((path: string) => {
    setFavorites(prev => {
      if (prev.includes(path)) return prev
      return [...prev, path]
    })
    const name = path.split('/').pop() || path
    toast({ title: `Added "${name}" to favorites` })
  }, [])

  const removeFromFavorites = useCallback((path: string) => {
    setFavorites(prev => prev.filter(p => p !== path))
    const name = path.split('/').pop() || path
    toast({ title: `Removed "${name}" from favorites` })
  }, [])

  const isFavorite = useCallback((path: string) => {
    return favorites.includes(path)
  }, [favorites])

  // Parallel upload configuration
  const CONCURRENT_UPLOADS = 3

  const handleUpload = useCallback(
    async (fileList: FileList | File[]) => {
      const filesArray = Array.isArray(fileList) ? fileList : Array.from(fileList)

      // Client-side size validation
      const maxSizeBytes = (config?.max_upload_size_mb || 1024) * 1024 * 1024
      const oversizedFiles = filesArray.filter(f => f.size > maxSizeBytes)
      if (oversizedFiles.length > 0) {
        const sizeLimit = config?.max_upload_size_mb || 1024
        toast({
          title: `${oversizedFiles.length} file(s) exceed size limit`,
          description: `Maximum file size is ${sizeLimit} MB. Oversized files will be skipped.`,
          variant: 'destructive',
        })
      }

      // Filter out oversized files
      const validFiles = filesArray.filter(f => f.size <= maxSizeBytes)
      if (validFiles.length === 0) {
        setIsPreparingUpload(false)
        return
      }

      // Show upload panel immediately with all files
      const newUploads: UploadItem[] = validFiles.map((file) => ({
        id: Math.random().toString(36).slice(2),
        name: (file as any).customRelativePath || (file as any).webkitRelativePath || file.name,
        progress: 0,
        status: 'pending' as const,
        file: file, // Store file for retry
        relativePath: (file as any).customRelativePath || (file as any).webkitRelativePath || '',
        totalBytes: file.size,
        bytesUploaded: 0,
      }))

      // Add all files to the upload list immediately so user sees them
      setUploads((prev) => [...prev, ...newUploads])
      setIsPreparingUpload(false)

      // Upload files in parallel batches
      const uploadSingleFile = async (uploadItem: UploadItem, file: File) => {
        const relativePath = uploadItem.relativePath || ''
        let lastBytesUploaded = 0
        let lastTimestamp = Date.now()

        try {
          setUploads((prev) =>
            prev.map((u) => (u.id === uploadItem.id ? { ...u, status: 'uploading', startTime: Date.now() } : u))
          )

          await api.uploadFile(file, currentPath, (progress) => {
            const now = Date.now()
            const timeDelta = (now - lastTimestamp) / 1000 // seconds
            const bytesDelta = progress.bytesUploaded - lastBytesUploaded
            const speed = timeDelta > 0 ? bytesDelta / timeDelta : 0

            lastBytesUploaded = progress.bytesUploaded
            lastTimestamp = now

            setUploads((prev) =>
              prev.map((u) => (u.id === uploadItem.id ? {
                ...u,
                progress: progress.percent,
                bytesUploaded: progress.bytesUploaded,
                totalBytes: progress.totalBytes,
                speed: speed > 0 ? speed : u.speed, // Keep last valid speed if current is 0
              } : u))
            )
          }, relativePath)

          setUploads((prev) =>
            prev.map((u) =>
              u.id === uploadItem.id ? { ...u, status: 'completed', progress: 100 } : u
            )
          )
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Upload failed'
          setUploads((prev) =>
            prev.map((u) =>
              u.id === uploadItem.id
                ? { ...u, status: 'error', error: errorMessage }
                : u
            )
          )
        }
      }

      // Process files in parallel batches
      const processInBatches = async () => {
        for (let i = 0; i < validFiles.length; i += CONCURRENT_UPLOADS) {
          const batch = validFiles.slice(i, i + CONCURRENT_UPLOADS)
          const batchUploads = newUploads.slice(i, i + CONCURRENT_UPLOADS)
          await Promise.all(
            batch.map((file, idx) => uploadSingleFile(batchUploads[idx], file))
          )
        }
      }

      await processInBatches()
      queryClient.invalidateQueries({ queryKey: ['files', currentPath] })
    },
    [currentPath, queryClient, config?.max_upload_size_mb]
  )

  const handleRetry = useCallback(
    async (item: UploadItem) => {
      if (!item.file) return

      // Reset the upload item status
      setUploads((prev) =>
        prev.map((u) => (u.id === item.id ? {
          ...u,
          status: 'pending' as const,
          progress: 0,
          error: undefined,
          bytesUploaded: 0,
          speed: undefined,
        } : u))
      )

      const file = item.file
      const relativePath = item.relativePath || ''
      let lastBytesUploaded = 0
      let lastTimestamp = Date.now()

      try {
        setUploads((prev) =>
          prev.map((u) => (u.id === item.id ? { ...u, status: 'uploading', startTime: Date.now() } : u))
        )

        await api.uploadFile(file, currentPath, (progress) => {
          const now = Date.now()
          const timeDelta = (now - lastTimestamp) / 1000
          const bytesDelta = progress.bytesUploaded - lastBytesUploaded
          const speed = timeDelta > 0 ? bytesDelta / timeDelta : 0

          lastBytesUploaded = progress.bytesUploaded
          lastTimestamp = now

          setUploads((prev) =>
            prev.map((u) => (u.id === item.id ? {
              ...u,
              progress: progress.percent,
              bytesUploaded: progress.bytesUploaded,
              totalBytes: progress.totalBytes,
              speed: speed > 0 ? speed : u.speed,
            } : u))
          )
        }, relativePath)

        setUploads((prev) =>
          prev.map((u) =>
            u.id === item.id ? { ...u, status: 'completed', progress: 100 } : u
          )
        )
        queryClient.invalidateQueries({ queryKey: ['files', currentPath] })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Upload failed'
        setUploads((prev) =>
          prev.map((u) =>
            u.id === item.id
              ? { ...u, status: 'error', error: errorMessage }
              : u
          )
        )
      }
    },
    [currentPath, queryClient]
  )

  const dismissUpload = (id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id))
  }

  const dismissAllUploads = () => {
    setUploads([])
    setIsPreparingUpload(false)
  }

  const selectedFilesList = files.filter((f) => selectedFiles.has(f.path))

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input, textarea, or contenteditable element
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return
      }

      // Ctrl/Cmd + A: Select all (displayed files only)
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        displayedFiles.forEach((file) => selectFile(file, { ctrlKey: true } as React.MouseEvent))
      }

      // Ctrl/Cmd + C: Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedFilesList.length > 0) {
        e.preventDefault()
        handleCopy(selectedFilesList)
      }

      // Ctrl/Cmd + X: Cut
      if ((e.ctrlKey || e.metaKey) && e.key === 'x' && selectedFilesList.length > 0) {
        e.preventDefault()
        handleCut(selectedFilesList)
      }

      // Ctrl/Cmd + V: Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboard) {
        e.preventDefault()
        pasteMutation.mutate(undefined)
      }

      // Delete: Delete selected files
      if (e.key === 'Delete' && selectedFilesList.length > 0) {
        e.preventDefault()
        setDeleteFiles(selectedFilesList)
      }

      // Enter: Open selected file (if only one is selected)
      if (e.key === 'Enter' && selectedFilesList.length === 1) {
        e.preventDefault()
        handleOpen(selectedFilesList[0])
      }

      // Escape: Clear selection
      if (e.key === 'Escape') {
        e.preventDefault()
        clearSelection()
        setSearchQuery('')
      }

      // F2: Rename selected file (if only one is selected)
      if (e.key === 'F2' && selectedFilesList.length === 1) {
        e.preventDefault()
        setRenameFile(selectedFilesList[0])
      }

      // Backspace: Navigate to parent directory
      if (e.key === 'Backspace' && currentPath !== '/') {
        e.preventDefault()
        const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/'
        handleNavigate(parentPath)
      }

      // Arrow key navigation
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && displayedFiles.length > 0) {
        e.preventDefault()

        // Calculate grid columns based on container width and grid size
        // For list view, treat as single column
        const columns = viewMode === 'list' ? 1 : Math.max(1, Math.floor((window.innerWidth - 208) / (gridSize + 8)))

        let newIndex = focusedIndex
        if (focusedIndex === -1) {
          // If nothing focused, start at first item
          newIndex = 0
        } else {
          switch (e.key) {
            case 'ArrowUp':
              newIndex = Math.max(0, focusedIndex - columns)
              break
            case 'ArrowDown':
              newIndex = Math.min(displayedFiles.length - 1, focusedIndex + columns)
              break
            case 'ArrowLeft':
              if (viewMode === 'grid') {
                newIndex = Math.max(0, focusedIndex - 1)
              }
              break
            case 'ArrowRight':
              if (viewMode === 'grid') {
                newIndex = Math.min(displayedFiles.length - 1, focusedIndex + 1)
              }
              break
          }
        }

        setFocusedIndex(newIndex)

        // Shift+Arrow: extend selection
        if (e.shiftKey && newIndex !== focusedIndex) {
          selectFile(displayedFiles[newIndex], { shiftKey: true, ctrlKey: false } as React.MouseEvent)
        } else if (!e.shiftKey && !e.ctrlKey) {
          // Plain arrow: select only the focused item
          clearSelection()
          selectFile(displayedFiles[newIndex], { ctrlKey: true } as React.MouseEvent)
        }
      }

      // Space: toggle selection of focused item
      if (e.key === ' ' && focusedIndex >= 0 && focusedIndex < displayedFiles.length) {
        e.preventDefault()
        selectFile(displayedFiles[focusedIndex], { ctrlKey: true } as React.MouseEvent)
      }

      // Enter with focused item (no selection): open focused item
      if (e.key === 'Enter' && selectedFilesList.length === 0 && focusedIndex >= 0) {
        e.preventDefault()
        handleOpen(displayedFiles[focusedIndex])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    displayedFiles,
    selectedFilesList,
    clipboard,
    currentPath,
    selectFile,
    clearSelection,
    handleCopy,
    handleCut,
    handleOpen,
    handleNavigate,
    pasteMutation,
    focusedIndex,
    viewMode,
    gridSize,
  ])

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header with breadcrumbs and search */}
      <Header
        path={currentPath}
        onNavigate={handleNavigate}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchContent={contentSearchMode}
        onSearchContentChange={setContentSearchMode}
        mounts={config?.mounts}
      />

      {/* Main area: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          currentPath={currentPath}
          onNavigate={handleNavigate}
          favorites={favorites}
          onRemoveFavorite={removeFromFavorites}
          activeContentType={activeContentType}
          onContentTypeChange={setActiveContentType}
          mounts={config?.mounts}
        />

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleUpload(e.target.files)}
          />
          {/* Hidden folder input */}
          <input
            ref={folderInputRef}
            type="file"
            multiple
            className="hidden"
            // @ts-ignore - webkitdirectory is a non-standard attribute
            webkitdirectory=""
            onChange={(e) => e.target.files && handleUpload(e.target.files)}
          />

          {/* Toolbar */}
          <Toolbar
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            gridSize={gridSize}
            onGridSizeChange={setGridSize}
            itemCount={filteredFiles.length}
            selectedCount={selectedFiles.size}
            hasClipboard={!!clipboard}
            onNewFolder={() => setShowNewFolder(true)}
            onUpload={() => fileInputRef.current?.click()}
            onUploadFolder={() => folderInputRef.current?.click()}
            onDelete={() => setDeleteFiles(selectedFilesList)}
            onCopy={() => handleCopy(selectedFilesList)}
            onCut={() => handleCut(selectedFilesList)}
            onPaste={() => pasteMutation.mutate(undefined)}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: ['files', currentPath] })}
          />

          {/* Search indicator */}
          {isSearchActive && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b text-sm">
              {isContentSearchActive ? (
                <FileText className="h-4 w-4 text-muted-foreground" />
              ) : (
                <FolderSearch className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-muted-foreground">
                {isContentSearchActive ? (
                  <>
                    Searching inside files for "<span className="font-medium text-foreground">{debouncedSearchQuery}</span>"
                    {' '}in <span className="font-medium text-foreground">{currentPath === '/' ? 'Home' : currentPath.split('/').pop()}</span>
                    {contentSearchFilesWithMatches > 0 && !isContentSearching && (
                      <span className="ml-1">
                        ({contentSearchFilesWithMatches} file{contentSearchFilesWithMatches !== 1 ? 's' : ''} with matches)
                      </span>
                    )}
                  </>
                ) : debouncedSearchQuery && activeContentType ? (
                  <>
                    Searching for "<span className="font-medium text-foreground">{debouncedSearchQuery}</span>" in{' '}
                    <span className="font-medium text-foreground">{activeContentType}</span>
                  </>
                ) : debouncedSearchQuery ? (
                  <>
                    Searching for "<span className="font-medium text-foreground">{debouncedSearchQuery}</span>"
                  </>
                ) : activeContentType ? (
                  <>
                    Showing all <span className="font-medium text-foreground">{activeContentType}</span>
                  </>
                ) : null}
                {!isContentSearchActive && (
                  <>
                    {' '}in <span className="font-medium text-foreground">{currentPath === '/' ? 'Home' : currentPath.split('/').pop()}</span>{' '}
                    and subfolders
                  </>
                )}
              </span>

              {/* Truncation warning for filename search */}
              {searchHasMore && !isSearching && !isContentSearchActive && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">
                    Showing first 500 of {searchTotalScanned}+ results
                  </span>
                </div>
              )}

              {/* Truncation warning for content search */}
              {contentSearchHasMore && !isContentSearching && isContentSearchActive && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">
                    More results available (searched {contentSearchFilesSearched} files)
                  </span>
                </div>
              )}

              <button
                onClick={() => {
                  setSearchQuery('')
                  setActiveContentType(null)
                  setContentSearchMode(false)
                }}
                className="ml-auto flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>
            </div>
          )}

          {/* Error state */}
          {error ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-destructive">Failed to load files</h2>
                <p className="text-muted-foreground mt-1">Please check if the backend is running</p>
              </div>
            </div>
          ) : (
            /* File list */
            <UploadDropzone onUpload={handleUpload} onPreparing={setIsPreparingUpload}>
              {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : displayedFiles.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    {isContentSearchActive ? (
                      <>
                        <p className="text-lg">No matches found in file contents</p>
                        <p className="text-sm mt-1">Try a different search term or search in a different folder</p>
                      </>
                    ) : activeContentType ? (
                      <>
                        <p className="text-lg">No {activeContentType} found</p>
                        <p className="text-sm mt-1">No matching files in this folder or subfolders</p>
                      </>
                    ) : searchQuery ? (
                      <>
                        <p className="text-lg">No matching files</p>
                        <p className="text-sm mt-1">Try a different search term</p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg">This folder is empty</p>
                        <p className="text-sm mt-1">Drop files here or click upload</p>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <ScrollArea className="flex-1" viewportRef={scrollViewportRef}>
                  <div className={`flex flex-col ${isPlayerOpen ? 'pb-20' : ''}`}>
                    {isContentSearchActive ? (
                      <ContentSearchResults
                        files={displayedFiles}
                        onOpen={handleOpen}
                        searchQuery={debouncedSearchQuery}
                      />
                    ) : viewMode === 'grid' ? (
                      <FileGrid
                        files={displayedFiles}
                        selectedFiles={selectedFiles}
                        gridSize={gridSize}
                        focusedIndex={focusedIndex}
                        onSelect={selectFile}
                        onOpen={handleOpen}
                        onRename={setRenameFile}
                        onDelete={(files) => setDeleteFiles(files)}
                        onCopy={handleCopy}
                        onCut={handleCut}
                        onPreview={openPreview}
                        onDownload={handleDownload}
                        onMove={handleMove}
                        onAddFavorite={addToFavorites}
                        onRemoveFavorite={removeFromFavorites}
                        isFavorite={isFavorite}
                      />
                    ) : (
                      <FileList
                        files={displayedFiles}
                        selectedFiles={selectedFiles}
                        focusedIndex={focusedIndex}
                        onSelect={selectFile}
                        onOpen={handleOpen}
                        onRename={setRenameFile}
                        onDelete={(files) => setDeleteFiles(files)}
                        onCopy={handleCopy}
                        onCut={handleCut}
                        onPreview={openPreview}
                        onDownload={handleDownload}
                        onMove={handleMove}
                        onAddFavorite={addToFavorites}
                        onRemoveFavorite={removeFromFavorites}
                        isFavorite={isFavorite}
                      />
                    )}
                    {hasMoreFiles && (
                      <div className="flex items-center justify-center py-4 border-t">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-2">
                            Showing {MAX_DISPLAY_FILES.toLocaleString()} of {filteredFiles.length.toLocaleString()} files
                          </p>
                          <button
                            onClick={() => setShowAllFiles(true)}
                            className="text-sm text-primary hover:underline"
                          >
                            Show all {hiddenFilesCount.toLocaleString()} more files (may be slow)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </UploadDropzone>
          )}

          {/* Upload progress */}
          <UploadProgress
            uploads={uploads}
            isPreparing={isPreparingUpload}
            onDismiss={dismissUpload}
            onDismissAll={dismissAllUploads}
            onRetry={handleRetry}
          />
        </main>
      </div>

      {/* Dialogs */}
      <RenameDialog
        open={!!renameFile}
        onOpenChange={(open) => !open && setRenameFile(null)}
        currentName={renameFile?.name || ''}
        onRename={(newName) =>
          renameFile && renameMutation.mutate({ oldName: renameFile.name, newName })
        }
        isLoading={renameMutation.isPending}
      />

      <NewFolderDialog
        open={showNewFolder}
        onOpenChange={setShowNewFolder}
        onCreate={(name) => createFolderMutation.mutate(name)}
        isLoading={createFolderMutation.isPending}
      />

      <DeleteDialog
        open={deleteFiles.length > 0}
        onOpenChange={(open) => !open && setDeleteFiles([])}
        files={deleteFiles}
        onConfirm={() => deleteMutation.mutate(deleteFiles)}
        isLoading={deleteMutation.isPending}
      />

      <ConflictDialog
        open={conflictFiles.length > 0}
        onOpenChange={(open) => !open && setConflictFiles([])}
        conflictFiles={conflictFiles}
        operation={clipboard?.operation || 'copy'}
        onResolve={handleConflictResolution}
      />
    </div>
  )
}
