export interface FileInfo {
  name: string
  path: string
  size: number
  modified: string
  is_directory: boolean
  is_hidden: boolean
  thumbnail_url?: string
}

export interface DirectoryListing {
  path: string
  files: FileInfo[]
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
    size: f.size,
    modified: f.modified,
    is_directory: f.type === 'directory',
    is_hidden: f.is_hidden || false,
    thumbnail_url: f.has_thumbnail ? getThumbnailUrl(f.path) : undefined,
  }))

  return { path: data.path, files }
}

async function createFolder(path: string): Promise<void> {
  const parentPath = path.substring(0, path.lastIndexOf('/')) || '/'
  const name = path.substring(path.lastIndexOf('/') + 1)

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
  const newName = newPath.substring(newPath.lastIndexOf('/') + 1)
  await handleResponse(
    await fetch(`${API_BASE}/files/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: oldPath, new_name: newName }),
    })
  )
}

async function copy(source: string, destination: string): Promise<void> {
  await handleResponse(
    await fetch(`${API_BASE}/files/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, destination }),
    })
  )
}

async function move(source: string, destination: string): Promise<void> {
  await handleResponse(
    await fetch(`${API_BASE}/files/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, destination }),
    })
  )
}

async function uploadFile(
  file: File,
  path: string,
  onProgress?: (percent: number) => void,
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
        onProgress((e.loaded / e.total) * 100)
      }
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`))
      }
    })
    xhr.addEventListener('error', () => reject(new Error('Upload failed')))
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

export const api = {
  listDirectory,
  createFolder,
  delete: deleteFile,
  rename,
  copy,
  move,
  uploadFile,
  getThumbnailUrl,
  getDownloadUrl,
}
