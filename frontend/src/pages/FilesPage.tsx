import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type FileInfo } from '@/api/client'
import { useFileSelection } from '@/hooks/useFileSelection'
import { Breadcrumbs } from '@/components/Breadcrumbs'
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

interface ClipboardState {
  files: FileInfo[]
  operation: 'copy' | 'cut'
  sourcePath: string
}

export function FilesPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // State
  const [currentPath, setCurrentPath] = useState('/')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [gridSize, setGridSize] = useState(120)
  const [searchQuery, setSearchQuery] = useState('')
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null)
  const [uploads, setUploads] = useState<UploadItem[]>([])

  // Dialogs
  const [renameFile, setRenameFile] = useState<FileInfo | null>(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [deleteFiles, setDeleteFiles] = useState<FileInfo[]>([])
  const [previewFile, setPreviewFile] = useState<FileInfo | null>(null)

  // Fetch files
  const { data: listing, isLoading, error } = useQuery({
    queryKey: ['files', currentPath],
    queryFn: () => api.listDirectory(currentPath),
  })

  const files = listing?.files || []

  // Filter by search
  const filteredFiles = searchQuery
    ? files.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : files

  // Selection
  const { selectedFiles, selectFile, clearSelection } = useFileSelection(filteredFiles)

  // Mutations
  const renameMutation = useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) =>
      api.rename(currentPath + '/' + oldName, currentPath + '/' + newName),
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
    mutationFn: (name: string) => api.createFolder(currentPath + '/' + name),
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
        await api.delete(currentPath + '/' + file.name)
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
        const srcPath = clipboard.sourcePath + '/' + file.name
        const destPath = currentPath + '/' + file.name
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
    setCurrentPath(path)
    clearSelection()
    setSearchQuery('')
  }

  const handleOpen = (file: FileInfo) => {
    if (file.is_directory) {
      handleNavigate(currentPath === '/' ? '/' + file.name : currentPath + '/' + file.name)
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
    link.href = `/api/files/download?path=${encodeURIComponent(currentPath + '/' + file.name)}`
    link.download = file.name
    link.click()
  }

  const handleUpload = useCallback(
    async (fileList: FileList) => {
      const newUploads: UploadItem[] = Array.from(fileList).map((file) => ({
        id: Math.random().toString(36).slice(2),
        name: file.name,
        progress: 0,
        status: 'pending' as const,
      }))

      setUploads((prev) => [...prev, ...newUploads])

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i]
        const uploadItem = newUploads[i]

        try {
          setUploads((prev) =>
            prev.map((u) => (u.id === uploadItem.id ? { ...u, status: 'uploading' } : u))
          )

          await api.uploadFile(file, currentPath, (progress) => {
            setUploads((prev) =>
              prev.map((u) => (u.id === uploadItem.id ? { ...u, progress } : u))
            )
          })

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
  }

  const selectedFilesList = files.filter((f) => selectedFiles.has(f.name))

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-destructive">Failed to load files</h2>
          <p className="text-muted-foreground mt-1">Please check if the backend is running</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleUpload(e.target.files)}
      />

      {/* Breadcrumbs */}
      <div className="border-b px-2">
        <Breadcrumbs path={currentPath} onNavigate={handleNavigate} />
      </div>

      {/* Toolbar */}
      <Toolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        gridSize={gridSize}
        onGridSizeChange={setGridSize}
        selectedCount={selectedFiles.size}
        hasClipboard={!!clipboard}
        onNewFolder={() => setShowNewFolder(true)}
        onUpload={() => fileInputRef.current?.click()}
        onDelete={() => setDeleteFiles(selectedFilesList)}
        onCopy={() => handleCopy(selectedFilesList)}
        onCut={() => handleCut(selectedFilesList)}
        onPaste={() => pasteMutation.mutate()}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['files', currentPath] })}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* File list */}
      <UploadDropzone onUpload={handleUpload}>
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              {searchQuery ? (
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
              />
            )}
          </ScrollArea>
        )}
      </UploadDropzone>

      {/* Upload progress */}
      <UploadProgress
        uploads={uploads}
        onDismiss={dismissUpload}
        onDismissAll={dismissAllUploads}
      />

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
