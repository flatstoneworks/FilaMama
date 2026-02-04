import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type FileInfo, type SearchResult } from '@/api/client'
import { useFileSelection } from '@/hooks/useFileSelection'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Toolbar, type ViewMode } from '@/components/Toolbar'
import { FileGrid } from '@/components/FileGrid'
import { FileList } from '@/components/FileList'
import { UploadDropzone } from '@/components/UploadDropzone'
import { UploadProgress, type UploadItem } from '@/components/UploadProgress'
import { RenameDialog } from '@/components/RenameDialog'
import { NewFolderDialog } from '@/components/NewFolderDialog'
import { DeleteDialog } from '@/components/DeleteDialog'
import { ConflictDialog, type ConflictResolution } from '@/components/ConflictDialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from '@/components/ui/use-toast'
import { Loader2, X, FolderSearch } from 'lucide-react'
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
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  // Derive currentPath from URL: /browse/home/user → /home/user
  const currentPath = useMemo(() => {
    const path = location.pathname.replace(/^\/browse/, '') || '/'
    return path === '' ? '/' : path
  }, [location.pathname])

  // URL-backed state - read from URL parameters
  const viewMode = (searchParams.get('view') as ViewMode) || 'grid'
  const gridSize = parseInt(searchParams.get('size') || '120')
  const searchQuery = searchParams.get('search') || ''
  const activeContentType = searchParams.get('filter') || null

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

  // Non-URL state (transient, doesn't need to be bookmarkable)
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [isPreparingUpload, setIsPreparingUpload] = useState(false)

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

  // Recursive search for content type filtering
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['content-search', activeContentType, currentPath],
    queryFn: () => api.searchFiles({
      contentType: activeContentType!,
      path: currentPath,
      maxResults: 500,
    }),
    enabled: !!activeContentType,
  })

  const isLoading = isLoadingDir || (!!activeContentType && isSearching)

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

  // Convert search results to FileInfo format
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

  // Filter by content type (uses recursive search) and search query
  const filteredFiles = useMemo(() => {
    // Use recursive search results when content type filter is active
    let result = activeContentType ? searchResultsAsFiles : files

    // Filter by search query (applies to both modes)
    if (searchQuery) {
      result = result.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    }

    return result
  }, [files, activeContentType, searchQuery, searchResultsAsFiles])

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
  const handleNavigate = (path: string) => {
    // Convert filesystem path to URL: /home/user → /browse/home/user
    const urlPath = path === '/' ? '/browse' : `/browse${path}`

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

  const handleUpload = useCallback(
    async (fileList: FileList | File[]) => {
      const filesArray = Array.isArray(fileList) ? fileList : Array.from(fileList)

      // Show upload panel immediately with all files
      const newUploads: UploadItem[] = filesArray.map((file) => ({
        id: Math.random().toString(36).slice(2),
        name: (file as any).customRelativePath || (file as any).webkitRelativePath || file.name,
        progress: 0,
        status: 'pending' as const,
      }))

      // Add all files to the upload list immediately so user sees them
      setUploads((prev) => [...prev, ...newUploads])
      setIsPreparingUpload(false)

      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i]
        const uploadItem = newUploads[i]
        // Get relative path for folder uploads (e.g., "folder/subfolder/file.txt")
        // Check both customRelativePath (from drag-drop) and webkitRelativePath (from folder input)
        const relativePath = (file as any).customRelativePath || (file as any).webkitRelativePath || ''

        try {
          setUploads((prev) =>
            prev.map((u) => (u.id === uploadItem.id ? { ...u, status: 'uploading' } : u))
          )

          await api.uploadFile(file, currentPath, (progress) => {
            setUploads((prev) =>
              prev.map((u) => (u.id === uploadItem.id ? { ...u, progress } : u))
            )
          }, relativePath)

          setUploads((prev) =>
            prev.map((u) =>
              u.id === uploadItem.id ? { ...u, status: 'completed', progress: 100 } : u
            )
          )
        } catch (err) {
          setUploads((prev) =>
            prev.map((u) =>
              u.id === uploadItem.id
                ? { ...u, status: 'error', error: 'Upload failed' }
                : u
            )
          )
        }
      }

      queryClient.invalidateQueries({ queryKey: ['files', currentPath] })
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
  ])

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header with breadcrumbs and search */}
      <Header
        path={currentPath}
        onNavigate={handleNavigate}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        mounts={config?.mounts}
      />

      {/* Main area: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          currentPath={currentPath}
          onNavigate={handleNavigate}
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

          {/* Recursive search indicator */}
          {activeContentType && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b text-sm">
              <FolderSearch className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                Showing all <span className="font-medium text-foreground">{activeContentType}</span> in{' '}
                <span className="font-medium text-foreground">{currentPath === '/' ? 'Home' : currentPath.split('/').pop()}</span>{' '}
                and subfolders
              </span>
              <button
                onClick={() => setActiveContentType(null)}
                className="ml-auto flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                <span>Clear filter</span>
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
                    {activeContentType ? (
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
                <ScrollArea className="flex-1">
                  <div className="flex flex-col">
                    {viewMode === 'grid' ? (
                      <FileGrid
                        files={displayedFiles}
                        selectedFiles={selectedFiles}
                        gridSize={gridSize}
                        onSelect={selectFile}
                        onOpen={handleOpen}
                        onRename={setRenameFile}
                        onDelete={(files) => setDeleteFiles(files)}
                        onCopy={handleCopy}
                        onCut={handleCut}
                        onPreview={openPreview}
                        onDownload={handleDownload}
                        onMove={handleMove}
                      />
                    ) : (
                      <FileList
                        files={displayedFiles}
                        selectedFiles={selectedFiles}
                        onSelect={selectFile}
                        onOpen={handleOpen}
                        onRename={setRenameFile}
                        onDelete={(files) => setDeleteFiles(files)}
                        onCopy={handleCopy}
                        onCut={handleCut}
                        onPreview={openPreview}
                        onDownload={handleDownload}
                        onMove={handleMove}
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
