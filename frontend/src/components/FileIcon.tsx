import { Folder, File, Image, Video, Music, FileText, Archive, Code, Database, FileSpreadsheet, Presentation, BookOpen, type LucideIcon } from 'lucide-react'

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
  ebook: BookOpen,
  default: File,
}

const extensionToType: Record<string, string> = {
  // Images
  jpg: 'image', jpeg: 'image', jfif: 'image', png: 'image', gif: 'image', webp: 'image', svg: 'image', bmp: 'image', ico: 'image',
  tiff: 'image', tif: 'image', avif: 'image', heic: 'image', heif: 'image',
  // Videos
  mp4: 'video', webm: 'video', mov: 'video', avi: 'video', mkv: 'video', wmv: 'video', flv: 'video',
  // Audio
  mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', aac: 'audio', m4a: 'audio', wma: 'audio',
  // Documents (binary - not previewable as text)
  doc: 'document', docx: 'document', rtf: 'document', odt: 'document',
  // Spreadsheets
  xls: 'spreadsheet', xlsx: 'spreadsheet', csv: 'spreadsheet', ods: 'spreadsheet',
  // Presentations
  ppt: 'presentation', pptx: 'presentation', odp: 'presentation',
  // Archives
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive', bz2: 'archive',
  // Code/programming files
  js: 'code', ts: 'code', jsx: 'code', tsx: 'code', mjs: 'code', cjs: 'code',
  py: 'code', pyw: 'code', pyx: 'code',
  java: 'code', kt: 'code', scala: 'code', groovy: 'code',
  cpp: 'code', c: 'code', h: 'code', hpp: 'code', cc: 'code', cxx: 'code',
  cs: 'code', fs: 'code', vb: 'code',
  go: 'code', rs: 'code', swift: 'code', m: 'code',
  rb: 'code', php: 'code', pl: 'code', pm: 'code',
  sh: 'code', bash: 'code', zsh: 'code', fish: 'code', ps1: 'code', bat: 'code', cmd: 'code',
  html: 'code', htm: 'code', xhtml: 'code',
  css: 'code', scss: 'code', sass: 'code', less: 'code',
  json: 'code', jsonc: 'code', json5: 'code',
  xml: 'code', xsl: 'code', xslt: 'code',
  yaml: 'code', yml: 'code', toml: 'code',
  sql: 'code', graphql: 'code', gql: 'code',
  r: 'code', lua: 'code', tcl: 'code', awk: 'code', sed: 'code',
  dockerfile: 'code', makefile: 'code',
  // Text files (plain text, markdown, config)
  txt: 'code', text: 'code',
  md: 'code', markdown: 'code', rst: 'code', adoc: 'code',
  log: 'code', out: 'code',
  ini: 'code', cfg: 'code', conf: 'code', config: 'code',
  env: 'code', properties: 'code',
  gitignore: 'code', dockerignore: 'code', editorconfig: 'code',
  pdf: 'document',
  // Databases
  db: 'database', sqlite: 'database', sqlite3: 'database',
  // E-books
  epub: 'ebook', mobi: 'ebook', azw: 'ebook', azw3: 'ebook', fb2: 'ebook',
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
  ebook: 'text-rose-500',
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
  // Images, videos, audio, PDFs, and all code/text files are previewable
  return ['image', 'video', 'audio', 'code'].includes(type) || ext === 'pdf'
}

// Check if a file is a text/code file that can be syntax highlighted
export function isTextFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const type = extensionToType[ext]
  return type === 'code'
}

// Get the language identifier for syntax highlighting
export function getLanguageFromExtension(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const languageMap: Record<string, string> = {
    // JavaScript/TypeScript
    js: 'javascript', jsx: 'jsx', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'tsx',
    // Python
    py: 'python', pyw: 'python', pyx: 'python',
    // Shell
    sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'bash',
    ps1: 'powershell', bat: 'batch', cmd: 'batch',
    // Web
    html: 'html', htm: 'html', xhtml: 'html',
    css: 'css', scss: 'scss', sass: 'sass', less: 'less',
    // Data formats
    json: 'json', jsonc: 'json', json5: 'json',
    xml: 'xml', xsl: 'xml', xslt: 'xml',
    yaml: 'yaml', yml: 'yaml', toml: 'toml',
    // C family
    c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', cc: 'cpp', cxx: 'cpp',
    cs: 'csharp', java: 'java', kt: 'kotlin', scala: 'scala',
    // Other languages
    go: 'go', rs: 'rust', swift: 'swift', rb: 'ruby',
    php: 'php', pl: 'perl', lua: 'lua', r: 'r',
    sql: 'sql', graphql: 'graphql', gql: 'graphql',
    // Config/text
    md: 'markdown', markdown: 'markdown', rst: 'text',
    ini: 'ini', cfg: 'ini', conf: 'ini', config: 'ini',
    env: 'bash', properties: 'properties',
    dockerfile: 'dockerfile', makefile: 'makefile',
    log: 'text', txt: 'text', text: 'text', out: 'text',
    gitignore: 'text', dockerignore: 'text', editorconfig: 'ini',
  }
  return languageMap[ext] || 'text'
}
