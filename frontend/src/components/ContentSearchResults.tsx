import { FileIcon } from './FileIcon'
import type { FileInfo } from '@/api/client'
import type { ContentSearchResult } from '@/api/client'
import { formatBytes, formatFileDate } from '@/lib/utils'

interface ContentSearchResultsProps {
  files: (FileInfo & { contentMatches?: ContentSearchResult['matches'] })[]
  onOpen: (file: FileInfo) => void
  searchQuery: string
}

/**
 * Highlights matching text within a string
 */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text

  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const index = lowerText.indexOf(lowerQuery)

  if (index === -1) return text

  const before = text.slice(0, index)
  const match = text.slice(index, index + query.length)
  const after = text.slice(index + query.length)

  return (
    <>
      {before}
      <mark className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">{match}</mark>
      {after}
    </>
  )
}

export function ContentSearchResults({ files, onOpen, searchQuery }: ContentSearchResultsProps) {
  if (files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        No matches found
      </div>
    )
  }

  return (
    <div className="flex flex-col divide-y">
      {files.map((file) => (
        <div key={file.path} className="p-3 hover:bg-accent/30 transition-colors">
          {/* File header */}
          <button
            onClick={() => onOpen(file)}
            className="flex items-center gap-3 w-full text-left group"
          >
            <FileIcon name={file.name} isDirectory={false} size={20} />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate group-hover:text-primary transition-colors">
                {file.name}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {file.path}
              </div>
            </div>
            <div className="text-xs text-muted-foreground shrink-0">
              {formatBytes(file.size)} • {formatFileDate(file.modified)}
            </div>
          </button>

          {/* Matching lines */}
          {file.contentMatches && file.contentMatches.length > 0 && (
            <div className="mt-2 ml-8 space-y-1">
              {file.contentMatches.map((match, idx) => (
                <button
                  key={`${match.line_number}-${idx}`}
                  onClick={() => onOpen(file)}
                  className="flex items-start gap-2 text-xs w-full text-left hover:bg-accent/50 rounded p-1 -ml-1 transition-colors"
                >
                  <span className="text-muted-foreground shrink-0 w-8 text-right font-mono">
                    {match.line_number}
                  </span>
                  <code className="text-foreground/80 break-all font-mono">
                    {highlightMatch(match.line_content, searchQuery)}
                  </code>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
