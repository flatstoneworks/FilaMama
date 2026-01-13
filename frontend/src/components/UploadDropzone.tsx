import { useCallback, useState } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UploadDropzoneProps {
  onUpload: (files: FileList) => void
  children: React.ReactNode
}

export function UploadDropzone({ onUpload, children }: UploadDropzoneProps) {
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
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      setDragCounter(0)

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onUpload(e.dataTransfer.files)
      }
    },
    [onUpload]
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
