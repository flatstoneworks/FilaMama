import { X, CheckCircle, AlertCircle, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatUploadSpeed, formatETA, formatBytes } from '@/lib/utils'

export interface UploadItem {
  id: string
  name: string
  progress: number
  status: 'pending' | 'uploading' | 'completed' | 'error'
  error?: string
  // For retry and speed tracking
  file?: File
  relativePath?: string
  bytesUploaded?: number
  totalBytes?: number
  speed?: number      // bytes/sec
  startTime?: number  // timestamp when upload started
}

interface UploadProgressProps {
  uploads: UploadItem[]
  isPreparing?: boolean
  onDismiss: (id: string) => void
  onDismissAll: () => void
  onRetry?: (item: UploadItem) => void
}

export function UploadProgress({ uploads, isPreparing, onDismiss, onDismissAll, onRetry }: UploadProgressProps) {
  // Show panel if preparing or if there are uploads
  if (!isPreparing && uploads.length === 0) return null

  const completedCount = uploads.filter((u) => u.status === 'completed').length
  const errorCount = uploads.filter((u) => u.status === 'error').length
  const inProgressCount = uploads.filter((u) => u.status === 'uploading' || u.status === 'pending').length

  // Calculate overall stats
  const activeUploads = uploads.filter(u => u.status === 'uploading')
  const totalSpeed = activeUploads.reduce((sum, u) => sum + (u.speed || 0), 0)
  const totalRemaining = activeUploads.reduce((sum, u) => {
    const remaining = (u.totalBytes || 0) - (u.bytesUploaded || 0)
    return sum + remaining
  }, 0)
  const overallETA = totalSpeed > 0 ? totalRemaining / totalSpeed : 0

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-background border rounded-lg shadow-lg z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex flex-col gap-0.5">
          {isPreparing ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">Scanning folders...</span>
            </div>
          ) : inProgressCount > 0 ? (
            <>
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm font-medium">
                  Uploading {inProgressCount} {inProgressCount === 1 ? 'file' : 'files'}
                </span>
              </div>
              {totalSpeed > 0 && (
                <span className="text-xs text-muted-foreground">
                  {formatUploadSpeed(totalSpeed)} • ETA: {formatETA(overallETA)}
                </span>
              )}
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
                  <>
                    <Progress value={upload.progress} className="h-1 mt-1" />
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                      <span>
                        {upload.bytesUploaded !== undefined && upload.totalBytes
                          ? `${formatBytes(upload.bytesUploaded)} / ${formatBytes(upload.totalBytes)}`
                          : `${Math.round(upload.progress)}%`}
                      </span>
                      {upload.speed !== undefined && upload.speed > 0 && (
                        <span>
                          {formatUploadSpeed(upload.speed)}
                          {upload.totalBytes && upload.bytesUploaded !== undefined && (
                            ` • ${formatETA((upload.totalBytes - upload.bytesUploaded) / upload.speed)}`
                          )}
                        </span>
                      )}
                    </div>
                  </>
                )}
                {upload.status === 'error' && (
                  <p className="text-xs text-destructive">{upload.error || 'Upload failed'}</p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Retry button for failed uploads */}
                {upload.status === 'error' && upload.file && onRetry && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => onRetry(upload)}
                    title="Retry upload"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                )}
                {/* Dismiss button */}
                {(upload.status === 'completed' || upload.status === 'error') && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => onDismiss(upload.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
