import { useState, useEffect, useCallback, useMemo } from 'react'
import { MiniPlayer as SharedMiniPlayer, type MiniPlayerTrack } from '@flatstone/ui'
import type { AudioTrack } from '@/contexts/AudioPlayerContext'
import { api } from '@/api/client'
import type { AudioMetadata } from '@/api/client'

interface MiniPlayerProps {
  playlist: AudioTrack[]
  currentIndex: number
  onIndexChange: (index: number) => void
  onClose: () => void
}

function formatBitrate(bitrate: number | null): string {
  if (!bitrate) return ''
  return `${Math.round(bitrate / 1000)} kbps`
}

function formatSampleRate(sampleRate: number | null): string {
  if (!sampleRate) return ''
  return `${(sampleRate / 1000).toFixed(1)} kHz`
}

function buildDetails(meta: AudioMetadata): Record<string, string> {
  const d: Record<string, string> = {}
  if (meta.track_number) d['Track'] = meta.track_number
  if (meta.year) d['Year'] = meta.year
  if (meta.genre) d['Genre'] = meta.genre
  if (meta.bitrate) d['Bitrate'] = formatBitrate(meta.bitrate)
  return d
}

function buildQualityInfo(meta: AudioMetadata): string {
  return [meta.format, formatBitrate(meta.bitrate), formatSampleRate(meta.sample_rate)]
    .filter(Boolean)
    .join(' · ')
}

export function MiniPlayer({ playlist, currentIndex, onIndexChange, onClose }: MiniPlayerProps) {
  const [metadataCache, setMetadataCache] = useState<Record<string, AudioMetadata>>({})
  const currentTrack = playlist[currentIndex]

  // Fetch metadata for current track
  useEffect(() => {
    if (!currentTrack) return
    const path = currentTrack.file.path
    if (metadataCache[path]) return

    api.getAudioMetadata(path).then(meta => {
      if (meta) {
        setMetadataCache(prev => ({ ...prev, [path]: meta }))
      }
    })
  }, [currentTrack?.file.path])

  // Transform AudioTrack[] → MiniPlayerTrack[]
  const tracks: MiniPlayerTrack[] = useMemo(() => {
    return playlist.map(t => {
      const meta = metadataCache[t.file.path]
      return {
        id: t.file.path,
        url: t.url,
        title: meta?.title || t.file.name.replace(/\.[^/.]+$/, ''),
        artist: meta?.artist || undefined,
        album: meta?.album || undefined,
        coverUrl: meta?.has_cover ? api.getAudioCoverUrl(t.file.path) : undefined,
        qualityInfo: meta ? buildQualityInfo(meta) : undefined,
        details: meta ? buildDetails(meta) : undefined,
      }
    })
  }, [playlist, metadataCache])

  // Lyrics fetcher
  const handleFetchLyrics = useCallback(async (track: MiniPlayerTrack): Promise<string | null> => {
    const meta = metadataCache[track.id]
    if (!meta?.has_lyrics) return null
    return api.getAudioLyrics(track.id)
  }, [metadataCache])

  return (
    <SharedMiniPlayer
      playlist={tracks}
      currentIndex={currentIndex}
      onIndexChange={onIndexChange}
      onClose={onClose}
      storagePrefix="filamama-player"
      style={{ left: 'var(--sidebar-width)' }}
      onFetchLyrics={handleFetchLyrics}
    />
  )
}
