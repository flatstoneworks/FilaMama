import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type {
  FileInfo,
  SearchResult,
  ContentSearchResult,
  ContentSearchMatch,
  TrashItem,
} from "@/api/client"

// File extensions that get a server-side thumbnail.
// Keep this in sync with the backend thumbnail pipeline.
export const THUMBNAIL_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.webp', '.gif',
  '.mp4', '.mov', '.avi', '.mkv', '.webm',
] as const

// Inlined to avoid a circular import with @/api/client.
function thumbnailUrl(path: string): string {
  return `/api/files/thumbnail?path=${encodeURIComponent(path)}`
}

function getExtension(name: string): string {
  if (!name.includes('.')) return ''
  return '.' + name.split('.').pop()!.toLowerCase()
}

function hasThumbnailExt(name: string, type: string): boolean {
  return type === 'file' && (THUMBNAIL_EXTENSIONS as readonly string[]).includes(getExtension(name))
}

/** Convert a recursive-search hit into the FileInfo shape used by the grid/list. */
export function searchResultToFileInfo(r: SearchResult): FileInfo {
  const ext = getExtension(r.name)
  const thumb = hasThumbnailExt(r.name, r.type)
  return {
    name: r.name,
    path: r.path,
    type: r.type,
    size: r.size,
    modified: r.modified,
    is_hidden: false,
    has_thumbnail: thumb,
    match_reason: r.match_reason,
    thumbnail_url: thumb ? thumbnailUrl(r.path) : undefined,
    is_directory: r.type === 'directory',
    extension: ext ? ext.slice(1) : undefined,
  }
}

/** Convert a content-search hit, preserving the per-line matches. */
export function contentSearchResultToFileInfo(
  r: ContentSearchResult
): FileInfo & { contentMatches?: ContentSearchMatch[] } {
  return {
    ...searchResultToFileInfo(r),
    contentMatches: r.matches,
  }
}

/** Convert a trash manifest entry into the FileInfo shape. */
export function trashItemToFileInfo(item: TrashItem): FileInfo {
  const ext = getExtension(item.original_name)
  const thumb = hasThumbnailExt(item.original_name, item.type)
  return {
    name: item.original_name,
    // Use trash_name as path identifier so trash operations target the right entry.
    path: item.name,
    type: item.type,
    size: item.size,
    modified: item.deleted_at,
    is_hidden: false,
    has_thumbnail: thumb,
    thumbnail_url: thumb ? thumbnailUrl(item.path) : undefined,
    is_directory: item.type === 'directory',
    extension: ext ? ext.slice(1) : undefined,
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i]
}

export function formatDate(date: string | Date): string {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    if (hours < 1) {
      const mins = Math.floor(diff / 60000)
      return mins <= 1 ? 'Just now' : `${mins} mins ago`
    }
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  }
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000)
    return days === 1 ? 'Yesterday' : `${days} days ago`
  }
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

// File selection utilities
export function isFileSelected<T extends { path: string }>(file: T, selectedFiles: Set<string>): boolean {
  return selectedFiles.has(file.path)
}

export function getSelectedOrSingle<T extends { path: string }>(
  file: T,
  allFiles: T[],
  selectedFiles: Set<string>
): T[] {
  if (isFileSelected(file, selectedFiles)) {
    return allFiles.filter((f) => selectedFiles.has(f.path))
  }
  return [file]
}

export function createCheckboxClickHandler<T>(
  file: T,
  onSelect: (file: T, e: React.MouseEvent) => void
) {
  return (e: React.MouseEvent) => {
    e.stopPropagation()
    // Simulate ctrl+click for toggle behavior
    const syntheticEvent = {
      ...e,
      ctrlKey: true,
      metaKey: true,
    } as React.MouseEvent
    onSelect(file, syntheticEvent)
  }
}

// Simple date formatter for file lists (non-relative)
export function formatFileDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Path utility functions
export function joinPath(basePath: string, ...segments: string[]): string {
  // Remove trailing slashes from base path
  let result = basePath.replace(/\/+$/, '')

  for (const segment of segments) {
    if (!segment) continue
    // Remove leading slashes from segments
    const cleanSegment = segment.replace(/^\/+/, '')
    result = result === '/' ? `/${cleanSegment}` : `${result}/${cleanSegment}`
  }

  return result || '/'
}

export function getParentPath(path: string): string | null {
  if (path === '/' || !path) return null
  const lastSlash = path.lastIndexOf('/')
  return lastSlash <= 0 ? '/' : path.substring(0, lastSlash)
}

export function getFileName(path: string): string {
  if (path === '/') return ''
  const lastSlash = path.lastIndexOf('/')
  return path.substring(lastSlash + 1)
}

export { isVideoFile, isImageFile, videoNeedsTranscoding, formatVideoTime } from '@flatstoneworks/media-components'

export function formatUploadSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return '0 B/s'
  const k = 1024
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k))
  return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function formatETA(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '--'
  if (seconds < 60) return `${Math.ceil(seconds)}s`
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}m ${secs}s`
  }
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${mins}m`
}
