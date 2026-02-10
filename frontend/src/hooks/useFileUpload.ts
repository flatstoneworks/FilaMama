import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { UploadItem } from '@/components/UploadProgress'
import { toast } from '@/components/ui/use-toast'

const CONCURRENT_UPLOADS = 3

export function useFileUpload(currentPath: string, maxUploadSizeMb?: number) {
  const queryClient = useQueryClient()
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [isPreparingUpload, setIsPreparingUpload] = useState(false)

  const handleUpload = useCallback(
    async (fileList: FileList | File[]) => {
      const filesArray = Array.isArray(fileList) ? fileList : Array.from(fileList)

      const maxSizeBytes = (maxUploadSizeMb || 1024) * 1024 * 1024
      const oversizedFiles = filesArray.filter(f => f.size > maxSizeBytes)
      if (oversizedFiles.length > 0) {
        const sizeLimit = maxUploadSizeMb || 1024
        toast({
          title: `${oversizedFiles.length} file(s) exceed size limit`,
          description: `Maximum file size is ${sizeLimit} MB. Oversized files will be skipped.`,
          variant: 'destructive',
        })
      }

      const validFiles = filesArray.filter(f => f.size <= maxSizeBytes)
      if (validFiles.length === 0) {
        setIsPreparingUpload(false)
        return
      }

      const newUploads: UploadItem[] = validFiles.map((file) => ({
        id: Math.random().toString(36).slice(2),
        name: (file as any).customRelativePath || (file as any).webkitRelativePath || file.name,
        progress: 0,
        status: 'pending' as const,
        file: file,
        relativePath: (file as any).customRelativePath || (file as any).webkitRelativePath || '',
        totalBytes: file.size,
        bytesUploaded: 0,
      }))

      setUploads((prev) => [...prev, ...newUploads])
      setIsPreparingUpload(false)

      const uploadSingleFile = async (uploadItem: UploadItem, file: File) => {
        const relativePath = uploadItem.relativePath || ''
        let lastBytesUploaded = 0
        let lastTimestamp = Date.now()

        try {
          setUploads((prev) =>
            prev.map((u) => (u.id === uploadItem.id ? { ...u, status: 'uploading', startTime: Date.now() } : u))
          )

          await api.uploadFile(file, currentPath, (progress) => {
            const now = Date.now()
            const timeDelta = (now - lastTimestamp) / 1000
            const bytesDelta = progress.bytesUploaded - lastBytesUploaded
            const speed = timeDelta > 0 ? bytesDelta / timeDelta : 0

            lastBytesUploaded = progress.bytesUploaded
            lastTimestamp = now

            setUploads((prev) =>
              prev.map((u) => (u.id === uploadItem.id ? {
                ...u,
                progress: progress.percent,
                bytesUploaded: progress.bytesUploaded,
                totalBytes: progress.totalBytes,
                speed: speed > 0 ? speed : u.speed,
              } : u))
            )
          }, relativePath)

          setUploads((prev) =>
            prev.map((u) =>
              u.id === uploadItem.id ? { ...u, status: 'completed', progress: 100 } : u
            )
          )
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Upload failed'
          setUploads((prev) =>
            prev.map((u) =>
              u.id === uploadItem.id
                ? { ...u, status: 'error', error: errorMessage }
                : u
            )
          )
        }
      }

      const processInBatches = async () => {
        for (let i = 0; i < validFiles.length; i += CONCURRENT_UPLOADS) {
          const batch = validFiles.slice(i, i + CONCURRENT_UPLOADS)
          const batchUploads = newUploads.slice(i, i + CONCURRENT_UPLOADS)
          await Promise.all(
            batch.map((file, idx) => uploadSingleFile(batchUploads[idx], file))
          )
        }
      }

      await processInBatches()
      queryClient.invalidateQueries({ queryKey: ['files', currentPath] })
    },
    [currentPath, queryClient, maxUploadSizeMb]
  )

  const handleRetry = useCallback(
    async (item: UploadItem) => {
      if (!item.file) return

      setUploads((prev) =>
        prev.map((u) => (u.id === item.id ? {
          ...u,
          status: 'pending' as const,
          progress: 0,
          error: undefined,
          bytesUploaded: 0,
          speed: undefined,
        } : u))
      )

      const file = item.file
      const relativePath = item.relativePath || ''
      let lastBytesUploaded = 0
      let lastTimestamp = Date.now()

      try {
        setUploads((prev) =>
          prev.map((u) => (u.id === item.id ? { ...u, status: 'uploading', startTime: Date.now() } : u))
        )

        await api.uploadFile(file, currentPath, (progress) => {
          const now = Date.now()
          const timeDelta = (now - lastTimestamp) / 1000
          const bytesDelta = progress.bytesUploaded - lastBytesUploaded
          const speed = timeDelta > 0 ? bytesDelta / timeDelta : 0

          lastBytesUploaded = progress.bytesUploaded
          lastTimestamp = now

          setUploads((prev) =>
            prev.map((u) => (u.id === item.id ? {
              ...u,
              progress: progress.percent,
              bytesUploaded: progress.bytesUploaded,
              totalBytes: progress.totalBytes,
              speed: speed > 0 ? speed : u.speed,
            } : u))
          )
        }, relativePath)

        setUploads((prev) =>
          prev.map((u) =>
            u.id === item.id ? { ...u, status: 'completed', progress: 100 } : u
          )
        )
        queryClient.invalidateQueries({ queryKey: ['files', currentPath] })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Upload failed'
        setUploads((prev) =>
          prev.map((u) =>
            u.id === item.id
              ? { ...u, status: 'error', error: errorMessage }
              : u
          )
        )
      }
    },
    [currentPath, queryClient]
  )

  const dismissUpload = useCallback((id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id))
  }, [])

  const dismissAllUploads = useCallback(() => {
    setUploads([])
    setIsPreparingUpload(false)
  }, [])

  return {
    uploads,
    isPreparingUpload,
    setIsPreparingUpload,
    handleUpload,
    handleRetry,
    dismissUpload,
    dismissAllUploads,
  }
}
