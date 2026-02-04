import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Download, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { getFileType, isPreviewable, isTextFile, getLanguageFromExtension } from '@/components/FileIcon'
import { joinPath, getParentPath, getFileName } from '@/lib/utils'
import { PdfViewer } from '@/components/PdfViewer'
import { VideoPlayer } from '@/components/VideoPlayer'

export function PreviewPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isLoading, setIsLoading] = useState(true)
  const [textContent, setTextContent] = useState<string | null>(null)

  // Derive file path from URL: /view/Documents/image.jpg → /Documents/image.jpg
  // Need to decode the pathname since React Router may not decode it
  const filePath = useMemo(() => {
    const path = decodeURIComponent(location.pathname).replace(/^\/view/, '') || '/'
    return path === '' ? '/' : path
  }, [location.pathname])

  // Get directory path and file name from the full path
  const dirPath = getParentPath(filePath) || '/'
  const fileName = getFileName(filePath)

  // Fetch files from the directory to enable navigation
  const { data: listing } = useQuery({
    queryKey: ['files', dirPath],
    queryFn: () => api.listDirectory(dirPath),
  })

  const files = listing?.files || []

  // Find the current file in the directory listing
  const currentFile = useMemo(() => {
    return files.find((f) => f.name === fileName) || null
  }, [files, fileName])

  // Get list of previewable files for navigation
  const previewableFiles = useMemo(() => {
    return files.filter((f) => {
      if (f.is_directory) return false
      return isPreviewable(f.name)
    })
  }, [files])

  const currentIndex = currentFile
    ? previewableFiles.findIndex((f) => f.name === currentFile.name)
    : -1
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < previewableFiles.length - 1

  const fileType = currentFile ? getFileType(currentFile.name, false) : 'default'
  const ext = currentFile?.name.split('.').pop()?.toLowerCase()

  // Helper to encode path for URL (encode each segment)
  const encodePathForUrl = (path: string) => {
    return path.split('/').map(segment => encodeURIComponent(segment)).join('/')
  }

  const handlePrev = () => {
    if (hasPrev) {
      const prevFile = previewableFiles[currentIndex - 1]
      navigate(`/view${encodePathForUrl(joinPath(dirPath, prevFile.name))}`)
    }
  }

  const handleNext = () => {
    if (hasNext) {
      const nextFile = previewableFiles[currentIndex + 1]
      navigate(`/view${encodePathForUrl(joinPath(dirPath, nextFile.name))}`)
    }
  }

  const handleBack = () => {
    // Navigate back to the directory
    const browseUrl = dirPath === '/' ? '/browse' : `/browse${encodePathForUrl(dirPath)}`
    navigate(browseUrl)
  }

  // Keyboard navigation
  // Note: Arrow keys are disabled for video files since VideoPlayer uses them for seeking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't use arrow keys for video navigation - VideoPlayer handles those
      if (fileType === 'video') {
        if (e.key === 'Escape') handleBack()
        return
      }
      if (e.key === 'ArrowLeft' && hasPrev) handlePrev()
      if (e.key === 'ArrowRight' && hasNext) handleNext()
      if (e.key === 'Escape') handleBack()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hasPrev, hasNext, currentIndex, fileType])

  // Load text content for text/code files
  useEffect(() => {
    if (currentFile) {
      setIsLoading(true)
      setTextContent(null)

      if (isTextFile(currentFile.name)) {
        const downloadUrl = api.getDownloadUrl(filePath)
        fetch(downloadUrl)
          .then((res) => res.text())
          .then((text) => {
            setTextContent(text)
            setIsLoading(false)
          })
          .catch(() => setIsLoading(false))
      } else {
        // For non-text files, loading is handled by the media element
        setIsLoading(true)
      }
    }
  }, [currentFile, filePath])

  // Get URLs with cache-busting
  const fileUrl = currentFile
    ? api.getPreviewUrl(filePath, currentFile.modified)
    : ''
  const streamUrl = currentFile
    ? api.getStreamUrl(filePath, currentFile.modified)
    : ''
  const downloadUrl = api.getDownloadUrl(filePath)

  return (
    <div className="h-screen flex flex-col bg-black">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-black/80 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            onClick={handleBack}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-white font-medium truncate max-w-[50vw]">
            {fileName || 'Preview'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Navigation info */}
          {previewableFiles.length > 1 && (
            <span className="text-white/60 text-sm mr-4">
              {currentIndex + 1} / {previewableFiles.length}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            asChild
          >
            <a href={downloadUrl} download={fileName}>
              <Download className="h-5 w-5" />
            </a>
          </Button>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 relative overflow-hidden flex items-center justify-center">
        {/* Navigation arrows */}
        {previewableFiles.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-30"
              onClick={handlePrev}
              disabled={!hasPrev}
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-30"
              onClick={handleNext}
              disabled={!hasNext}
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          </>
        )}

        {/* Content */}
        <div className="w-full h-full flex items-center justify-center p-4">
          {!currentFile && !listing ? (
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          ) : !currentFile ? (
            <div className="text-center text-white">
              <p className="text-lg">File not found</p>
              <p className="text-white/60 text-sm mt-2">{fileName}</p>
            </div>
          ) : (
            <>
              {isLoading && fileType === 'image' && (
                <Loader2 className="h-8 w-8 text-white animate-spin absolute" />
              )}

              {fileType === 'image' && (
                <div
                  className={ext === 'svg' ? 'rounded-lg p-4' : ''}
                  style={{
                    display: isLoading ? 'none' : 'block',
                    ...(ext === 'svg' ? {
                      backgroundImage: `
                        linear-gradient(45deg, #e0e0e0 25%, transparent 25%),
                        linear-gradient(-45deg, #e0e0e0 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #e0e0e0 75%),
                        linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)
                      `,
                      backgroundSize: '20px 20px',
                      backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                      backgroundColor: '#fff',
                    } : {}),
                  }}
                >
                  <img
                    src={fileUrl}
                    alt={currentFile.name}
                    className="max-w-full max-h-full object-contain"
                    onLoad={() => setIsLoading(false)}
                  />
                </div>
              )}

              {fileType === 'video' && (
                <VideoPlayer
                  fileUrl={streamUrl}
                  fileName={currentFile.name}
                  onLoad={() => setIsLoading(false)}
                />
              )}

              {fileType === 'audio' && (
                <div className="p-8 bg-white/5 rounded-lg">
                  <p className="text-white text-center mb-4">{currentFile.name}</p>
                  <audio
                    src={streamUrl}
                    controls
                    autoPlay
                    className="w-80"
                    onLoadedData={() => setIsLoading(false)}
                  />
                </div>
              )}

              {ext === 'pdf' && (
                <PdfViewer
                  fileUrl={fileUrl}
                  fileName={currentFile.name}
                  onLoad={() => setIsLoading(false)}
                />
              )}

              {isTextFile(currentFile.name) && textContent !== null && (
                <div className="w-full max-w-5xl h-full overflow-auto rounded-lg">
                  <SyntaxHighlighter
                    language={getLanguageFromExtension(currentFile.name)}
                    style={oneDark}
                    showLineNumbers
                    wrapLines
                    customStyle={{
                      margin: 0,
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      minHeight: '100%',
                    }}
                    lineNumberStyle={{
                      minWidth: '3em',
                      paddingRight: '1em',
                      color: '#636d83',
                      userSelect: 'none',
                    }}
                  >
                    {textContent}
                  </SyntaxHighlighter>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
