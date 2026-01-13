import { useState, useEffect } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { X, Download, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import type { FileInfo } from '@/api/client'
import { getFileType } from './FileIcon'

interface PreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  file: FileInfo | null
  files: FileInfo[]
  currentPath: string
  onNavigate: (file: FileInfo) => void
}

export function PreviewModal({
  open,
  onOpenChange,
  file,
  files,
  currentPath,
  onNavigate,
}: PreviewModalProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [textContent, setTextContent] = useState<string | null>(null)

  const previewableFiles = files.filter((f) => {
    if (f.is_directory) return false
    const type = getFileType(f.name, false)
    return ['image', 'video', 'audio', 'document'].includes(type) ||
           f.name.endsWith('.txt') || f.name.endsWith('.md') || f.name.endsWith('.pdf')
  })

  const currentIndex = file ? previewableFiles.findIndex((f) => f.name === file.name) : -1
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < previewableFiles.length - 1

  const handlePrev = () => {
    if (hasPrev) onNavigate(previewableFiles[currentIndex - 1])
  }

  const handleNext = () => {
    if (hasNext) onNavigate(previewableFiles[currentIndex + 1])
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && hasPrev) handlePrev()
    if (e.key === 'ArrowRight' && hasNext) handleNext()
    if (e.key === 'Escape') onOpenChange(false)
  }

  useEffect(() => {
    if (open) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, currentIndex, hasPrev, hasNext])

  useEffect(() => {
    if (file && open) {
      setIsLoading(true)
      setTextContent(null)

      const ext = file.name.split('.').pop()?.toLowerCase()
      if (ext === 'txt' || ext === 'md') {
        fetch(`/api/files/download?path=${encodeURIComponent(currentPath + '/' + file.name)}`)
          .then((res) => res.text())
          .then((text) => {
            setTextContent(text)
            setIsLoading(false)
          })
          .catch(() => setIsLoading(false))
      }
    }
  }, [file, open, currentPath])

  if (!file) return null

  const fileType = getFileType(file.name, false)
  const fileUrl = `/api/files/download?path=${encodeURIComponent(currentPath + '/' + file.name)}`
  const ext = file.name.split('.').pop()?.toLowerCase()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] w-auto h-auto p-0 overflow-hidden">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
          <h3 className="text-white font-medium truncate max-w-[60%]">{file.name}</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              asChild
            >
              <a href={fileUrl} download={file.name}>
                <Download className="h-5 w-5" />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Navigation arrows */}
        {previewableFiles.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/30 text-white hover:bg-black/50 disabled:opacity-30"
              onClick={handlePrev}
              disabled={!hasPrev}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-black/30 text-white hover:bg-black/50 disabled:opacity-30"
              onClick={handleNext}
              disabled={!hasNext}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </>
        )}

        {/* Content */}
        <div className="flex items-center justify-center min-w-[400px] min-h-[300px] bg-black/90">
          {isLoading && fileType === 'image' && (
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          )}

          {fileType === 'image' && (
            <img
              src={fileUrl}
              alt={file.name}
              className="max-w-full max-h-[85vh] object-contain"
              onLoad={() => setIsLoading(false)}
              style={{ display: isLoading ? 'none' : 'block' }}
            />
          )}

          {fileType === 'video' && (
            <video
              src={fileUrl}
              controls
              autoPlay
              className="max-w-full max-h-[85vh]"
              onLoadedData={() => setIsLoading(false)}
            />
          )}

          {fileType === 'audio' && (
            <div className="p-8">
              <audio
                src={fileUrl}
                controls
                autoPlay
                className="w-80"
                onLoadedData={() => setIsLoading(false)}
              />
            </div>
          )}

          {ext === 'pdf' && (
            <iframe
              src={fileUrl}
              className="w-[80vw] h-[85vh]"
              onLoad={() => setIsLoading(false)}
            />
          )}

          {(ext === 'txt' || ext === 'md') && textContent !== null && (
            <pre className="w-[80vw] h-[85vh] overflow-auto p-6 text-white text-sm font-mono whitespace-pre-wrap">
              {textContent}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
