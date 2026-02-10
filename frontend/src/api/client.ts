import { getParentPath, getFileName } from '@/lib/utils'

export type FileType = 'file' | 'directory' | 'symlink'

export interface FileInfo {
  name: string
  path: string
  type: FileType
  size: number
  modified: string
  extension?: string
  mime_type?: string
  is_hidden: boolean
  has_thumbnail: boolean
  // Computed properties for convenience
  thumbnail_url?: string
  is_directory?: boolean  // Computed from type
}

export interface DirectoryListing {
  path: string
  files: FileInfo[]
}

export interface MountPoint {
  name: string
  path: string
  icon?: string
}

export interface AppConfig {
  root_path: string
  thumbnails_enabled: boolean
  max_upload_size_mb: number
  file_types: Record<string, string[]>
  mounts: MountPoint[]
  content_types?: Record<string, string[]>
}

const API_BASE = '/api'

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  return response.json()
}

async function listDirectory(path = '/'): Promise<DirectoryListing> {
  const params = new URLSearchParams({ path })
  const data = await handleResponse<{ path: string; items: any[] }>(
    await fetch(`${API_BASE}/files/list?${params}`)
  )

  // Transform items to files with proper fields
  const files: FileInfo[] = data.items.map((f) => ({
    name: f.name,
    path: f.path,
    type: f.type,
    size: f.size,
    modified: f.modified,
    extension: f.extension,
    mime_type: f.mime_type,
    is_hidden: f.is_hidden || false,
    has_thumbnail: f.has_thumbnail || false,
    // Computed convenience properties
    is_directory: f.type === 'directory',
    thumbnail_url: f.has_thumbnail ? getThumbnailUrl(f.path) : undefined,
  }))

  return { path: data.path, files }
}

async function createFolder(path: string): Promise<void> {
  const parentPath = getParentPath(path) || '/'
  const name = getFileName(path)

  await handleResponse(
    await fetch(`${API_BASE}/files/mkdir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: parentPath, name }),
    })
  )
}

async function deleteFile(path: string): Promise<void> {
  await handleResponse(
    await fetch(`${API_BASE}/files/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: [path] }),
    })
  )
}

async function rename(oldPath: string, newPath: string): Promise<void> {
  const newName = getFileName(newPath)
  await handleResponse(
    await fetch(`${API_BASE}/files/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: oldPath, new_name: newName }),
    })
  )
}

async function copy(source: string, destination: string, overwrite = false): Promise<void> {
  await handleResponse(
    await fetch(`${API_BASE}/files/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, destination, overwrite }),
    })
  )
}

async function move(source: string, destination: string, overwrite = false): Promise<void> {
  await handleResponse(
    await fetch(`${API_BASE}/files/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, destination, overwrite }),
    })
  )
}

async function checkConflicts(sources: string[], destination: string): Promise<string[]> {
  const response = await handleResponse<{ conflicts: string[] }>(
    await fetch(`${API_BASE}/files/check-conflicts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources, destination }),
    })
  )
  return response.conflicts
}

async function getFolderSize(path: string): Promise<number> {
  const response = await handleResponse<{ path: string; size: number }>(
    await fetch(`${API_BASE}/files/folder-size?path=${encodeURIComponent(path)}`)
  )
  return response.size
}

export interface UploadProgressEvent {
  percent: number
  bytesUploaded: number
  totalBytes: number
}

async function uploadFile(
  file: File,
  path: string,
  onProgress?: (progress: UploadProgressEvent) => void,
  relativePath?: string
): Promise<void> {
  const formData = new FormData()
  formData.append('files', file)
  formData.append('path', path)
  // Send relative path for folder uploads (e.g., "myfolder/subfolder/file.txt")
  if (relativePath) {
    formData.append('relative_paths', relativePath)
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress({
          percent: (e.loaded / e.total) * 100,
          bytesUploaded: e.loaded,
          totalBytes: e.total,
        })
      }
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Check for per-file errors in the response
        try {
          const response = JSON.parse(xhr.responseText)
          if (response.errors && response.errors.length > 0) {
            // Backend returned errors for this file
            const fileError = response.errors[0]
            reject(new Error(fileError.error || 'Upload failed on server'))
            return
          }
        } catch {
          // If we can't parse the response, assume success
        }
        resolve()
      } else {
        // HTTP error - try to parse error detail from server response
        let errorMessage = `Upload failed (HTTP ${xhr.status})`
        try {
          const response = JSON.parse(xhr.responseText)
          if (response.detail) {
            errorMessage = response.detail
          }
        } catch {
          // Use default error message with status text
          if (xhr.statusText) {
            errorMessage = `Upload failed: ${xhr.statusText}`
          }
        }
        reject(new Error(errorMessage))
      }
    })
    xhr.addEventListener('error', () => reject(new Error('Network error - check your connection')))
    xhr.addEventListener('abort', () => reject(new Error('Upload was cancelled')))
    xhr.addEventListener('timeout', () => reject(new Error('Upload timed out - file may be too large')))
    xhr.open('POST', `${API_BASE}/upload`)
    xhr.send(formData)
  })
}

function getThumbnailUrl(path: string): string {
  return `${API_BASE}/files/thumbnail?path=${encodeURIComponent(path)}`
}

function getDownloadUrl(path: string): string {
  return `${API_BASE}/files/download?path=${encodeURIComponent(path)}`
}

function getPreviewUrl(path: string, modified?: string): string {
  const url = `${API_BASE}/files/preview?path=${encodeURIComponent(path)}`
  // Add modified timestamp for cache-busting when file changes
  return modified ? `${url}&t=${encodeURIComponent(modified)}` : url
}

function getStreamUrl(path: string, modified?: string): string {
  const url = `${API_BASE}/files/stream?path=${encodeURIComponent(path)}`
  // Add modified timestamp for cache-busting when file changes
  return modified ? `${url}&t=${encodeURIComponent(modified)}` : url
}

async function getConfig(): Promise<AppConfig> {
  return handleResponse<AppConfig>(await fetch(`${API_BASE}/config`))
}

export interface SearchResult {
  path: string
  name: string
  type: FileType
  size: number
  modified: string
}

export interface SearchResponse {
  results: SearchResult[]
  has_more: boolean
  total_scanned: number
}

export interface ContentSearchMatch {
  path: string
  name: string
  line_number: number
  line_content: string
}

export interface ContentSearchResult {
  path: string
  name: string
  type: FileType
  size: number
  modified: string
  matches: ContentSearchMatch[]
}

export interface ContentSearchResponse {
  results: ContentSearchResult[]
  files_searched: number
  files_with_matches: number
  has_more: boolean
}

async function searchFiles(params: {
  query?: string
  path?: string
  maxResults?: number
  contentType?: string
}): Promise<SearchResponse> {
  const url = new URL(`${API_BASE}/files/search`, window.location.origin)
  if (params.query) url.searchParams.set('query', params.query)
  if (params.path) url.searchParams.set('path', params.path)
  if (params.maxResults) url.searchParams.set('max_results', params.maxResults.toString())
  if (params.contentType) url.searchParams.set('content_type', params.contentType)

  return handleResponse<SearchResponse>(await fetch(url.toString()))
}

async function searchContent(params: {
  query: string
  path?: string
  maxFiles?: number
  maxDepth?: number
}): Promise<ContentSearchResponse> {
  const url = new URL(`${API_BASE}/files/search-content`, window.location.origin)
  url.searchParams.set('query', params.query)
  if (params.path) url.searchParams.set('path', params.path)
  if (params.maxFiles) url.searchParams.set('max_files', params.maxFiles.toString())
  if (params.maxDepth) url.searchParams.set('max_depth', params.maxDepth.toString())

  return handleResponse<ContentSearchResponse>(await fetch(url.toString()))
}

export interface AudioMetadata {
  title: string | null
  artist: string | null
  album: string | null
  album_artist: string | null
  track_number: string | null
  year: string | null
  genre: string | null
  duration: number | null
  bitrate: number | null
  sample_rate: number | null
  channels: number | null
  has_cover: boolean
  has_lyrics: boolean
  format: string
}

async function getAudioMetadata(path: string): Promise<AudioMetadata | null> {
  try {
    return await handleResponse<AudioMetadata>(
      await fetch(`${API_BASE}/files/audio-metadata?path=${encodeURIComponent(path)}`)
    )
  } catch {
    return null
  }
}

function getAudioCoverUrl(path: string): string {
  return `${API_BASE}/files/audio-cover?path=${encodeURIComponent(path)}`
}

async function getAudioLyrics(path: string): Promise<string | null> {
  try {
    const response = await handleResponse<{ lyrics: string }>(
      await fetch(`${API_BASE}/files/audio-lyrics?path=${encodeURIComponent(path)}`)
    )
    return response.lyrics
  } catch {
    return null
  }
}

export const api = {
  listDirectory,
  createFolder,
  delete: deleteFile,
  rename,
  copy,
  move,
  checkConflicts,
  getFolderSize,
  uploadFile,
  getThumbnailUrl,
  getDownloadUrl,
  getPreviewUrl,
  getStreamUrl,
  getConfig,
  searchFiles,
  searchContent,
  getAudioMetadata,
  getAudioCoverUrl,
  getAudioLyrics,
}
