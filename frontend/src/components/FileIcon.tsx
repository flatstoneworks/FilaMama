import { Folder, File, Image, Video, Music, FileText, Archive, Code, Database, FileSpreadsheet, Presentation, type LucideIcon } from 'lucide-react'

const iconMap: Record<string, LucideIcon> = {
  folder: Folder,
  image: Image,
  video: Video,
  audio: Music,
  document: FileText,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  archive: Archive,
  code: Code,
  database: Database,
  default: File,
}

const extensionToType: Record<string, string> = {
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', svg: 'image', bmp: 'image', ico: 'image',
  mp4: 'video', webm: 'video', mov: 'video', avi: 'video', mkv: 'video', wmv: 'video', flv: 'video',
  mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', aac: 'audio', m4a: 'audio', wma: 'audio',
  pdf: 'document', doc: 'document', docx: 'document', txt: 'document', rtf: 'document', odt: 'document', md: 'document',
  xls: 'spreadsheet', xlsx: 'spreadsheet', csv: 'spreadsheet', ods: 'spreadsheet',
  ppt: 'presentation', pptx: 'presentation', odp: 'presentation',
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive', bz2: 'archive',
  js: 'code', ts: 'code', jsx: 'code', tsx: 'code', py: 'code', java: 'code', cpp: 'code', c: 'code', h: 'code', css: 'code', html: 'code', json: 'code', xml: 'code', yaml: 'code', yml: 'code', sh: 'code', sql: 'code',
  db: 'database', sqlite: 'database', sqlite3: 'database',
}

const typeColors: Record<string, string> = {
  folder: 'text-amber-500',
  image: 'text-pink-500',
  video: 'text-purple-500',
  audio: 'text-green-500',
  document: 'text-blue-500',
  spreadsheet: 'text-emerald-500',
  presentation: 'text-orange-500',
  archive: 'text-yellow-600',
  code: 'text-cyan-500',
  database: 'text-indigo-500',
  default: 'text-gray-400',
}

interface FileIconProps {
  name: string
  isDirectory: boolean
  className?: string
  size?: number
}

export function FileIcon({ name, isDirectory, className = '', size = 24 }: FileIconProps) {
  let type = 'default'

  if (isDirectory) {
    type = 'folder'
  } else {
    const ext = name.split('.').pop()?.toLowerCase() || ''
    type = extensionToType[ext] || 'default'
  }

  const Icon = iconMap[type] || iconMap.default
  const colorClass = typeColors[type] || typeColors.default

  return <Icon className={`${colorClass} ${className}`} style={{ width: size, height: size }} />
}

export function getFileType(name: string, isDirectory: boolean): string {
  if (isDirectory) return 'folder'
  const ext = name.split('.').pop()?.toLowerCase() || ''
  return extensionToType[ext] || 'default'
}

export function isPreviewable(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const type = extensionToType[ext]
  return ['image', 'video', 'audio', 'document'].includes(type) || ext === 'pdf' || ext === 'txt' || ext === 'md'
}
