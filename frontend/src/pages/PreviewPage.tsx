import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import {
  MediaDetailShell,
  type MediaDetailMetadataRow,
  type MediaDetailSection,
} from '@flatstoneworks/ui'
import { Bot, FileAudio, FileText, FileVideo, ImageIcon, Music, NotebookText } from 'lucide-react'
import { api, type AudioMetadata } from '@/api/client'
import { getFileType, isPreviewable, isTextFile, getLanguageFromExtension } from '@/components/FileIcon'
import { joinPath, getParentPath, getFileName, formatBytes, formatFileDate, cn } from '@/lib/utils'
import { VideoPlayer, videoNeedsTranscoding } from '@flatstoneworks/media-components'
import { PdfViewer } from '@/components/PdfViewer'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'
import { toast } from '@/components/ui/use-toast'

function encodePathForUrl(path: string) {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/')
}

function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds < 0) return null
  const totalSeconds = Math.round(seconds)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const remainingSeconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

function formatBitrate(bitsPerSecond: number | null | undefined): string | null {
  if (!bitsPerSecond) return null
  return `${Math.round(bitsPerSecond / 1000)} kbps`
}

function formatSampleRate(sampleRate: number | null | undefined): string | null {
  if (!sampleRate) return null
  return `${(sampleRate / 1000).toFixed(sampleRate % 1000 === 0 ? 0 : 1)} kHz`
}

function getTypeLabel(fileType: string, ext?: string) {
  if (ext === 'pdf') return 'PDF'
  if (fileType === 'image') return 'Photo'
  if (fileType === 'video') return 'Video'
  if (fileType === 'audio') return 'Audio'
  if (fileType === 'code') return 'Text'
  return 'File'
}

function getTypeIcon(fileType: string, ext?: string, className = 'h-4 w-4') {
  if (fileType === 'image') return <ImageIcon className={className} aria-hidden="true" />
  if (fileType === 'video') return <FileVideo className={className} aria-hidden="true" />
  if (fileType === 'audio') return <FileAudio className={className} aria-hidden="true" />
  if (ext === 'pdf' || fileType === 'code') return <FileText className={className} aria-hidden="true" />
  return <NotebookText className={className} aria-hidden="true" />
}

function compactRows(rows: Array<MediaDetailMetadataRow | null | false | undefined>): MediaDetailMetadataRow[] {
  return rows.filter((row): row is MediaDetailMetadataRow => Boolean(row && row.value !== null && row.value !== undefined && row.value !== ''))
}

function AudioPreview({
  fileName,
  streamUrl,
  coverUrl,
  metadata,
  onLoad,
}: {
  fileName: string
  streamUrl: string
  coverUrl: string
  metadata?: AudioMetadata | null
  onLoad: () => void
}) {
  const displayTitle = metadata?.title || fileName
  const displaySubtitle = [metadata?.artist, metadata?.album].filter(Boolean).join(' - ')

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-md border border-white/10 bg-white/5 p-6 text-white shadow-2xl">
      <div className="flex aspect-square w-48 items-center justify-center overflow-hidden rounded-md bg-white/10">
        {metadata?.has_cover ? (
          <img
            src={coverUrl}
            alt=""
            className="h-full w-full object-cover"
            onLoad={onLoad}
            onError={onLoad}
          />
        ) : (
          <Music className="h-16 w-16 text-white/45" />
        )}
      </div>
      <div className="min-w-0 text-center">
        <p className="truncate text-base font-medium">{displayTitle}</p>
        {displaySubtitle && <p className="mt-1 truncate text-sm text-white/60">{displaySubtitle}</p>}
      </div>
      <audio
        src={streamUrl}
        controls
        autoPlay
        className="w-full"
        onLoadedData={onLoad}
        onError={onLoad}
      />
    </div>
  )
}

export function PreviewPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [isLoading, setIsLoading] = useState(true)
  const [textContent, setTextContent] = useState<string | null>(null)
  const { isOpen: isPlayerOpen } = useAudioPlayer()

  // Derive file path from URL: /view/Documents/image.jpg -> /Documents/image.jpg.
  const filePath = useMemo(() => {
    const path = decodeURIComponent(location.pathname).replace(/^\/view/, '') || '/'
    return path === '' ? '/' : path
  }, [location.pathname])

  const dirPath = getParentPath(filePath) || '/'
  const fileName = getFileName(filePath)

  const { data: listing } = useQuery({
    queryKey: ['files', dirPath],
    queryFn: () => api.listDirectory(dirPath),
  })

  const { data: agentContext } = useQuery({
    queryKey: ['agent-context', filePath],
    queryFn: () => api.getAgentContext(filePath),
    enabled: !!filePath && filePath !== '/',
  })

  const files = listing?.files || []

  const currentFile = useMemo(() => {
    return files.find((f) => f.name === fileName) || null
  }, [files, fileName])

  const previewableFiles = useMemo(() => {
    return files.filter((f) => {
      if (f.is_directory) return false
      return isPreviewable(f.name)
    })
  }, [files])

  const currentIndex = currentFile
    ? previewableFiles.findIndex((f) => f.name === currentFile.name)
    : -1
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < previewableFiles.length - 1

  const fileType = currentFile ? getFileType(currentFile.name, false) : 'default'
  const ext = currentFile?.name.split('.').pop()?.toLowerCase()

  const { data: audioMetadata } = useQuery({
    queryKey: ['audio-metadata', filePath],
    queryFn: () => api.getAudioMetadata(filePath),
    enabled: Boolean(currentFile && fileType === 'audio'),
  })

  const { data: videoInfo } = useQuery({
    queryKey: ['video-info', filePath],
    queryFn: () => api.getVideoInfo(filePath),
    enabled: Boolean(currentFile && fileType === 'video'),
  })

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      const prevFile = previewableFiles[currentIndex - 1]
      navigate(`/view${encodePathForUrl(joinPath(dirPath, prevFile.name))}`)
    }
  }, [hasPrev, previewableFiles, currentIndex, navigate, dirPath])

  const handleNext = useCallback(() => {
    if (hasNext) {
      const nextFile = previewableFiles[currentIndex + 1]
      navigate(`/view${encodePathForUrl(joinPath(dirPath, nextFile.name))}`)
    }
  }, [hasNext, previewableFiles, currentIndex, navigate, dirPath])

  const handleBack = useCallback(() => {
    navigate(`/browse${encodePathForUrl(dirPath)}`)
  }, [navigate, dirPath])

  const deleteMutation = useMutation({
    mutationFn: () => api.moveToTrash([filePath]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', dirPath] })
      queryClient.invalidateQueries({ queryKey: ['trash-info'] })
      toast({ title: 'Moved to Trash' })
      handleBack()
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to move to Trash', description: error.message, variant: 'destructive' })
    },
  })

  useEffect(() => {
    if (!currentFile) return

    setIsLoading(true)
    setTextContent(null)

    if (isTextFile(currentFile.name)) {
      let cancelled = false
      api.getTextContent(filePath)
        .then(({ content }) => {
          if (cancelled) return
          setTextContent(content)
          setIsLoading(false)
        })
        .catch(() => {
          if (!cancelled) setIsLoading(false)
        })
      return () => {
        cancelled = true
      }
    }

    setIsLoading(true)
  }, [currentFile, filePath])

  const fileUrl = currentFile
    ? api.getPreviewUrl(filePath, currentFile.modified)
    : ''
  const streamUrl = useMemo(() => {
    if (!currentFile) return ''
    if (fileType === 'video' && videoNeedsTranscoding(currentFile.name)) {
      return api.getTranscodeStreamUrl(filePath, currentFile.modified)
    }
    return api.getStreamUrl(filePath, currentFile.modified)
  }, [currentFile, filePath, fileType])
  const downloadUrl = api.getDownloadUrl(filePath)
  const audioCoverUrl = api.getAudioCoverUrl(filePath)

  const handleDownload = useCallback(() => {
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
  }, [downloadUrl, fileName])

  const baseRows = useMemo(() => {
    if (!currentFile) return []
    return compactRows([
      { label: 'Name', value: currentFile.name },
      { label: 'Path', value: currentFile.path, title: currentFile.path },
      { label: 'Kind', value: getTypeLabel(fileType, ext) },
      { label: 'Size', value: formatBytes(currentFile.size) },
      { label: 'Modified', value: formatFileDate(currentFile.modified) },
      ext ? { label: 'Extension', value: `.${ext}` } : null,
      currentFile.mime_type ? { label: 'MIME type', value: currentFile.mime_type } : null,
    ])
  }, [currentFile, ext, fileType])

  const mediaRows = useMemo(() => {
    if (fileType === 'audio' && audioMetadata) {
      const duration = formatDuration(audioMetadata.duration)
      const bitrate = formatBitrate(audioMetadata.bitrate)
      const sampleRate = formatSampleRate(audioMetadata.sample_rate)
      return compactRows([
        audioMetadata.title ? { label: 'Title', value: audioMetadata.title } : null,
        audioMetadata.artist ? { label: 'Artist', value: audioMetadata.artist } : null,
        audioMetadata.album ? { label: 'Album', value: audioMetadata.album } : null,
        audioMetadata.album_artist ? { label: 'Album artist', value: audioMetadata.album_artist } : null,
        audioMetadata.track_number ? { label: 'Track', value: audioMetadata.track_number } : null,
        audioMetadata.year ? { label: 'Year', value: audioMetadata.year } : null,
        audioMetadata.genre ? { label: 'Genre', value: audioMetadata.genre } : null,
        duration ? { label: 'Duration', value: duration } : null,
        bitrate ? { label: 'Bitrate', value: bitrate } : null,
        sampleRate ? { label: 'Sample rate', value: sampleRate } : null,
        audioMetadata.channels ? { label: 'Channels', value: audioMetadata.channels } : null,
        audioMetadata.format ? { label: 'Format', value: audioMetadata.format } : null,
      ])
    }

    if (fileType === 'video' && videoInfo) {
      const duration = formatDuration(videoInfo.duration)
      return compactRows([
        duration ? { label: 'Duration', value: duration } : null,
        videoInfo.container ? { label: 'Container', value: videoInfo.container } : null,
        videoInfo.video_codec ? { label: 'Video codec', value: videoInfo.video_codec } : null,
        videoInfo.audio_codec ? { label: 'Audio codec', value: videoInfo.audio_codec } : null,
        { label: 'Processing', value: videoInfo.processing_type === 'none' ? 'Native playback' : videoInfo.processing_type },
        { label: 'Cached', value: videoInfo.is_cached ? 'Yes' : 'No' },
      ])
    }

    return []
  }, [audioMetadata, fileType, videoInfo])

  const agentRows = useMemo(() => {
    const artifact = agentContext?.artifact
    if (!artifact) return []
    return compactRows([
      artifact.title ? { label: 'Artifact title', value: artifact.title } : null,
      artifact.source_type ? { label: 'Source', value: artifact.source_type } : null,
      artifact.provider ? { label: 'Provider', value: artifact.provider } : null,
      artifact.model ? { label: 'Model', value: artifact.model } : null,
      artifact.labels.length > 0 ? { label: 'Labels', value: artifact.labels.join(', ') } : null,
      artifact.created_at ? { label: 'Created', value: formatFileDate(artifact.created_at) } : null,
    ])
  }, [agentContext])

  const detailsSections = useMemo<MediaDetailSection[]>(() => {
    const artifact = agentContext?.artifact
    if (!artifact?.prompt_summary && !artifact?.description && !agentContext?.notes.length) return []

    return [
      {
        id: 'agent-context',
        title: 'Agent context',
        icon: <Bot className="h-4 w-4 text-muted-foreground" />,
        children: (
          <div className="space-y-3 text-sm">
            {artifact?.description && (
              <p className="rounded-md bg-muted px-3 py-2 text-muted-foreground">{artifact.description}</p>
            )}
            {artifact?.prompt_summary && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Prompt summary</p>
                <p className="rounded-md bg-muted px-3 py-2 text-muted-foreground">{artifact.prompt_summary}</p>
              </div>
            )}
            {agentContext?.notes.map((note) => (
              <p key={note.id} className="rounded-md border border-border px-3 py-2 text-muted-foreground">
                {note.body}
              </p>
            ))}
          </div>
        ),
      },
    ]
  }, [agentContext])

  const metadataRows = useMemo(() => {
    return [...mediaRows, ...baseRows, ...agentRows]
  }, [agentRows, baseRows, mediaRows])

  const mediaContent = useMemo(() => {
    if (!currentFile) return null

    if (fileType === 'image') {
      const isSvg = ext === 'svg'
      const svgBackground = isSvg
        ? {
          backgroundImage: `
            linear-gradient(45deg, #e0e0e0 25%, transparent 25%),
            linear-gradient(-45deg, #e0e0e0 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #e0e0e0 75%),
            linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)
          `,
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
          backgroundColor: '#fff',
        }
        : undefined

      return (
        <div
          className={isSvg ? 'rounded-md p-4' : 'flex h-full w-full items-center justify-center'}
          style={svgBackground}
        >
          <img
            src={fileUrl}
            alt={currentFile.name}
            className="max-h-full max-w-full object-contain"
            onLoad={() => setIsLoading(false)}
            onError={() => setIsLoading(false)}
          />
        </div>
      )
    }

    if (fileType === 'video') {
      return (
        <VideoPlayer
          src={streamUrl}
          title={currentFile.name}
          onLoad={() => setIsLoading(false)}
        />
      )
    }

    if (fileType === 'audio') {
      return (
        <AudioPreview
          fileName={currentFile.name}
          streamUrl={streamUrl}
          coverUrl={audioCoverUrl}
          metadata={audioMetadata}
          onLoad={() => setIsLoading(false)}
        />
      )
    }

    if (ext === 'pdf') {
      return (
        <PdfViewer
          fileUrl={fileUrl}
          fileName={currentFile.name}
          onLoad={() => setIsLoading(false)}
        />
      )
    }

    if (isTextFile(currentFile.name) && textContent !== null) {
      return (
        <div className="h-full w-full max-w-5xl overflow-auto rounded-md">
          <SyntaxHighlighter
            language={getLanguageFromExtension(currentFile.name)}
            style={oneDark}
            showLineNumbers
            wrapLines
            customStyle={{
              margin: 0,
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              minHeight: '100%',
            }}
            lineNumberStyle={{
              minWidth: '3em',
              paddingRight: '1em',
              color: '#636d83',
              userSelect: 'none',
            }}
          >
            {textContent}
          </SyntaxHighlighter>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center gap-3 text-center text-white">
        <NotebookText className="h-10 w-10 text-white/50" />
        <p className="text-sm text-white/70">Preview unavailable</p>
      </div>
    )
  }, [audioCoverUrl, audioMetadata, currentFile, ext, fileType, fileUrl, streamUrl, textContent])

  const zoomContent = fileType === 'image' && currentFile
    ? <img src={fileUrl} alt={currentFile.name} className="max-h-none max-w-none" />
    : undefined

  const navState = currentIndex >= 0 && previewableFiles.length > 1
    ? {
      currentIndex,
      total: previewableFiles.length,
      hasPrevious: hasPrev,
      hasNext,
    }
    : undefined

  const headerTypeLabel = getTypeIcon(fileType, ext, 'h-3.5 w-3.5')

  return (
    <MediaDetailShell
      title={fileName || 'Preview'}
      typeLabel={headerTypeLabel}
      className={cn(
        '[&_aside_h2]:flex-1',
        isPlayerOpen && 'pb-16',
        navState && '[&_header>div:last-child>span:first-child]:hidden [&_header>div:last-child>div:first-of-type]:hidden'
      )}
      media={mediaContent}
      mediaClassName={ext === 'pdf' ? 'p-0' : undefined}
      isLoading={!currentFile && !listing ? true : Boolean(currentFile && isLoading && ext !== 'pdf')}
      notFound={!currentFile && listing ? (
        <>
          <p className="text-lg">File not found</p>
          <p className="text-sm text-white/60">{fileName}</p>
        </>
      ) : undefined}
      nav={navState}
      onBack={handleBack}
      onPrevious={handlePrev}
      onNext={handleNext}
      onDownload={currentFile ? handleDownload : undefined}
      onDelete={currentFile ? async () => { await deleteMutation.mutateAsync() } : undefined}
      deleteTitle={`Move ${fileName || 'item'} to Trash?`}
      deleteDescription="The item will be moved to the Trash and can be restored later."
      keyboardNavigation={{ previousNext: fileType !== 'video' }}
      enableZoom={fileType === 'image'}
      zoomContent={zoomContent}
      metadataRows={metadataRows}
      sections={detailsSections}
      detailsTitle={
        <span className="flex w-full min-w-0 items-center justify-between gap-3">
          <span className="min-w-0 truncate">Information</span>
          {navState && (
            <span className="shrink-0 text-sm font-normal tabular-nums text-muted-foreground">
              {navState.currentIndex + 1} / {navState.total}
            </span>
          )}
        </span>
      }
      backLabel="Go back"
    />
  )
}
