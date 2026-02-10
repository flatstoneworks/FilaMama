import { useState, useRef, useCallback } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getLanguageFromExtension } from './FileIcon'

interface TextPreviewProps {
  src: string           // URL to fetch text content
  fileName: string      // Filename for language detection
  className?: string
  maxLines?: number     // Max lines to show (default 12)
  width?: number
  height?: number
}

export function TextPreview({
  src,
  fileName,
  className,
  maxLines = 12,
  width,
  height,
}: TextPreviewProps) {
  const [isHovering, setIsHovering] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const fetchAbortRef = useRef<AbortController | null>(null)

  const handleMouseEnter = useCallback(() => {
    setIsHovering(true)

    // Only fetch if we haven't already
    if (content !== null || isLoading) return

    setIsLoading(true)
    setError(false)

    // Create abort controller for cleanup
    fetchAbortRef.current = new AbortController()

    fetch(src, { signal: fetchAbortRef.current.signal })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load')
        return res.text()
      })
      .then(text => {
        // Limit to first N lines
        const lines = text.split('\n')
        const preview = lines.slice(0, maxLines).join('\n')
        const hasMore = lines.length > maxLines
        setContent(hasMore ? preview + '\n...' : preview)
        setIsLoading(false)
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setError(true)
          setIsLoading(false)
        }
      })
  }, [src, content, isLoading, maxLines])

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false)

    // Abort any pending fetch
    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort()
      fetchAbortRef.current = null
    }
  }, [])

  const language = getLanguageFromExtension(fileName)

  const style: React.CSSProperties = {}
  if (width) style.width = width
  if (height) style.height = height

  return (
    <div
      className={cn('relative overflow-hidden bg-muted rounded', className)}
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Default state - show file icon placeholder */}
      {!isHovering && !content && (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-[10px] text-white/40 font-mono uppercase">
            {fileName.split('.').pop()}
          </div>
        </div>
      )}

      {/* Loading state */}
      {isHovering && isLoading && (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 className="h-4 w-4 text-white/60 animate-spin" />
        </div>
      )}

      {/* Error state */}
      {isHovering && error && (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-xs text-white/40">Preview unavailable</span>
        </div>
      )}

      {/* Content preview */}
      {content && (
        <div
          className={cn(
            'w-full h-full overflow-hidden transition-opacity',
            isHovering ? 'opacity-100' : 'opacity-70'
          )}
        >
          <SyntaxHighlighter
            language={language}
            style={oneDark}
            customStyle={{
              margin: 0,
              padding: '4px 6px',
              fontSize: '7px',
              lineHeight: '1.3',
              background: 'transparent',
              overflow: 'hidden',
              height: '100%',
            }}
            codeTagProps={{
              style: {
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              }
            }}
          >
            {content}
          </SyntaxHighlighter>
        </div>
      )}

      {/* Hover indicator */}
      {isHovering && content && (
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-muted to-transparent pointer-events-none" />
      )}
    </div>
  )
}
