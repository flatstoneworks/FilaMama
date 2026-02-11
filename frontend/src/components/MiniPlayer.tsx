import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X, Music, Shuffle, Repeat, Repeat1, Maximize2, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn, formatVideoTime } from '@/lib/utils'
import type { FileInfo, AudioMetadata } from '@/api/client'
import { api } from '@/api/client'

export interface AudioTrack {
  file: FileInfo
  url: string
}

interface MiniPlayerProps {
  playlist: AudioTrack[]
  currentIndex: number
  onIndexChange: (index: number) => void
  onClose: () => void
}

type RepeatMode = 'off' | 'all' | 'one'

// Storage keys
const STORAGE_KEYS = {
  volume: 'filamama-player-volume',
  shuffle: 'filamama-player-shuffle',
  repeat: 'filamama-player-repeat',
}

// Format bitrate for display (e.g., 320000 -> "320 kbps")
function formatBitrate(bitrate: number | null): string {
  if (!bitrate) return ''
  return `${Math.round(bitrate / 1000)} kbps`
}

// Format sample rate for display (e.g., 44100 -> "44.1 kHz")
function formatSampleRate(sampleRate: number | null): string {
  if (!sampleRate) return ''
  return `${(sampleRate / 1000).toFixed(1)} kHz`
}

export function MiniPlayer({
  playlist,
  currentIndex,
  onIndexChange,
  onClose,
}: MiniPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // Persisted settings - load from localStorage
  const [volume, setVolume] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.volume)
    return stored ? parseFloat(stored) : 0.7
  })
  const [isMuted, setIsMuted] = useState(false)
  const [shuffle, setShuffle] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.shuffle)
    return stored === 'true'
  })
  const [repeat, setRepeat] = useState<RepeatMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.repeat)
    return (stored as RepeatMode) || 'off'
  })

  // Metadata state
  const [metadata, setMetadata] = useState<AudioMetadata | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [coverError, setCoverError] = useState(false)
  const [lyrics, setLyrics] = useState<string | null>(null)

  // Expanded view state
  const [showExpanded, setShowExpanded] = useState(false)

  const currentTrack = playlist[currentIndex]

  // Persist settings to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.volume, volume.toString())
  }, [volume])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.shuffle, shuffle.toString())
  }, [shuffle])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.repeat, repeat)
  }, [repeat])

  // Fetch metadata when track changes
  useEffect(() => {
    if (!currentTrack) {
      setMetadata(null)
      setCoverUrl(null)
      setCoverError(false)
      setLyrics(null)
      return
    }

    // Reset state
    setMetadata(null)
    setCoverError(false)
    setLyrics(null)

    // Fetch metadata
    api.getAudioMetadata(currentTrack.file.path).then(data => {
      setMetadata(data)
      if (data?.has_cover) {
        setCoverUrl(api.getAudioCoverUrl(currentTrack.file.path))
      } else {
        setCoverUrl(null)
      }
      // Fetch lyrics if available
      if (data?.has_lyrics) {
        api.getAudioLyrics(currentTrack.file.path).then(setLyrics)
      }
    })
  }, [currentTrack?.file.path])

  // Get display title and artist
  const displayTitle = metadata?.title || currentTrack?.file.name.replace(/\.[^/.]+$/, '') || 'Unknown'
  const displayArtist = metadata?.artist || null
  const displayAlbum = metadata?.album || null

  // Audio quality info
  const qualityInfo = metadata ? [
    metadata.format,
    formatBitrate(metadata.bitrate),
    formatSampleRate(metadata.sample_rate),
  ].filter(Boolean).join(' · ') : ''

  // Play/pause
  const togglePlay = useCallback(() => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
  }, [isPlaying])

  // Next track
  const playNext = useCallback(() => {
    if (playlist.length === 0) return

    if (repeat === 'one') {
      // Repeat current track
      if (audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play()
      }
      return
    }

    let nextIndex: number
    if (shuffle) {
      // Random track (excluding current)
      const availableIndices = playlist
        .map((_, i) => i)
        .filter(i => i !== currentIndex)
      nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)]
    } else {
      nextIndex = currentIndex + 1
    }

    if (nextIndex >= playlist.length) {
      if (repeat === 'all') {
        nextIndex = 0
      } else {
        // Stop at end
        setIsPlaying(false)
        return
      }
    }

    onIndexChange(nextIndex)
  }, [playlist, currentIndex, shuffle, repeat, onIndexChange])

  // Previous track
  const playPrev = useCallback(() => {
    if (playlist.length === 0) return

    // If more than 3 seconds in, restart current track
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0
      return
    }

    let prevIndex: number
    if (shuffle) {
      const availableIndices = playlist
        .map((_, i) => i)
        .filter(i => i !== currentIndex)
      prevIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)]
    } else {
      prevIndex = currentIndex - 1
    }

    if (prevIndex < 0) {
      if (repeat === 'all') {
        prevIndex = playlist.length - 1
      } else {
        prevIndex = 0
      }
    }

    onIndexChange(prevIndex)
  }, [playlist, currentIndex, shuffle, repeat, onIndexChange])

  // Handle track end
  const handleEnded = useCallback(() => {
    playNext()
  }, [playNext])

  // Update time display
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  // Handle metadata loaded
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  // Handle play/pause state
  const handlePlay = () => setIsPlaying(true)
  const handlePause = () => setIsPlaying(false)

  // Seek
  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0]
      setCurrentTime(value[0])
    }
  }

  // Volume
  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0]
    setVolume(newVolume)
    if (audioRef.current) {
      audioRef.current.volume = newVolume
    }
    if (newVolume > 0 && isMuted) {
      setIsMuted(false)
    }
  }

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  // Toggle repeat mode
  const toggleRepeat = () => {
    const modes: RepeatMode[] = ['off', 'all', 'one']
    const currentIdx = modes.indexOf(repeat)
    setRepeat(modes[(currentIdx + 1) % modes.length])
  }

  // Auto-play when track changes
  useEffect(() => {
    if (audioRef.current && currentTrack) {
      audioRef.current.play().catch(() => {
        // Autoplay might be blocked
        setIsPlaying(false)
      })
    }
  }, [currentTrack?.url])

  // Set volume on mount
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [])

  // Keyboard shortcuts
  // Space: play/pause (file browser defers via isAudioPlayerOpen check)
  // Shift+Arrow: prev/next track (file browser defers via isAudioPlayerOpen check)
  // M: mute/unmute
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
          if (e.shiftKey) {
            e.preventDefault()
            playPrev()
          }
          break
        case 'ArrowRight':
          if (e.shiftKey) {
            e.preventDefault()
            playNext()
          }
          break
        case 'm':
          if (!e.ctrlKey && !e.metaKey) {
            toggleMute()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay, playPrev, playNext])

  if (!currentTrack) return null

  return (
    <>
      <div className="fixed bottom-0 left-52 right-0 bg-background border-t shadow-lg z-50">
        <audio
          ref={audioRef}
          src={currentTrack.url}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          onPlay={handlePlay}
          onPause={handlePause}
        />

        {/* Progress bar (thin, at top of player) */}
        <div className="h-1 bg-muted">
          <Slider
            value={[currentTime]}
            min={0}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="h-1 cursor-pointer [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:opacity-0 hover:[&_[role=slider]]:opacity-100"
          />
        </div>

        <div className="flex items-center gap-4 px-4 py-2">
          {/* Track info with cover art */}
          <div className="flex items-center gap-3 min-w-0 w-72">
            {/* Cover art or music icon - clickable to expand */}
            <button
              className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer"
              onClick={() => setShowExpanded(true)}
              title="Show details"
            >
              {coverUrl && !coverError ? (
                <img
                  src={coverUrl}
                  alt="Album cover"
                  className="w-full h-full object-cover"
                  onError={() => setCoverError(true)}
                />
              ) : (
                <Music className="h-6 w-6 text-muted-foreground" />
              )}
            </button>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" title={displayTitle}>
                {displayTitle}
              </p>
              {displayArtist ? (
                <p className="text-xs text-muted-foreground truncate" title={`${displayArtist}${displayAlbum ? ` - ${displayAlbum}` : ''}`}>
                  {displayArtist}{displayAlbum && ` - ${displayAlbum}`}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {currentIndex + 1} / {playlist.length}
                </p>
              )}
              {/* Quality info */}
              {qualityInfo && (
                <p className="text-[10px] text-muted-foreground/70 truncate" title={qualityInfo}>
                  {qualityInfo}
                </p>
              )}
            </div>
          </div>

          {/* Main controls */}
          <div className="flex items-center gap-2 flex-1 justify-center">
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-8 w-8', shuffle && 'text-primary')}
              onClick={() => setShuffle(!shuffle)}
              title="Shuffle"
              aria-label={shuffle ? 'Shuffle on' : 'Shuffle off'}
            >
              <Shuffle className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={playPrev}
              title="Previous (Shift+Left)"
              aria-label="Previous track"
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button
              variant="default"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={togglePlay}
              title="Play/Pause (Space)"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={playNext}
              title="Next (Shift+Right)"
              aria-label="Next track"
            >
              <SkipForward className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className={cn('h-8 w-8', repeat !== 'off' && 'text-primary')}
              onClick={toggleRepeat}
              title={`Repeat: ${repeat}`}
              aria-label={`Repeat ${repeat}`}
            >
              {repeat === 'one' ? (
                <Repeat1 className="h-4 w-4" />
              ) : (
                <Repeat className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Time and volume */}
          <div className="flex items-center gap-4 w-64 justify-end">
            <span className="text-xs text-muted-foreground tabular-nums w-24 text-right">
              {formatVideoTime(currentTime)} / {formatVideoTime(duration)}
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={toggleMute}
                title="Mute (M)"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
                className="w-20"
              />
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowExpanded(true)}
              title="Expand"
              aria-label="Expand player"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
              title="Close player"
              aria-label="Close player"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded view dialog */}
      <Dialog open={showExpanded} onOpenChange={setShowExpanded}>
        <DialogContent className="max-w-2xl max-h-[80vh] p-0 overflow-hidden">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Now Playing</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowExpanded(false)}
              >
                <ChevronDown className="h-5 w-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex flex-1 overflow-hidden">
              {/* Cover art side */}
              <div className="w-1/2 p-6 flex flex-col items-center justify-center bg-muted/30">
                <div className="w-64 h-64 rounded-lg bg-muted flex items-center justify-center overflow-hidden shadow-lg">
                  {coverUrl && !coverError ? (
                    <img
                      src={coverUrl}
                      alt="Album cover"
                      className="w-full h-full object-cover"
                      onError={() => setCoverError(true)}
                    />
                  ) : (
                    <Music className="h-24 w-24 text-muted-foreground" />
                  )}
                </div>
                <div className="mt-4 text-center">
                  <h3 className="text-xl font-semibold truncate max-w-64" title={displayTitle}>
                    {displayTitle}
                  </h3>
                  {displayArtist && (
                    <p className="text-muted-foreground truncate max-w-64">
                      {displayArtist}
                    </p>
                  )}
                  {displayAlbum && (
                    <p className="text-sm text-muted-foreground/70 truncate max-w-64">
                      {displayAlbum}
                    </p>
                  )}
                </div>
                {/* Quality info */}
                {qualityInfo && (
                  <div className="mt-4 px-3 py-1 rounded-full bg-muted text-xs text-muted-foreground">
                    {qualityInfo}
                  </div>
                )}
              </div>

              {/* Lyrics side */}
              <div className="w-1/2 border-l flex flex-col">
                <div className="p-4 border-b">
                  <h3 className="font-medium">Lyrics</h3>
                </div>
                <ScrollArea className="flex-1 p-4">
                  {lyrics ? (
                    <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground leading-relaxed">
                      {lyrics}
                    </pre>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <p>{metadata?.has_lyrics ? 'Loading lyrics...' : 'No lyrics available'}</p>
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>

            {/* Track info footer */}
            <div className="p-4 border-t bg-muted/30">
              <div className="grid grid-cols-4 gap-4 text-xs text-muted-foreground">
                {metadata?.track_number && (
                  <div>
                    <span className="block text-foreground font-medium">Track</span>
                    {metadata.track_number}
                  </div>
                )}
                {metadata?.year && (
                  <div>
                    <span className="block text-foreground font-medium">Year</span>
                    {metadata.year}
                  </div>
                )}
                {metadata?.genre && (
                  <div>
                    <span className="block text-foreground font-medium">Genre</span>
                    {metadata.genre}
                  </div>
                )}
                {metadata?.bitrate && (
                  <div>
                    <span className="block text-foreground font-medium">Bitrate</span>
                    {formatBitrate(metadata.bitrate)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
