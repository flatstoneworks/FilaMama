import { useState, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Configure worker - use CDN with specific version to match react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs`

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
  const [pdfData, setPdfData] = useState<string | null>(null)

  // Fetch PDF as blob to avoid CORS issues
  useEffect(() => {
    setIsLoading(true)
    setPdfData(null)
    setError(null)

    fetch(fileUrl)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.blob()
      })
      .then(blob => {
        const url = URL.createObjectURL(blob)
        setPdfData(url)
      })
      .catch(err => {
        console.error('Failed to fetch PDF:', err)
        setError(`Failed to fetch PDF: ${err.message}`)
        setIsLoading(false)
      })

    // Cleanup blob URL on unmount
    return () => {
      if (pdfData) {
        URL.revokeObjectURL(pdfData)
      }
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
    <div className="flex flex-col w-[85vw] h-[85vh] bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-white border-b border-gray-700">
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
            className="text-white hover:bg-gray-700 disabled:opacity-30"
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
            className="text-white hover:bg-gray-700 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-gray-700 mx-2" />

          {/* Zoom Controls */}
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomOut}
            disabled={scale <= 0.5 || isLoading || !!error}
            className="text-white hover:bg-gray-700 disabled:opacity-30"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm w-12 text-center">{Math.round(scale * 100)}%</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomIn}
            disabled={scale >= 3.0 || isLoading || !!error}
            className="text-white hover:bg-gray-700 disabled:opacity-30"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Document */}
      <div className="flex-1 overflow-auto flex items-start justify-center bg-gray-800 p-4">
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 className="h-8 w-8 text-white animate-spin" />
            <p className="text-white text-sm">Loading PDF...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <p className="text-red-400 text-sm">{error}</p>
            <p className="text-gray-400 text-xs">Try downloading the file instead</p>
          </div>
        )}

        {!error && pdfData && (
          <Document
            file={pdfData}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={null}
            error={null}
            className={isLoading ? 'hidden' : ''}
            options={{
              cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
              cMapPacked: true,
              standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
            }}
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="shadow-2xl"
              loading={
                <div className="flex items-center justify-center min-h-[600px]">
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                </div>
              }
            />
          </Document>
        )}
      </div>
    </div>
  )
}
