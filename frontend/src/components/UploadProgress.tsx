import { X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'

export interface UploadItem {
  id: string
  name: string
  progress: number
  status: 'pending' | 'uploading' | 'completed' | 'error'
  error?: string
}

interface UploadProgressProps {
  uploads: UploadItem[]
  onDismiss: (id: string) => void
  onDismissAll: () => void
}

export function UploadProgress({ uploads, onDismiss, onDismissAll }: UploadProgressProps) {
  if (uploads.length === 0) return null

  const completedCount = uploads.filter((u) => u.status === 'completed').length
  const errorCount = uploads.filter((u) => u.status === 'error').length
  const inProgressCount = uploads.filter((u) => u.status === 'uploading' || u.status === 'pending').length

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-background border rounded-lg shadow-lg z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          {inProgressCount > 0 ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">
                Uploading {inProgressCount} {inProgressCount === 1 ? 'file' : 'files'}
              </span>
            </>
          ) : (
            <span className="text-sm font-medium">
              {completedCount} completed{errorCount > 0 ? `, ${errorCount} failed` : ''}
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDismissAll}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Upload list */}
      <ScrollArea className="max-h-64">
        <div className="p-2 space-y-2">
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className="flex items-center gap-2 p-2 rounded-md bg-muted/50"
            >
              {/* Status icon */}
              {upload.status === 'completed' && (
                <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
              )}
              {upload.status === 'error' && (
                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              )}
              {(upload.status === 'uploading' || upload.status === 'pending') && (
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              )}

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate" title={upload.name}>
                  {upload.name}
                </p>
                {upload.status === 'uploading' && (
                  <Progress value={upload.progress} className="h-1 mt-1" />
                )}
                {upload.status === 'error' && (
                  <p className="text-xs text-destructive">{upload.error || 'Upload failed'}</p>
                )}
              </div>

              {/* Dismiss button */}
              {(upload.status === 'completed' || upload.status === 'error') && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0"
                  onClick={() => onDismiss(upload.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
