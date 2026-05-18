import { type ReactNode, useCallback, useState } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FileWithPath extends File {
  customRelativePath?: string
}

export interface UploadDropzoneProps {
  onUpload: (files: FileList | File[]) => void
  onPreparing?: (isPreparing: boolean) => void
  children: ReactNode
  className?: string
  dropLabel?: string
}

interface UploadFileSystemEntry {
  name: string
  isFile: boolean
  isDirectory: boolean
}

interface UploadFileSystemFileEntry extends UploadFileSystemEntry {
  file: (success: (file: File) => void, error?: (error: DOMException) => void) => void
}

interface UploadFileSystemDirectoryEntry extends UploadFileSystemEntry {
  createReader: () => {
    readEntries: (
      success: (entries: UploadFileSystemEntry[]) => void,
      error?: (error: DOMException) => void
    ) => void
  }
}

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => UploadFileSystemEntry | null
  getAsEntry?: () => UploadFileSystemEntry | null
}

function withRelativePath(file: File, relativePath: string): FileWithPath {
  const fileWithPath = new File([file], file.name, {
    type: file.type,
    lastModified: file.lastModified,
  }) as FileWithPath
  fileWithPath.customRelativePath = relativePath
  return fileWithPath
}

async function fileFromEntry(entry: UploadFileSystemFileEntry, relativePath?: string): Promise<FileWithPath> {
  const file = await new Promise<File>((resolve, reject) => {
    entry.file(resolve, reject)
  })
  return relativePath ? withRelativePath(file, relativePath) : file
}

async function readDirectoryEntries(dirEntry: UploadFileSystemDirectoryEntry, path = ''): Promise<FileWithPath[]> {
  const files: FileWithPath[] = []
  const reader = dirEntry.createReader()
  const entries: UploadFileSystemEntry[] = []

  while (true) {
    const batch = await new Promise<UploadFileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })
    if (batch.length === 0) break
    entries.push(...batch)
  }

  for (const entry of entries) {
    const entryPath = path ? `${path}/${entry.name}` : entry.name
    if (entry.isFile) {
      files.push(await fileFromEntry(entry as UploadFileSystemFileEntry, entryPath))
    } else if (entry.isDirectory) {
      files.push(...await readDirectoryEntries(entry as UploadFileSystemDirectoryEntry, entryPath))
    }
  }

  return files
}

async function getFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const files: File[] = []
  const entries: UploadFileSystemEntry[] = []

  if (dataTransfer.items?.length) {
    for (const rawItem of Array.from(dataTransfer.items)) {
      if (rawItem.kind !== 'file') continue

      const item = rawItem as DataTransferItemWithEntry
      const entry = item.webkitGetAsEntry?.() ?? item.getAsEntry?.() ?? null
      if (entry) {
        entries.push(entry)
        continue
      }

      const file = item.getAsFile()
      if (file) files.push(file)
    }
  }

  for (const entry of entries) {
    if (entry.isFile) {
      files.push(await fileFromEntry(entry as UploadFileSystemFileEntry))
    } else if (entry.isDirectory) {
      files.push(...await readDirectoryEntries(entry as UploadFileSystemDirectoryEntry, entry.name))
    }
  }

  if (files.length === 0 && dataTransfer.files?.length) {
    files.push(...Array.from(dataTransfer.files))
  }

  return files
}

export function UploadDropzone({
  onUpload,
  onPreparing,
  children,
  className,
  dropLabel = 'Drop files to upload',
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [, setDragCounter] = useState(0)

  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setDragCounter((count) => count + 1)
    if (event.dataTransfer.items?.length || event.dataTransfer.files?.length) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setDragCounter((count) => {
      const nextCount = count - 1
      if (nextCount <= 0) setIsDragging(false)
      return Math.max(nextCount, 0)
    })
  }, [])

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }, [])

  const handleDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
    setDragCounter(0)

    if (!event.dataTransfer.items?.length && !event.dataTransfer.files?.length) {
      return
    }

    onPreparing?.(true)
    try {
      const files = await getFilesFromDataTransfer(event.dataTransfer)
      if (files.length > 0) {
        onUpload(files)
      } else {
        onPreparing?.(false)
      }
    } catch (error) {
      console.error('[UploadDropzone] Error reading dropped items:', error)
      if (event.dataTransfer.files?.length) {
        onUpload(event.dataTransfer.files)
      } else {
        onPreparing?.(false)
      }
    }
  }, [onUpload, onPreparing])

  return (
    <div
      className={cn('relative flex-1 flex flex-col overflow-hidden', className)}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
      <div
        className={cn(
          'absolute inset-0 z-50 flex items-center justify-center pointer-events-none transition-opacity',
          'bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg m-4',
          isDragging ? 'opacity-100' : 'opacity-0'
        )}
      >
        <div className="flex flex-col items-center gap-2 text-primary">
          <Upload className="h-12 w-12" />
          <p className="text-lg font-medium">{dropLabel}</p>
        </div>
      </div>
    </div>
  )
}
