import { useCallback, useState } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UploadDropzoneProps {
  onUpload: (files: FileList | File[]) => void
  onPreparing?: (isPreparing: boolean) => void
  children: React.ReactNode
}

// Extended File type with custom relative path property
export interface FileWithPath extends File {
  customRelativePath?: string
}

// Helper to read all files from a directory entry recursively
async function readDirectoryEntries(dirEntry: FileSystemDirectoryEntry, path: string = ''): Promise<FileWithPath[]> {
  const files: FileWithPath[] = []
  const reader = dirEntry.createReader()

  // Read all entries (readEntries may need to be called multiple times for large directories)
  const readAllEntries = async (): Promise<FileSystemEntry[]> => {
    const entries: FileSystemEntry[] = []
    let batch: FileSystemEntry[]
    do {
      batch = await new Promise((resolve, reject) => {
        reader.readEntries(resolve, reject)
      })
      entries.push(...batch)
    } while (batch.length > 0)
    return entries
  }

  const entries = await readAllEntries()

  for (const entry of entries) {
    const entryPath = path ? `${path}/${entry.name}` : entry.name
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry
      const file = await new Promise<FileWithPath>((resolve, reject) => {
        fileEntry.file((f) => {
          // Create a new File and store the relative path in a custom property
          const fileWithPath: FileWithPath = new File([f], f.name, { type: f.type, lastModified: f.lastModified })
          fileWithPath.customRelativePath = entryPath
          resolve(fileWithPath)
        }, reject)
      })
      files.push(file)
    } else if (entry.isDirectory) {
      const subFiles = await readDirectoryEntries(entry as FileSystemDirectoryEntry, entryPath)
      files.push(...subFiles)
    }
  }

  return files
}

// Helper to get all files from DataTransferItemList, handling both files and folders
async function getFilesFromDataTransfer(items: DataTransferItemList): Promise<File[]> {
  const files: File[] = []
  const entries: FileSystemEntry[] = []

  console.log('[getFilesFromDataTransfer] Processing', items.length, 'items')

  // Get all entries first
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    console.log('[getFilesFromDataTransfer] Item', i, ':', item.kind, item.type)
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry()
      console.log('[getFilesFromDataTransfer] Entry:', entry?.name, 'isDir:', entry?.isDirectory)
      if (entry) {
        entries.push(entry)
      }
    }
  }

  // Process each entry
  for (const entry of entries) {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry
      const file = await new Promise<File>((resolve, reject) => {
        fileEntry.file(resolve, reject)
      })
      files.push(file)
    } else if (entry.isDirectory) {
      console.log('[getFilesFromDataTransfer] Reading directory:', entry.name)
      const dirFiles = await readDirectoryEntries(entry as FileSystemDirectoryEntry, entry.name)
      console.log('[getFilesFromDataTransfer] Got', dirFiles.length, 'files from directory')
      files.push(...dirFiles)
    }
  }

  return files
}

// Create a FileList-like object from an array of Files
function createFileList(files: File[]): FileList {
  const dataTransfer = new DataTransfer()
  files.forEach(file => dataTransfer.items.add(file))
  return dataTransfer.files
}

export function UploadDropzone({ onUpload, onPreparing, children }: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [, setDragCounter] = useState(0)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragCounter((c) => c + 1)
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragCounter((c) => {
      const newCount = c - 1
      if (newCount === 0) {
        setIsDragging(false)
      }
      return newCount
    })
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      setDragCounter(0)

      console.log('[UploadDropzone] Drop event, items:', e.dataTransfer.items?.length)

      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        // Notify that we're preparing/scanning folders
        onPreparing?.(true)

        try {
          // Use webkitGetAsEntry to handle both files and folders
          const files = await getFilesFromDataTransfer(e.dataTransfer.items)
          console.log('[UploadDropzone] Got files:', files.length, files.map(f => ({ name: f.name, path: (f as any).customRelativePath || (f as any).webkitRelativePath })))
          if (files.length > 0) {
            // Pass files array directly to preserve customRelativePath property
            onUpload(files)
          } else {
            onPreparing?.(false)
          }
        } catch (err) {
          console.error('[UploadDropzone] Error reading dropped items:', err)
          onPreparing?.(false)
          // Fallback to simple file handling
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onUpload(e.dataTransfer.files)
          }
        }
      }
    },
    [onUpload, onPreparing]
  )

  return (
    <div
      className="relative flex-1 flex flex-col overflow-hidden"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* Drag overlay */}
      <div
        className={cn(
          'absolute inset-0 z-50 flex items-center justify-center pointer-events-none transition-opacity',
          'bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg m-4',
          isDragging ? 'opacity-100' : 'opacity-0'
        )}
      >
        <div className="flex flex-col items-center gap-2 text-primary">
          <Upload className="h-12 w-12" />
          <p className="text-lg font-medium">Drop files to upload</p>
        </div>
      </div>
    </div>
  )
}
