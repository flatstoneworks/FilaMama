import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Loader2,
} from 'lucide-react'
import { cn, formatVideoTime } from '@/lib/utils'

interface VideoPlayerProps {
  fileUrl: string
  fileName: string
  onLoad?: () => void
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]

export function VideoPlayer({ fileUrl, fileName, onLoad }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsTimeoutRef = useRef<number | null>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [showControls, setShowControls] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [isVertical, setIsVertical] = useState(false)

  // Show controls and set timeout to hide
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    if (isPlaying) {
      controlsTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false)
        setShowSpeedMenu(false)
      }, 3000)
    }
  }, [isPlaying])

  // Video event handlers
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
      // Detect vertical video (portrait orientation)
      const { videoWidth, videoHeight } = videoRef.current
      setIsVertical(videoHeight > videoWidth)
      setIsLoading(false)
      onLoad?.()
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handlePlay = () => setIsPlaying(true)
  const handlePause = () => setIsPlaying(false)
  const handleEnded = () => {
    setIsPlaying(false)
    setShowControls(true)
  }

  const handleError = () => {
    setError('Failed to load video. The format may not be supported by your browser.')
    setIsLoading(false)
  }

  const handleWaiting = () => setIsLoading(true)
  const handleCanPlay = () => setIsLoading(false)

  // Control handlers
  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
    }
  }, [isPlaying])

  const seek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(time, duration))
    }
  }, [duration])

  const seekRelative = useCallback((delta: number) => {
    if (videoRef.current) {
      seek(videoRef.current.currentTime + delta)
    }
  }, [seek])

  const handleProgressChange = useCallback((value: number[]) => {
    seek(value[0])
  }, [seek])

  const handleVolumeChange = useCallback((value: number[]) => {
    const newVolume = value[0]
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
      setIsMuted(newVolume === 0)
    }
  }, [])

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      const newMuted = !isMuted
      videoRef.current.muted = newMuted
      setIsMuted(newMuted)
    }
  }, [isMuted])

  const changeVolume = useCallback((delta: number) => {
    const newVolume = Math.max(0, Math.min(1, volume + delta))
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
      setIsMuted(newVolume === 0)
    }
  }, [volume])

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return

    if (isFullscreen) {
      await document.exitFullscreen()
    } else {
      await containerRef.current.requestFullscreen()
    }
  }, [isFullscreen])

  const handleFullscreenChange = useCallback(() => {
    setIsFullscreen(!!document.fullscreenElement)
  }, [])

  const setSpeed = useCallback((speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed
      setPlaybackSpeed(speed)
      setShowSpeedMenu(false)
    }
  }, [])

  const jumpToPercent = useCallback((percent: number) => {
    seek(duration * (percent / 100))
  }, [duration, seek])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      showControlsTemporarily()

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault()
          togglePlay()
          break
        case 'arrowleft':
        case 'j':
          e.preventDefault()
          seekRelative(-10)
          break
        case 'arrowright':
        case 'l':
          e.preventDefault()
          seekRelative(10)
          break
        case 'arrowup':
          e.preventDefault()
          changeVolume(0.1)
          break
        case 'arrowdown':
          e.preventDefault()
          changeVolume(-0.1)
          break
        case 'm':
          e.preventDefault()
          toggleMute()
          break
        case 'f':
          e.preventDefault()
          toggleFullscreen()
          break
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          e.preventDefault()
          jumpToPercent(parseInt(e.key) * 10)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay, seekRelative, changeVolume, toggleMute, toggleFullscreen, jumpToPercent, showControlsTemporarily])

  // Fullscreen change listener
  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [handleFullscreenChange])

  // Auto-hide controls when playing
  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true)
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [isPlaying])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex flex-col bg-black",
        isFullscreen
          ? "w-screen h-screen"
          : isVertical
            ? "w-auto h-[90vh] max-w-[60vw]"  // Vertical: taller, narrower
            : "w-[85vw] h-[85vh]"              // Horizontal: wider
      )}
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Header */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 z-20 px-4 py-3 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <span className="text-white font-medium truncate">{fileName}</span>
      </div>

      {/* Video Container */}
      <div
        className="flex-1 flex items-center justify-center cursor-pointer relative"
        onClick={togglePlay}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
            <Loader2 className="h-12 w-12 text-white animate-spin" />
          </div>
        )}

        {error ? (
          <div className="flex flex-col items-center justify-center gap-4 p-8">
            <p className="text-red-400 text-sm text-center">{error}</p>
            <p className="text-gray-400 text-xs">Try downloading the file instead</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            src={fileUrl}
            className="max-w-full max-h-full object-contain"
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handleEnded}
            onError={handleError}
            onWaiting={handleWaiting}
            onCanPlay={handleCanPlay}
            playsInline
          />
        )}

        {/* Play/Pause overlay icon */}
        {!isPlaying && !isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/50 rounded-full p-4">
              <Play className="h-12 w-12 text-white" fill="white" />
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 to-transparent transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="px-4 pt-4">
          <Slider
            value={[currentTime]}
            min={0}
            max={duration || 100}
            step={0.1}
            onValueChange={handleProgressChange}
            className="cursor-pointer [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
          />
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-white hover:bg-white/20"
              onClick={togglePlay}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" fill="white" />
              ) : (
                <Play className="h-5 w-5" fill="white" />
              )}
            </Button>

            {/* Skip buttons */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-white hover:bg-white/20"
              onClick={() => seekRelative(-10)}
            >
              <SkipBack className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-white hover:bg-white/20"
              onClick={() => seekRelative(10)}
            >
              <SkipForward className="h-5 w-5" />
            </Button>

            {/* Time display */}
            <span className="text-white text-sm ml-2 font-mono">
              {formatVideoTime(currentTime)} / {formatVideoTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Volume */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-white hover:bg-white/20"
              onClick={toggleMute}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </Button>
            <div className="w-24 hidden sm:block">
              <Slider
                value={[isMuted ? 0 : volume]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
                className="cursor-pointer"
              />
            </div>

            {/* Playback speed */}
            <div className="relative">
              <Button
                variant="ghost"
                className="h-9 px-2 text-white hover:bg-white/20 text-sm font-mono"
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              >
                {playbackSpeed}x
              </Button>
              {showSpeedMenu && (
                <div className="absolute bottom-full mb-2 right-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
                  {PLAYBACK_SPEEDS.map((speed) => (
                    <button
                      key={speed}
                      className={cn(
                        "block w-full px-4 py-2 text-sm text-left hover:bg-gray-800",
                        speed === playbackSpeed ? "text-blue-400 bg-gray-800" : "text-white"
                      )}
                      onClick={() => setSpeed(speed)}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-white hover:bg-white/20"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize className="h-5 w-5" />
              ) : (
                <Maximize className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
