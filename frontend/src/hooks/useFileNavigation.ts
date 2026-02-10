import { useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { FileInfo } from '@/api/client'
import { isAudioFile } from '@/components/FileIcon'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'

function encodePathForUrl(path: string) {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/')
}

export function useFileNavigation(
  clearSelection: () => void,
) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { playTrack } = useAudioPlayer()

  const handleNavigate = useCallback((path: string) => {
    const encodedPath = encodePathForUrl(path)
    const urlPath = path === '/' ? '/browse' : `/browse${encodedPath}`

    const newParams = new URLSearchParams()
    const currentView = searchParams.get('view')
    const currentSize = searchParams.get('size')

    if (currentView) newParams.set('view', currentView)
    if (currentSize) newParams.set('size', currentSize)

    const fullUrl = newParams.toString() ? `${urlPath}?${newParams.toString()}` : urlPath
    navigate(fullUrl)
    clearSelection()
  }, [navigate, searchParams, clearSelection])

  const openPreview = useCallback((file: FileInfo) => {
    const previewPath = file.path
    const encodedPath = previewPath.split('/').map(s => encodeURIComponent(s)).join('/')
    navigate(`/view${encodedPath}`)
  }, [navigate])

  const handleOpen = useCallback((file: FileInfo, displayedFiles: FileInfo[]) => {
    if (file.is_directory) {
      handleNavigate(file.path)
    } else if (isAudioFile(file.name)) {
      playTrack(file, displayedFiles)
    } else {
      openPreview(file)
    }
  }, [handleNavigate, openPreview, playTrack])

  const handleDownload = useCallback((file: FileInfo) => {
    const link = document.createElement('a')
    link.href = `/api/files/download?path=${encodeURIComponent(file.path)}`
    link.download = file.name
    link.click()
  }, [])

  return { handleNavigate, openPreview, handleOpen, handleDownload }
}
