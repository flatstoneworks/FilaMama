import { useState } from 'react'
import { Music } from 'lucide-react'
import { api } from '@/api/client'

interface AudioCoverProps {
  path: string
  size: number
  className?: string
}

/**
 * Displays album cover art for an audio file.
 * Falls back to a music icon if no cover art is available.
 */
export function AudioCover({ path, size, className = '' }: AudioCoverProps) {
  const [hasError, setHasError] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const coverUrl = api.getAudioCoverUrl(path)

  if (hasError) {
    // No cover art available - show music icon
    return (
      <div
        className={`flex items-center justify-center bg-muted rounded-md ${className}`}
        style={{ width: size, height: size }}
      >
        <Music className="text-muted-foreground" style={{ width: size * 0.5, height: size * 0.5 }} />
      </div>
    )
  }

  return (
    <div
      className={`rounded-md overflow-hidden bg-muted flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Show music icon while loading */}
      {!isLoaded && (
        <Music className="text-muted-foreground absolute" style={{ width: size * 0.5, height: size * 0.5 }} />
      )}
      <img
        src={coverUrl}
        alt="Album cover"
        className={`max-w-full max-h-full object-cover transition-opacity ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        style={{ width: size, height: size }}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
      />
    </div>
  )
}
