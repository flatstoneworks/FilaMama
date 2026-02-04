import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { FileInfo } from '@/api/client'
import { api } from '@/api/client'

export interface AudioTrack {
  file: FileInfo
  url: string
}

interface AudioPlayerContextType {
  playlist: AudioTrack[]
  currentIndex: number
  isOpen: boolean
  playTrack: (file: FileInfo, allFiles: FileInfo[]) => void
  setCurrentIndex: (index: number) => void
  close: () => void
}

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null)

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const [playlist, setPlaylist] = useState<AudioTrack[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isOpen, setIsOpen] = useState(false)

  // Helper to check if a file is audio
  const isAudioFile = (name: string): boolean => {
    const ext = name.split('.').pop()?.toLowerCase() || ''
    return ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus'].includes(ext)
  }

  const playTrack = useCallback((file: FileInfo, allFiles: FileInfo[]) => {
    // Filter to only audio files from the provided list
    const audioFiles = allFiles.filter(f => !f.is_directory && isAudioFile(f.name))

    // Create playlist with stream URLs
    const newPlaylist: AudioTrack[] = audioFiles.map(f => ({
      file: f,
      url: api.getStreamUrl(f.path),
    }))

    // Find the index of the clicked file
    const clickedIndex = audioFiles.findIndex(f => f.path === file.path)

    setPlaylist(newPlaylist)
    setCurrentIndex(clickedIndex >= 0 ? clickedIndex : 0)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setPlaylist([])
    setCurrentIndex(0)
  }, [])

  return (
    <AudioPlayerContext.Provider
      value={{
        playlist,
        currentIndex,
        isOpen,
        playTrack,
        setCurrentIndex,
        close,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  )
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext)
  if (!context) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider')
  }
  return context
}
