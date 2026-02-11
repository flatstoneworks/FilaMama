import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type FileInfo, type TrashItem, type SearchResult, type ContentSearchResult, type SortField, type SortOrder } from '@/api/client'
import { useFileSelection } from '@/hooks/useFileSelection'
import { useDebounce } from '@/hooks/useDebounce'
import { useScrollRestoration } from '@/hooks/useScrollRestoration'
import { useFavorites } from '@/hooks/useFavorites'
import { useClipboard } from '@/hooks/useClipboard'
import { useFileUpload } from '@/hooks/useFileUpload'
import { useFileNavigation } from '@/hooks/useFileNavigation'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Toolbar, type ViewMode } from '@/components/Toolbar'
import { FileGrid } from '@/components/FileGrid'
import { FileList } from '@/components/FileList'
import { ContentSearchResults } from '@/components/ContentSearchResults'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'
import { UploadDropzone } from '@/components/UploadDropzone'
import { UploadProgress } from '@/components/UploadProgress'
import { RenameDialog } from '@/components/RenameDialog'
import { NewFolderDialog } from '@/components/NewFolderDialog'
import { DeleteDialog } from '@/components/DeleteDialog'
import { ConflictDialog } from '@/components/ConflictDialog'
import { KeyboardShortcutsDialog } from '@/components/KeyboardShortcutsDialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from '@/components/ui/use-toast'
import { Loader2, X, FolderSearch, FileText, AlertTriangle } from 'lucide-react'
import { joinPath } from '@/lib/utils'

// Maximum files to display without virtualization to prevent performance issues
const MAX_DISPLAY_FILES = 1000

export function FilesPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const scrollViewportRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  // Derive currentPath from URL
  const currentPath = useMemo(() => {
    const path = decodeURIComponent(location.pathname).replace(/^\/browse/, '') || '/'
    return path === '' ? '/' : path
  }, [location.pathname])

  // Trash view detection
  const isTrashView = currentPath === '/.deleted_items'

  // URL-backed state
  const viewMode = (searchParams.get('view') as ViewMode) || 'grid'
  const gridSize = parseInt(searchParams.get('size') || '120')
  const searchQuery = searchParams.get('search') || ''
  const activeContentType = searchParams.get('filter') || null
  const contentSearchMode = searchParams.get('content') === 'true'
  const sortBy = (searchParams.get('sort') as SortField) || 'name'
  const sortOrder = (searchParams.get('order') as SortOrder) || 'asc'

  // Help dialog
  const [showHelp, setShowHelp] = useState(false)

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

  const handleSortChange = useCallback((field: SortField, order: SortOrder) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev)
      // Omit defaults from URL
      if (field === 'name') newParams.delete('sort')
      else newParams.set('sort', field)
      if (order === 'asc') newParams.delete('order')
      else newParams.set('order', order)
      return newParams
    }, { replace: true })
  }, [setSearchParams])

  // Dialogs
  const [renameFile, setRenameFile] = useState<FileInfo | null>(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [deleteFiles, setDeleteFiles] = useState<FileInfo[]>([])
  const [showEmptyTrash, setShowEmptyTrash] = useState(false)

  // Global audio player
  const { isOpen: isPlayerOpen } = useAudioPlayer()

  // Fetch config
  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: () => api.getConfig(),
    staleTime: Infinity,
  })

  // Trash info for sidebar badge
  const { data: trashInfo } = useQuery({
    queryKey: ['trash-info'],
    queryFn: () => api.getTrashInfo(),
    staleTime: 30000,
  })

  // Trash listing
  const { data: trashListing, isLoading: isLoadingTrash } = useQuery({
    queryKey: ['trash-list'],
    queryFn: () => api.listTrash(),
    enabled: isTrashView,
  })

  // Fetch files (skip in trash view)
  const { data: listing, isLoading: isLoadingDir, error } = useQuery({
    queryKey: ['files', currentPath, sortBy, sortOrder],
    queryFn: () => api.listDirectory(currentPath, sortBy, sortOrder),
    enabled: !isTrashView,
  })

  // Convert trash items to FileInfo format
  const trashFiles: FileInfo[] = useMemo(() => {
    if (!trashListing?.items) return []
    const thumbnailExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.mov', '.avi', '.mkv', '.webm']
    return trashListing.items.map((item: TrashItem) => {
      const ext = item.original_name?.includes('.') ? '.' + item.original_name.split('.').pop()?.toLowerCase() : ''
      const hasThumbnail = item.type === 'file' && thumbnailExtensions.includes(ext)
      return {
        name: item.original_name,
        path: item.name, // Use trash_name as path identifier for operations
        type: item.type,
        size: item.size,
        modified: item.deleted_at,
        is_hidden: false,
        has_thumbnail: hasThumbnail,
        thumbnail_url: hasThumbnail ? api.getThumbnailUrl(item.path) : undefined,
        is_directory: item.type === 'directory',
        extension: ext ? ext.slice(1) : undefined,
      }
    })
  }, [trashListing])

  const files = isTrashView ? trashFiles : (listing?.files || [])

  // Debounce search
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  // Search result limit (increases when user clicks "Load more")
  const [searchLimit, setSearchLimit] = useState(500)
  useEffect(() => { setSearchLimit(500) }, [debouncedSearchQuery, activeContentType, currentPath])

  // UI mode flags
  const isFilenameSearchMode = (!!searchQuery || !!activeContentType) && !contentSearchMode
  const isContentSearchMode = !!searchQuery && contentSearchMode && searchQuery.length >= 2

  // API query flags
  const isFilenameSearchReady = (!!debouncedSearchQuery || !!activeContentType) && !contentSearchMode
  const isContentSearchReady = !!debouncedSearchQuery && contentSearchMode && debouncedSearchQuery.length >= 2

  // Recursive filename search
  const { data: searchResponse, isLoading: isSearching, isFetching: isSearchFetching } = useQuery({
    queryKey: ['recursive-search', debouncedSearchQuery, activeContentType, currentPath, searchLimit],
    queryFn: () => api.searchFiles({
      query: debouncedSearchQuery || undefined,
      contentType: activeContentType || undefined,
      path: currentPath,
      maxResults: searchLimit,
    }),
    enabled: isFilenameSearchReady,
    placeholderData: (prev) => prev,
  })

  // Content search
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

  const isFilenameSearchActive = isFilenameSearchMode
  const isContentSearchActive = isContentSearchMode
  const isSearchActive = isFilenameSearchActive || isContentSearchActive
  const isLoading = (isTrashView ? isLoadingTrash : isLoadingDir) || (isFilenameSearchActive && isSearching) || (isContentSearchActive && isContentSearching)

  // State for showing all files
  const [showAllFiles, setShowAllFiles] = useState(false)
  useEffect(() => { setShowAllFiles(false) }, [currentPath])

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

  // Convert content search results
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

  // Determine displayed files
  const filteredFiles = useMemo(() => {
    if (isContentSearchActive) return contentSearchResultsAsFiles
    if (isFilenameSearchActive) return searchResultsAsFiles
    return files
  }, [files, isFilenameSearchActive, isContentSearchActive, searchResultsAsFiles, contentSearchResultsAsFiles])

  const displayedFiles = useMemo(() => {
    // List view is virtualized, so no limit needed
    if (viewMode === 'list') return filteredFiles
    if (showAllFiles || filteredFiles.length <= MAX_DISPLAY_FILES) return filteredFiles
    return filteredFiles.slice(0, MAX_DISPLAY_FILES)
  }, [filteredFiles, showAllFiles, viewMode])

  const hasMoreFiles = viewMode === 'grid' && filteredFiles.length > MAX_DISPLAY_FILES && !showAllFiles
  const hiddenFilesCount = filteredFiles.length - MAX_DISPLAY_FILES

  // Scroll restoration - wait until files are loaded before restoring position
  const scrollReady = !isLoading && displayedFiles.length > 0
  useScrollRestoration(scrollViewportRef, scrollReady)

  // Selection
  const { selectedFiles, selectFile, clearSelection } = useFileSelection(displayedFiles)
  const selectedFilesList = displayedFiles.filter((f) => selectedFiles.has(f.path))

  // Extracted hooks
  const { favorites, addToFavorites, removeFromFavorites, isFavorite } = useFavorites()
  const { clipboard, conflictFiles, handleCopy, handleCut, pasteMutation, handleConflictResolution } = useClipboard(currentPath)
  const { uploads, isPreparingUpload, setIsPreparingUpload, handleUpload, handleRetry, dismissUpload, dismissAllUploads } =
    useFileUpload(currentPath, config?.max_upload_size_mb)
  const { handleNavigate, openPreview, handleOpen, handleDownload } = useFileNavigation(clearSelection)

  // Wrap handleOpen to provide displayedFiles
  const handleOpenFile = useCallback((file: FileInfo) => {
    handleOpen(file, displayedFiles)
  }, [handleOpen, displayedFiles])

  const handleClearSearch = useCallback(() => {
    setSearchQuery('')
  }, [setSearchQuery])

  const { focusedIndex } = useKeyboardShortcuts({
    displayedFiles,
    selectedFilesList,
    hasClipboard: !!clipboard,
    currentPath,
    viewMode,
    gridSize,
    isAudioPlayerOpen: isPlayerOpen,
    selectFile,
    clearSelection,
    onCopy: handleCopy,
    onCut: handleCut,
    onPaste: () => pasteMutation.mutate(undefined),
    onDelete: setDeleteFiles,
    onOpen: handleOpenFile,
    onNavigate: handleNavigate,
    onRename: setRenameFile,
    onClearSearch: handleClearSearch,
    onShowHelp: () => setShowHelp(true),
  })

  // Move handler
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
    } catch (err) {
      toast({ title: 'Failed to move files', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' })
    }
  }

  // Mutations
  const renameMutation = useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) =>
      api.rename(joinPath(currentPath, oldName), joinPath(currentPath, newName)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', currentPath] })
      setRenameFile(null)
      toast({ title: 'Renamed successfully' })
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to rename', description: error.message, variant: 'destructive' })
    },
  })

  const createFolderMutation = useMutation({
    mutationFn: (name: string) => api.createFolder(joinPath(currentPath, name)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', currentPath] })
      setShowNewFolder(false)
      toast({ title: 'Folder created' })
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create folder', description: error.message, variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (filesToDelete: FileInfo[]) => {
      if (isTrashView) {
        // Permanently delete from trash - file.path contains trash_name
        await api.deletePermanent(filesToDelete.map(f => f.path))
      } else {
        // Move to trash
        const paths = filesToDelete.map(f => f.path)
        await api.moveToTrash(paths)
      }
    },
    onSuccess: () => {
      if (isTrashView) {
        queryClient.invalidateQueries({ queryKey: ['trash-list'] })
      } else {
        queryClient.invalidateQueries({ queryKey: ['files', currentPath] })
      }
      queryClient.invalidateQueries({ queryKey: ['trash-info'] })
      setDeleteFiles([])
      clearSelection()
      toast({ title: isTrashView ? 'Permanently deleted' : 'Moved to Trash' })
    },
    onError: (error: Error) => {
      toast({ title: isTrashView ? 'Failed to delete' : 'Failed to move to Trash', description: error.message, variant: 'destructive' })
    },
  })

  const restoreMutation = useMutation({
    mutationFn: async (filesToRestore: FileInfo[]) => {
      // file.path contains trash_name in trash view
      await api.restoreFromTrash(filesToRestore.map(f => f.path))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash-list'] })
      queryClient.invalidateQueries({ queryKey: ['trash-info'] })
      queryClient.invalidateQueries({ queryKey: ['files'] })
      clearSelection()
      toast({ title: 'Restored successfully' })
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to restore', description: error.message, variant: 'destructive' })
    },
  })

  const emptyTrashMutation = useMutation({
    mutationFn: () => api.emptyTrash(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash-list'] })
      queryClient.invalidateQueries({ queryKey: ['trash-info'] })
      clearSelection()
      toast({ title: 'Trash emptied' })
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to empty trash', description: error.message, variant: 'destructive' })
    },
  })

  const handleRestore = useCallback((filesToRestore: FileInfo[]) => {
    restoreMutation.mutate(filesToRestore)
  }, [restoreMutation])

  return (
    <div className="h-screen flex flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Skip to main content
      </a>
      <Header
        path={currentPath}
        onNavigate={handleNavigate}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchContent={contentSearchMode}
        onSearchContentChange={setContentSearchMode}
        mounts={config?.mounts}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          currentPath={currentPath}
          onNavigate={handleNavigate}
          favorites={favorites}
          onRemoveFavorite={removeFromFavorites}
          activeContentType={activeContentType}
          onContentTypeChange={setActiveContentType}
          mounts={config?.mounts}
          contentTypes={config?.content_types}
          trashCount={trashInfo?.count ?? 0}
        />

        <main id="main-content" className="flex-1 flex flex-col overflow-hidden">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleUpload(e.target.files)}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            className="hidden"
            // @ts-ignore - webkitdirectory is a non-standard attribute
            webkitdirectory=""
            onChange={(e) => e.target.files && handleUpload(e.target.files)}
          />

          <Toolbar
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            gridSize={gridSize}
            onGridSizeChange={setGridSize}
            itemCount={filteredFiles.length}
            selectedCount={selectedFiles.size}
            hasClipboard={!!clipboard}
            clipboardInfo={clipboard ? { count: clipboard.files.length, operation: clipboard.operation } : null}
            isTrashView={isTrashView}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            onNewFolder={() => setShowNewFolder(true)}
            onUpload={() => fileInputRef.current?.click()}
            onUploadFolder={() => folderInputRef.current?.click()}
            onDelete={() => setDeleteFiles(selectedFilesList)}
            onCopy={() => handleCopy(selectedFilesList)}
            onCut={() => handleCut(selectedFilesList)}
            onPaste={() => pasteMutation.mutate(undefined)}
            onRefresh={() => {
              if (isTrashView) {
                queryClient.invalidateQueries({ queryKey: ['trash-list'] })
                queryClient.invalidateQueries({ queryKey: ['trash-info'] })
              } else {
                queryClient.invalidateQueries({ queryKey: ['files', currentPath] })
              }
            }}
            onRestore={() => handleRestore(selectedFilesList)}
            onEmptyTrash={() => setShowEmptyTrash(true)}
          />

          {/* Search indicator */}
          {isSearchActive && (
            <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/50 border-b text-sm">
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

              {searchHasMore && !isSearching && !isContentSearchActive && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">
                    Showing {searchResults?.length ?? 0} of {searchTotalScanned}+ results
                  </span>
                </div>
              )}

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
                    ) : isTrashView ? (
                      <>
                        <p className="text-lg">Trash is empty</p>
                        <p className="text-sm mt-1">Deleted items will appear here</p>
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
                        onOpen={handleOpenFile}
                        searchQuery={debouncedSearchQuery}
                      />
                    ) : viewMode === 'grid' ? (
                      <FileGrid
                        files={displayedFiles}
                        selectedFiles={selectedFiles}
                        gridSize={gridSize}
                        focusedIndex={focusedIndex}
                        trashMode={isTrashView}
                        onSelect={selectFile}
                        onOpen={handleOpenFile}
                        onRename={setRenameFile}
                        onDelete={(files) => setDeleteFiles(files)}
                        onCopy={handleCopy}
                        onCut={handleCut}
                        onPreview={openPreview}
                        onDownload={handleDownload}
                        onMove={isTrashView ? undefined : handleMove}
                        onRestore={isTrashView ? handleRestore : undefined}
                        onAddFavorite={addToFavorites}
                        onRemoveFavorite={removeFromFavorites}
                        isFavorite={isFavorite}
                      />
                    ) : (
                      <FileList
                        files={displayedFiles}
                        selectedFiles={selectedFiles}
                        focusedIndex={focusedIndex}
                        trashMode={isTrashView}
                        onSelect={selectFile}
                        onOpen={handleOpenFile}
                        onRename={setRenameFile}
                        onDelete={(files) => setDeleteFiles(files)}
                        onCopy={handleCopy}
                        onCut={handleCut}
                        onPreview={openPreview}
                        onDownload={handleDownload}
                        onMove={isTrashView ? undefined : handleMove}
                        onRestore={isTrashView ? handleRestore : undefined}
                        onAddFavorite={addToFavorites}
                        onRemoveFavorite={removeFromFavorites}
                        isFavorite={isFavorite}
                        parentRef={scrollViewportRef}
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
                    {searchHasMore && isFilenameSearchActive && !isContentSearchActive && (
                      <div className="flex items-center justify-center py-4 border-t">
                        <button
                          onClick={() => setSearchLimit(prev => prev + 500)}
                          disabled={isSearchFetching}
                          className="text-sm text-primary hover:underline disabled:opacity-50"
                        >
                          {isSearchFetching ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading more...
                            </span>
                          ) : (
                            `Load more results (showing ${searchResults?.length ?? 0} of ${searchTotalScanned}+)`
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </UploadDropzone>
          )}

          <UploadProgress
            uploads={uploads}
            isPreparing={isPreparingUpload}
            isPlayerOpen={isPlayerOpen}
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
        permanent={isTrashView}
      />

      <ConflictDialog
        open={conflictFiles.length > 0}
        onOpenChange={(open) => !open && handleConflictResolution('cancel')}
        conflictFiles={conflictFiles}
        operation={clipboard?.operation || 'copy'}
        onResolve={handleConflictResolution}
      />

      <KeyboardShortcutsDialog
        open={showHelp}
        onOpenChange={setShowHelp}
      />

      <AlertDialog open={showEmptyTrash} onOpenChange={setShowEmptyTrash}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Empty Trash?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {trashInfo?.count ?? 0} item{(trashInfo?.count ?? 0) !== 1 ? 's' : ''} in the Trash. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                emptyTrashMutation.mutate()
                setShowEmptyTrash(false)
              }}
              disabled={emptyTrashMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {emptyTrashMutation.isPending ? 'Emptying...' : 'Empty Trash'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
