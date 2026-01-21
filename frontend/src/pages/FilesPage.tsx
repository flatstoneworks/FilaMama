import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type FileInfo } from '@/api/client'
import { useFileSelection } from '@/hooks/useFileSelection'
import { Header } from '@/components/Header'
import { Sidebar, contentTypes } from '@/components/Sidebar'
import { Toolbar, type ViewMode } from '@/components/Toolbar'
import { FileGrid } from '@/components/FileGrid'
import { FileList } from '@/components/FileList'
import { UploadDropzone } from '@/components/UploadDropzone'
import { UploadProgress, type UploadItem } from '@/components/UploadProgress'
import { PreviewModal } from '@/components/PreviewModal'
import { RenameDialog } from '@/components/RenameDialog'
import { NewFolderDialog } from '@/components/NewFolderDialog'
import { DeleteDialog } from '@/components/DeleteDialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from '@/components/ui/use-toast'
import { Loader2 } from 'lucide-react'
import { joinPath } from '@/lib/utils'

interface ClipboardState {
  files: FileInfo[]
  operation: 'copy' | 'cut'
  sourcePath: string
}

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
  const previewFileName = searchParams.get('file') || null

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

  // Fetch files
  const { data: listing, isLoading, error } = useQuery({
    queryKey: ['files', currentPath],
    queryFn: () => api.listDirectory(currentPath),
  })

  const files = listing?.files || []

  // Find preview file from URL parameter
  const previewFile = useMemo(() => {
    if (!previewFileName) return null
    return files.find(f => f.name === previewFileName) || null
  }, [previewFileName, files])

  // Setter for preview file that updates URL
  const setPreviewFile = useCallback((file: FileInfo | null) => {
    updateUrlParam('file', file?.name || null)
  }, [updateUrlParam])

  // Filter by content type and search
  const filteredFiles = useMemo(() => {
    let result = files

    // Filter by content type
    if (activeContentType) {
      const typeConfig = contentTypes.find(t => t.type === activeContentType)
      if (typeConfig) {
        result = result.filter(f => {
          if (f.is_directory) return false
          const ext = '.' + f.name.split('.').pop()?.toLowerCase()
          return typeConfig.extensions.includes(ext)
        })
      }
    }

    // Filter by search
    if (searchQuery) {
      result = result.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    }

    return result
  }, [files, activeContentType, searchQuery])

  // Selection
  const { selectedFiles, selectFile, clearSelection } = useFileSelection(filteredFiles)

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

  const pasteMutation = useMutation({
    mutationFn: async () => {
      if (!clipboard) return
      for (const file of clipboard.files) {
        const srcPath = joinPath(clipboard.sourcePath, file.name)
        const destPath = joinPath(currentPath, file.name)
        if (clipboard.operation === 'copy') {
          await api.copy(srcPath, destPath)
        } else {
          await api.move(srcPath, destPath)
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] })
      if (clipboard?.operation === 'cut') {
        setClipboard(null)
      }
      toast({ title: clipboard?.operation === 'copy' ? 'Copied' : 'Moved' })
    },
    onError: () => {
      toast({ title: 'Operation failed', variant: 'destructive' })
    },
  })

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
      handleNavigate(joinPath(currentPath, file.name))
    } else {
      setPreviewFile(file)
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

      // Ctrl/Cmd + A: Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        filteredFiles.forEach((file) => selectFile(file, { ctrlKey: true } as React.MouseEvent))
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
        pasteMutation.mutate()
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
    filteredFiles,
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
      />

      {/* Main area: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          currentPath={currentPath}
          onNavigate={handleNavigate}
          activeContentType={activeContentType}
          onContentTypeChange={setActiveContentType}
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
            onPaste={() => pasteMutation.mutate()}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: ['files', currentPath] })}
          />

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
              ) : filteredFiles.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    {activeContentType ? (
                      <>
                        <p className="text-lg">No {activeContentType} in this folder</p>
                        <p className="text-sm mt-1">Try navigating to a different folder</p>
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
                  {viewMode === 'grid' ? (
                    <FileGrid
                      files={filteredFiles}
                      selectedFiles={selectedFiles}
                      gridSize={gridSize}
                      onSelect={selectFile}
                      onOpen={handleOpen}
                      onRename={setRenameFile}
                      onDelete={(files) => setDeleteFiles(files)}
                      onCopy={handleCopy}
                      onCut={handleCut}
                      onPreview={setPreviewFile}
                      onDownload={handleDownload}
                      onMove={handleMove}
                    />
                  ) : (
                    <FileList
                      files={filteredFiles}
                      selectedFiles={selectedFiles}
                      onSelect={selectFile}
                      onOpen={handleOpen}
                      onRename={setRenameFile}
                      onDelete={(files) => setDeleteFiles(files)}
                      onCopy={handleCopy}
                      onCut={handleCut}
                      onPreview={setPreviewFile}
                      onDownload={handleDownload}
                      onMove={handleMove}
                    />
                  )}
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

      <PreviewModal
        open={!!previewFile}
        onOpenChange={(open) => !open && setPreviewFile(null)}
        file={previewFile}
        files={filteredFiles}
        currentPath={currentPath}
        onNavigate={setPreviewFile}
      />
    </div>
  )
}
