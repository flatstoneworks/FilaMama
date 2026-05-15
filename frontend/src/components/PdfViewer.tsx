import { useState, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Configure worker - use CDN with version synced to installed pdfjs-dist
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

const PDF_OPTIONS = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
}

interface PdfViewerProps {
  fileUrl: string
  fileName: string
  onLoad?: () => void
}

export function PdfViewer({ fileUrl, fileName, onLoad }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.2)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfData, setPdfData] = useState<Blob | null>(null)

  // Fetch PDF as blob to avoid CORS issues
  useEffect(() => {
    setIsLoading(true)
    setPdfData(null)
    setError(null)
    setNumPages(0)
    setPageNumber(1)

    const controller = new AbortController()
    let cancelled = false

    fetch(fileUrl, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.blob()
      })
      .then(blob => {
        if (cancelled) return
        setPdfData(blob)
      })
      .catch(err => {
        if (cancelled || (err instanceof Error && err.name === 'AbortError')) return
        console.error('Failed to fetch PDF:', err)
        setError(`Failed to fetch PDF: ${err.message}`)
        setIsLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [fileUrl])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setIsLoading(false)
    setError(null)
    onLoad?.()
  }

  const onDocumentLoadError = (error: Error) => {
    console.error('Failed to load PDF:', error)
    console.error('PDF URL:', fileUrl)
    console.error('Error details:', error.message, error)
    setError(`Failed to load PDF: ${error.message}`)
    setIsLoading(false)
    onLoad?.()
  }

  const goToPrevPage = () => setPageNumber((prev) => Math.max(prev - 1, 1))
  const goToNextPage = () => setPageNumber((prev) => Math.min(prev + 1, numPages))
  const zoomIn = () => setScale((prev) => Math.min(prev + 0.2, 3.0))
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.5))

  return (
    <div className="flex flex-col w-[85vw] h-[85vh] bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-card text-foreground border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate max-w-[300px]">{fileName}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Page Navigation */}
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPrevPage}
            disabled={pageNumber <= 1 || isLoading || !!error}
            className="text-foreground hover:bg-accent disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm min-w-[100px] text-center">
            {error ? 'Error' : isLoading ? 'Loading...' : `Page ${pageNumber} of ${numPages}`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToNextPage}
            disabled={pageNumber >= numPages || isLoading || !!error}
            className="text-foreground hover:bg-accent disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border mx-2" />

          {/* Zoom Controls */}
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomOut}
            disabled={scale <= 0.5 || isLoading || !!error}
            className="text-foreground hover:bg-accent disabled:opacity-30"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm w-12 text-center">{Math.round(scale * 100)}%</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomIn}
            disabled={scale >= 3.0 || isLoading || !!error}
            className="text-foreground hover:bg-accent disabled:opacity-30"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Document */}
      <div className="flex-1 overflow-auto flex items-start justify-center bg-muted p-4">
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 className="h-8 w-8 text-foreground animate-spin" />
            <p className="text-foreground text-sm">Loading PDF...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <p className="text-red-400 text-sm">{error}</p>
            <p className="text-muted-foreground text-xs">Try downloading the file instead</p>
          </div>
        )}

        {!error && pdfData && (
          <Document
            key={fileUrl}
            file={pdfData}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={null}
            error={null}
            className={isLoading ? 'hidden' : ''}
            options={PDF_OPTIONS}
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="shadow-2xl"
              loading={
                <div className="flex items-center justify-center min-h-[600px]">
                  <Loader2 className="h-6 w-6 text-foreground animate-spin" />
                </div>
              }
            />
          </Document>
        )}
      </div>
    </div>
  )
}
