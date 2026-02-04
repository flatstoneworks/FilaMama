import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface VideoPreviewProps {
  src: string
  posterUrl?: string
  className?: string
  width?: number
  height?: number
  onLoad?: () => void
}

export function VideoPreview({
  src,
  posterUrl,
  className,
  width,
  height,
  onLoad,
}: VideoPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isHovering, setIsHovering] = useState(false)
  const [isVideoLoaded, setIsVideoLoaded] = useState(false)
  const [currentFrame, setCurrentFrame] = useState<string | null>(null)
  const [videoDuration, setVideoDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const lastSeekTimeRef = useRef<number>(0)

  // Load video metadata when hovering starts
  const handleMouseEnter = useCallback(() => {
    setIsHovering(true)
    const video = videoRef.current
    if (video && !isVideoLoaded) {
      video.load()
    }
  }, [isVideoLoaded])

  // Clean up when hover ends
  const handleMouseLeave = useCallback(() => {
    setIsHovering(false)
    setCurrentFrame(null)
    setCurrentTime(0)

    // Pause and reset video
    const video = videoRef.current
    if (video) {
      video.pause()
      video.currentTime = 0
    }
  }, [])

  // Calculate seek position based on mouse X position
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isVideoLoaded || !containerRef.current || !videoRef.current) return

    const video = videoRef.current
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, x / rect.width))

    if (!videoDuration || !isFinite(videoDuration)) return

    const targetTime = percentage * videoDuration

    // Debounce seeking to avoid excessive operations
    const now = Date.now()
    if (now - lastSeekTimeRef.current < 50) return
    lastSeekTimeRef.current = now

    // Seek to the calculated time
    video.currentTime = targetTime
    setCurrentTime(targetTime)
  }, [isVideoLoaded, videoDuration])

  // Handle video metadata loaded
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current
    if (video) {
      setVideoDuration(video.duration)
      setIsVideoLoaded(true)
      onLoad?.()
    }
  }, [onLoad])

  // Handle seek completion - draw frame to canvas
  const handleSeeked = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !isHovering) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw the current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Convert to data URL for display
    try {
      const frameUrl = canvas.toDataURL('image/jpeg', 0.8)
      setCurrentFrame(frameUrl)
    } catch {
      // Canvas tainted by cross-origin video - fall back to showing video directly
      setCurrentFrame(null)
    }
  }, [isHovering])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Nothing to clean up
    }
  }, [])

  const style: React.CSSProperties = {}
  if (width) style.width = width
  if (height) style.height = height

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden', className)}
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      {/* Hidden video element for frame extraction */}
      <video
        ref={videoRef}
        src={src}
        preload="metadata"
        muted
        playsInline
        crossOrigin="anonymous"
        onLoadedMetadata={handleLoadedMetadata}
        onSeeked={handleSeeked}
        className="hidden"
      />

      {/* Hidden canvas for frame extraction */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Display layer */}
      {currentFrame && isHovering ? (
        // Show extracted frame when hovering
        <img
          src={currentFrame}
          alt=""
          className="w-full h-full object-contain"
        />
      ) : posterUrl ? (
        // Show poster/thumbnail when not hovering
        <img
          src={posterUrl}
          alt=""
          className="w-full h-full object-contain"
          loading="lazy"
        />
      ) : (
        // Fallback to actual video element (first frame)
        <video
          src={src}
          className="w-full h-full object-contain"
          muted
          playsInline
          preload="metadata"
        />
      )}

      {/* Scrub indicator - shows position while hovering */}
      {isHovering && isVideoLoaded && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
          <div
            className="h-full bg-primary/80 transition-none"
            style={{
              width: `${(currentTime / videoDuration) * 100}%`
            }}
          />
        </div>
      )}
    </div>
  )
}
