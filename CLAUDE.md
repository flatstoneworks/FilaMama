# FilaMama - Project Memory

## Project Overview
FilaMama is a fast, beautiful file manager web application built with React (frontend) and FastAPI (backend).

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, TanStack Query, Tailwind CSS, shadcn/ui, React Router
- **Backend**: FastAPI, Python, Pydantic, Pillow (thumbnails), mutagen (audio metadata)

## URLs & Ports

### Production (systemd service)
- Frontend: http://spark.local:1030
- Backend API: http://spark.local:1031
- API Docs: http://spark.local:1031/docs

### Development (./start.sh)
- Frontend: http://spark.local:8010
- Backend API: http://spark.local:8011
- API Docs: http://spark.local:8011/docs

## Backend Configuration
- Root path: `/home/flatstone` (all frontend paths are relative to this)
- Config file: `backend/config.yaml`

## Current Features (as of 2026-02-04)

### Navigation
- **URL-based routing**: Browser history support with `/browse/path` URLs
- **Single-click navigation**: Click to open folders/preview files
- **Checkbox selection**: Hover to reveal checkbox, click to toggle selection (supports multi-select)
- **Drag and drop moving**: Drag files/folders onto other folders to move them
- **Keyboard shortcuts**: Full keyboard navigation and file operations

### Layout
- **Header**: Breadcrumbs (left) + Search bar (right)
- **Sidebar**:
  - Favorites (top) - user-defined bookmarks
  - Main Folders: Home, Documents, Downloads, Pictures, Videos, Music
  - Content Type filters: Photos, Videos, GIFs, PDFs, Audio (recursive search)
- **Toolbar**:
  - Left: item count, refresh, selection actions (copy/cut/delete/paste)
  - Right: size slider, grid/list toggle, new folder, upload
- **FilaMama logo**: Bottom of sidebar

### File Operations
- Grid/List views with adjustable thumbnail size
- Copy, cut, paste, rename, delete, move
- Drag-and-drop upload with progress, speed/ETA display, retry failed uploads
- Parallel uploads (3 concurrent) with client-side size validation
- Drag-and-drop moving between folders
- File preview (images, videos, audio, PDF, 50+ code/text formats with syntax highlighting)
- Video hover preview with timeline scrubbing
- Text/code hover preview with syntax highlighting
- Thumbnail generation
- Recursive search with 300ms debounce and truncation warnings
- Content type filtering (Photos, Videos, GIFs, PDFs, Audio) - recursive
- **File content search**: Search inside text/code files using ripgrep

### Audio Mini-Player (Spotify-style)
- **Global player**: Persists across all pages (file browser, preview, etc.)
- **Playlist mode**: Click any audio file to play all audio files in current folder
- **Playback controls**: Play/pause, previous/next track, progress bar with seek
- **Shuffle & Repeat**: Shuffle mode, repeat modes (off, all, one)
- **Volume control**: Volume slider with mute toggle
- **Metadata display**: Shows title, artist, album from ID3 tags
- **Cover art**: Extracts and displays embedded album artwork
- **Keyboard shortcuts**: Space (play/pause), Shift+Arrow (prev/next), M (mute)
- **Supported formats**: MP3, FLAC, OGG, M4A, WAV, WMA, AAC, OPUS
- **Position**: Fixed at bottom of content area (doesn't cover sidebar)

### Keyboard Shortcuts

#### File Browser
- **Ctrl/Cmd + A**: Select all files
- **Ctrl/Cmd + C**: Copy selected files
- **Ctrl/Cmd + X**: Cut selected files
- **Ctrl/Cmd + V**: Paste files
- **Delete**: Delete selected files
- **Enter**: Open selected file/folder (single selection only)
- **Escape**: Clear selection and search
- **F2**: Rename selected file (single selection only)
- **Backspace**: Navigate to parent directory

#### Video Player
- **Space / K**: Play/Pause
- **← / J**: Seek back 10 seconds
- **→ / L**: Seek forward 10 seconds
- **↑ / ↓**: Volume up/down 10%
- **M**: Mute/unmute
- **F**: Toggle fullscreen
- **0-9**: Jump to 0%-90% of video

#### Audio Mini-Player
- **Space**: Play/Pause (when not in input field)
- **Shift + ←**: Previous track
- **Shift + →**: Next track
- **M**: Mute/unmute

## Key Files

### Frontend
- `frontend/src/pages/FilesPage.tsx` - Main page with all state management
- `frontend/src/pages/PreviewPage.tsx` - File preview page (images, video, audio, PDF, code/text with syntax highlighting)
- `frontend/src/components/Header.tsx` - Header with breadcrumbs + search
- `frontend/src/components/Sidebar.tsx` - Navigation sidebar with folders & filters
- `frontend/src/components/Toolbar.tsx` - Action toolbar
- `frontend/src/components/FileGrid.tsx` - Grid view with checkbox selection, video/text hover previews
- `frontend/src/components/FileList.tsx` - List view with checkbox selection
- `frontend/src/components/FileIcon.tsx` - File type detection, icons, and preview helpers
- `frontend/src/components/VideoPlayer.tsx` - Custom video player with controls & keyboard shortcuts
- `frontend/src/components/VideoPreview.tsx` - Video hover preview with timeline scrubbing
- `frontend/src/components/TextPreview.tsx` - Text/code hover preview with syntax highlighting
- `frontend/src/components/PdfViewer.tsx` - PDF viewer using react-pdf
- `frontend/src/components/UploadProgress.tsx` - Upload progress with speed, ETA, retry
- `frontend/src/components/MiniPlayer.tsx` - Audio mini-player with cover art and metadata
- `frontend/src/contexts/AudioPlayerContext.tsx` - Global audio player state management
- `frontend/src/components/ContentSearchResults.tsx` - File content search results with match highlighting
- `frontend/src/hooks/useDebounce.ts` - Debounce hook for search
- `frontend/src/hooks/useScrollRestoration.ts` - Scroll position restoration hook
- `frontend/src/api/client.ts` - API client with URL helpers
- `frontend/src/lib/utils.ts` - Utility functions (formatVideoTime, formatBytes, formatUploadSpeed, etc.)
- `frontend/src/main.tsx` - Router configuration, global audio player provider

### Backend
- `backend/app/routers/files.py` - File operations API (list, download, stream, thumbnail, audio metadata, etc.)
- `backend/app/services/filesystem.py` - Filesystem operations service
- `backend/app/services/thumbnails.py` - Thumbnail generation service
- `backend/app/services/audio.py` - Audio metadata and cover art extraction service

## Session Notes

### Session 2026-02-03: Video Player with Seeking Support

**Problem Solved:**
Videos wouldn't seek properly because the backend returned `200 OK` with full file instead of `206 Partial Content` with byte ranges. Browsers need HTTP Range request support to seek within videos.

**Changes Made:**

1. **Backend: HTTP Range Request Support**
   - Added `/api/files/stream` endpoint with Range header parsing
   - Returns `206 Partial Content` with proper headers:
     - `Content-Range: bytes start-end/total`
     - `Accept-Ranges: bytes`
     - `Content-Length: chunk_size`
   - Streams file in chunks using `aiofiles` for async I/O
   - Supports common video/audio MIME types

2. **Frontend: Custom VideoPlayer Component**
   - Play/pause with button and Space/K keys
   - Progress bar with click-to-seek
   - Time display (current / total)
   - Volume slider with mute toggle (M key)
   - Fullscreen support (F key)
   - Playback speed selector (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x)
   - Auto-hide controls after 3s of inactivity
   - Full keyboard shortcuts (see Keyboard Shortcuts section)

3. **Integration**
   - Replaced basic `<video>` element with VideoPlayer in PreviewPage
   - Added `getStreamUrl()` helper to API client
   - Added `formatVideoTime()` utility function
   - Audio files also use streaming endpoint now
   - Arrow keys disabled for video preview (used for seeking instead of file navigation)

**Files Modified:**
- `backend/app/routers/files.py` - Added `/stream` endpoint with Range support
- `frontend/src/pages/PreviewPage.tsx` - Uses VideoPlayer, streamUrl for video/audio
- `frontend/src/api/client.ts` - Added `getStreamUrl()` helper
- `frontend/src/lib/utils.ts` - Added `formatVideoTime()` utility

**Files Created:**
- `frontend/src/components/VideoPlayer.tsx` - Custom video player (446 lines)

**API Endpoint:**
```
GET /api/files/stream?path=/path/to/video.mp4
Headers:
  Range: bytes=0-1023 (optional)
Response:
  206 Partial Content (with Range)
  200 OK (without Range)
```

**Testing:**
```bash
# Test Range support
curl -H "Range: bytes=0-1023" "http://spark.local:8011/api/files/stream?path=/Downloads/video.mp4" -v
# Expected: 206 Partial Content, Content-Range header
```

---

### Session 2026-01-21: Drag & Drop + Keyboard Shortcuts + PDF Viewer + URL State

**Changes Made:**

1. Implemented drag and drop file moving:
   - Drag files/folders onto folders to move them
   - Visual feedback: folders highlight when draggable over them
   - Dragged items become semi-transparent during drag
   - Works with both single files and multi-selection
   - Works in both grid and list views
   - Fixed conflict with upload drag and drop (external vs internal drag detection)

2. Implemented keyboard shortcuts:
   - Ctrl/Cmd + A: Select all files
   - Ctrl/Cmd + C/X/V: Copy, cut, paste
   - Delete: Delete selected files
   - Enter: Open selected item
   - Escape: Clear selection and search
   - F2: Rename selected file
   - Backspace: Navigate to parent directory
   - Shortcuts disabled when typing in input fields

3. Implemented react-pdf PDF viewer:
   - Replaced browser iframe with custom PDF viewer
   - Page navigation (prev/next buttons)
   - Zoom controls (zoom in/out, 50%-300%)
   - Page counter display
   - Loading spinner with status
   - Error handling with fallback message
   - Text selection and copy support
   - Consistent experience across all browsers
   - Works on mobile devices

4. Implemented URL-based state management:
   - All view settings stored in URL query parameters
   - View mode (grid/list) in URL
   - Grid size in URL
   - Search query in URL
   - Content type filter in URL
   - File preview in URL
   - Every view is bookmarkable and shareable
   - Browser back/forward fully supported
   - View settings persist across folder navigation
   - Search/filter/preview clear when changing folders
   - Clean URLs (defaults omitted)

**Files Modified:**
- `frontend/src/components/FileGrid.tsx` - Added drag and drop handlers with external/internal drag detection
- `frontend/src/components/FileList.tsx` - Added drag and drop handlers with external/internal drag detection
- `frontend/src/pages/FilesPage.tsx` - Complete refactor to URL-based state management, keyboard shortcuts, move handler
- `frontend/src/components/PreviewModal.tsx` - Updated to use PdfViewer component

**Files Created:**
- `frontend/src/components/PdfViewer.tsx` - Custom PDF viewer component using react-pdf
- `PDF_VIEWER_GUIDE.md` - Comprehensive guide for PDF viewer options and implementation
- `URL_STRUCTURE.md` - Complete documentation of URL structure and state management

**Dependencies Added:**
- `react-pdf` - React wrapper for PDF.js
- `pdfjs-dist` - Mozilla PDF.js library

**URL Structure:**
- Path: `/browse/path/to/folder`
- Query params: `?view=list&size=150&search=query&filter=photos&file=doc.pdf`
- All state managed via `useSearchParams` hook
- Browser back/forward fully functional
- Every view bookmarkable and shareable

### Session 2026-01-13: Initial UI Overhaul
**Changes Made:**
1. Added URL-based navigation for browser back/forward support
2. Created sidebar with Favorites, Main Folders, Content Type sections
3. Moved app logo to bottom of sidebar
4. Added header with breadcrumbs and search
5. Changed from double-click to single-click for navigation
6. Added checkbox on hover for file selection (toggle behavior)
7. Restructured toolbar layout
8. Added content type filtering (Photos, Videos, GIFs, PDFs, Audio)
9. Fixed selection to use `file.path` instead of `file.name`
10. Fixed sidebar paths to be relative to backend root

### Session 2026-02-04: Recursive Content Type Search

**Problem Solved:**
Content type filters (Photos, Videos, GIFs, PDFs, Audio) in the sidebar only filtered the current folder. Users needed to see all matching files in subfolders as well.

**Changes Made:**

1. **Backend: Extended Search API**
   - Added `CONTENT_TYPES` dictionary in `filesystem.py` with file extension mappings
   - Extended `search()` method with optional `content_type` parameter
   - Query parameter now optional (empty string matches all files)
   - Search filters by extension when content type specified
   - Added `content_type` query param to `/api/files/search` endpoint

2. **Frontend: API Client**
   - Added `searchFiles()` function to `api/client.ts`
   - Added `SearchResult` type export
   - Supports `query`, `path`, `maxResults`, and `contentType` parameters

3. **Frontend: FilesPage Integration**
   - Added `useQuery` hook for recursive content type search
   - Search query uses `content_type` and `path` params
   - Converts `SearchResult` to `FileInfo` format for display
   - Uses search results when filter active, otherwise uses directory listing
   - Fixed `handleOpen` and `openPreview` to use `file.path` directly

4. **UI Updates**
   - Added info bar below toolbar when filter is active
   - Shows "Showing all [Photos] in [folder] and subfolders"
   - Clear filter button in info bar
   - Updated empty state message for search results

**Files Modified:**
- `backend/app/services/filesystem.py` - Added CONTENT_TYPES, extended search()
- `backend/app/routers/files.py` - Added content_type param to search endpoint
- `frontend/src/api/client.ts` - Added searchFiles() and SearchResult type
- `frontend/src/pages/FilesPage.tsx` - Added search query, UI indicator

**API Usage:**
```bash
# Search by content type from a directory (recursive)
curl "http://spark.local:8011/api/files/search?content_type=photos&path=/Pictures&max_results=100"

# Combine with text query
curl "http://spark.local:8011/api/files/search?content_type=videos&query=vacation&path=/&max_results=50"
```

**Testing:**
1. Start dev servers: `./start.sh`
2. Open http://spark.local:8010
3. Navigate to a folder with subfolders
4. Click "Photos" in sidebar - should show all photos recursively
5. Navigate to different folder - search updates to that folder's scope
6. Click filter again to deselect - returns to normal directory view

---

### Session 2026-02-04: Video Hover Preview, Text Preview & Search Improvements

**Features Implemented:**

#### 1. Video Hover Preview (Timeline Scrubbing)
- Hover over video thumbnails in grid view to scrub through the video
- Moving mouse horizontally seeks through the video timeline
- Uses HTML5 Video API + Canvas for frame extraction
- Progress indicator shows current position
- No backend changes needed - reuses existing `/api/files/stream` endpoint

**Files Created:**
- `frontend/src/components/VideoPreview.tsx` - Video frame extraction component

**Files Modified:**
- `frontend/src/components/FileGrid.tsx` - Integrated VideoPreview for video files
- `frontend/src/lib/utils.ts` - Added `isVideoFile()` helper

#### 2. Text/Code File Preview with Syntax Highlighting
- **50+ new file extensions** supported for preview (.sh, .py, .js, .ts, .json, .yaml, etc.)
- **Syntax highlighting** using react-syntax-highlighter with oneDark theme
- **Hover preview in grid** - shows first 12 lines of code when hovering
- **Full preview page** - line numbers, proper language detection

**Supported Languages:**
- JavaScript/TypeScript (.js, .ts, .jsx, .tsx, .mjs)
- Python (.py, .pyw)
- Shell (.sh, .bash, .zsh, .ps1, .bat)
- Web (.html, .css, .scss, .sass)
- Data (.json, .xml, .yaml, .yml, .toml)
- C/C++/Java/Go/Rust and many more
- Config files (.ini, .cfg, .conf, .env, .properties)
- Text/Markdown (.txt, .md, .log, .rst)

**Files Created:**
- `frontend/src/components/TextPreview.tsx` - Hover preview component with syntax highlighting

**Files Modified:**
- `frontend/src/components/FileIcon.tsx` - Added extensions, `isTextFile()`, `getLanguageFromExtension()`
- `frontend/src/pages/PreviewPage.tsx` - Syntax highlighting with react-syntax-highlighter
- `frontend/src/components/FileGrid.tsx` - Integrated TextPreview for text/code files

**Dependencies Added:**
- `react-syntax-highlighter` - Syntax highlighting library
- `@types/react-syntax-highlighter` - TypeScript definitions

#### 3. Improved Search
- **Recursive text search** - Header search now searches subfolders (not just current folder)
- **300ms debounce** - Reduces API calls and UI jank while typing
- **Truncation warning** - Shows "Showing first 500 of X+ results" when results exceed limit

**Files Created:**
- `frontend/src/hooks/useDebounce.ts` - Reusable debounce hook

**Files Modified:**
- `backend/app/services/filesystem.py` - Search returns `(results, has_more, total_scanned)` tuple
- `backend/app/routers/files.py` - Updated search endpoint response format
- `backend/app/models/schemas.py` - Added `SearchResponse` model
- `frontend/src/api/client.ts` - Updated `SearchResponse` type
- `frontend/src/pages/FilesPage.tsx` - Debounced search, recursive API call, truncation UI

#### 4. Upload Improvements
- **Parallel uploads** - 3 files upload concurrently (configurable)
- **Speed & ETA display** - Shows upload speed (MB/s) and estimated time remaining
- **Retry failed uploads** - Retry button for failed uploads
- **Better error messages** - Parses server responses for detailed errors
- **Client-side size validation** - Warns about oversized files before upload

**Files Modified:**
- `frontend/src/components/UploadProgress.tsx` - Speed, ETA, retry button UI
- `frontend/src/pages/FilesPage.tsx` - Parallel batch processing, retry handler, size validation
- `frontend/src/api/client.ts` - Enhanced progress tracking, error parsing
- `frontend/src/lib/utils.ts` - Added `formatUploadSpeed()`, `formatETA()`

---

### Session 2026-02-04: SVG Preview Support

**Feature Added:**
SVG files can now be previewed with auto-generated thumbnails.

**Changes Made:**

1. **Backend: SVG Thumbnail Generation**
   - Added `cairosvg` dependency for SVG to PNG conversion
   - Added `_generate_svg_thumbnail()` method to ThumbnailService
   - SVG files now generate JPEG thumbnails like other images
   - Handles transparency by compositing on white background

**Files Modified:**
- `backend/app/services/thumbnails.py` - Added cairosvg import, SVG thumbnail method
- `backend/requirements.txt` - Added cairosvg==2.8.2

**Notes:**
- SVG was already mapped as 'image' type in FileIcon.tsx
- cairosvg requires system Cairo library (usually pre-installed on Linux)

**Bug Fix:** SVG files with dark fill colors (e.g., black) were invisible on the dark preview page background. Added white background container for SVG files in PreviewPage.tsx.

---

### Session 2026-02-04: Favorites Management & Arrow Key Navigation

**Features Added:**

#### 1. Favorites Management
- Favorites persisted to localStorage (`filamama-favorites`)
- Add folders to favorites via right-click context menu
- Remove folders from favorites via context menu or sidebar X button
- Favorites section in sidebar shows all bookmarked folders
- Visual star icon in sidebar for favorites

**Files Modified:**
- `frontend/src/pages/FilesPage.tsx` - Added favorites state, localStorage persistence, add/remove handlers
- `frontend/src/components/Sidebar.tsx` - Added remove button (X) on hover for favorites
- `frontend/src/components/FileGrid.tsx` - Added "Add to Favorites" / "Remove from Favorites" context menu
- `frontend/src/components/FileList.tsx` - Added "Add to Favorites" / "Remove from Favorites" context menu

#### 2. Arrow Key Navigation
- Navigate files in grid/list view using arrow keys
- ArrowUp/ArrowDown moves by row (respects grid columns)
- ArrowLeft/ArrowRight moves by column in grid view
- Shift+Arrow extends selection
- Space toggles selection of focused item
- Enter opens focused item when nothing selected
- Visual focus indicator (ring outline) shows current position

**Keyboard Shortcuts Added:**
| Shortcut | Action |
|----------|--------|
| `Arrow Keys` | Navigate between files |
| `Shift + Arrow` | Extend selection |
| `Space` | Toggle selection of focused item |

**Files Modified:**
- `frontend/src/pages/FilesPage.tsx` - Added focusedIndex state, arrow key handlers
- `frontend/src/components/FileGrid.tsx` - Added focus visual indicator, focusedIndex prop
- `frontend/src/components/FileList.tsx` - Added focus visual indicator, focusedIndex prop

---

### Session 2026-02-04: Audio Mini-Player with Metadata & Cover Art

**Features Implemented:**

#### 1. Global Audio Player (Spotify-style)
- Fixed player bar at bottom of content area (doesn't cover sidebar)
- Persists across all pages using React Context
- Playlist mode: plays all audio files in current folder
- Auto-advances to next track when current ends

**Components:**
- `MiniPlayer.tsx` - UI component with controls, cover art, metadata display
- `AudioPlayerContext.tsx` - Global state management (playlist, current track, playback state)

**Playback Controls:**
- Play/pause button
- Previous/Next track buttons
- Progress bar with click-to-seek
- Time display (current / total)
- Volume slider with mute toggle
- Shuffle mode (randomize track order)
- Repeat modes: off, repeat all, repeat one

#### 2. Audio Metadata Extraction
- Uses `mutagen` library for cross-format metadata extraction
- Extracts: title, artist, album, album artist, track number, year, genre
- Also extracts: duration, bitrate, sample rate, channels
- Falls back to filename if no metadata available

**Supported Formats:**
- MP3 (ID3v2 tags)
- FLAC (Vorbis comments)
- OGG Vorbis
- M4A/MP4 (iTunes tags)
- WAV, WMA, AAC, OPUS

#### 3. Cover Art Display
- Extracts embedded album artwork from audio files
- Supports APIC frames (MP3), FLAC pictures, MP4 covr atom
- Displays 48x48 thumbnail in player
- Falls back to music icon if no cover art

**Backend Endpoints:**
```
GET /api/files/audio-metadata?path=/Music/song.mp3
Response: {
  "title": "Song Title",
  "artist": "Artist Name",
  "album": "Album Name",
  "year": "2024",
  "genre": "Pop",
  "duration": 245.5,
  "bitrate": 320000,
  "has_cover": true
}

GET /api/files/audio-cover?path=/Music/song.mp3
Response: image/jpeg (binary)
```

**Files Created:**
- `backend/app/services/audio.py` - AudioMetadataService class
- `frontend/src/components/MiniPlayer.tsx` - Player UI component
- `frontend/src/contexts/AudioPlayerContext.tsx` - Global state context

**Files Modified:**
- `backend/app/main.py` - Initialize audio service
- `backend/app/routers/files.py` - Added audio-metadata and audio-cover endpoints
- `backend/requirements.txt` - Added mutagen==1.47.0
- `frontend/src/main.tsx` - Added AudioPlayerProvider and GlobalAudioPlayer
- `frontend/src/api/client.ts` - Added getAudioMetadata() and getAudioCoverUrl()
- `frontend/src/pages/FilesPage.tsx` - Uses playTrack from context
- `frontend/src/pages/PreviewPage.tsx` - Bottom padding when player open
- `frontend/src/components/FileIcon.tsx` - Added isAudioFile() helper

**Keyboard Shortcuts:**
| Shortcut | Action |
|----------|--------|
| `Space` | Play/Pause |
| `Shift + ←` | Previous track |
| `Shift + →` | Next track |
| `M` | Mute/unmute |

**Testing:**
```bash
# Test metadata extraction
curl "http://spark.local:8011/api/files/audio-metadata?path=/Music/song.mp3"

# Test cover art
curl -o cover.jpg "http://spark.local:8011/api/files/audio-cover?path=/Music/song.mp3"
```

---

### Session 2026-02-04: File Content Search

**Feature Implemented:**
Search inside text and code files for specific patterns. Uses ripgrep for fast searching with a Python fallback.

**How to Use:**
1. Click the document icon (FileText) next to the search bar to enable content search mode
2. Type your search query (minimum 2 characters)
3. Results show files with matching content and the specific lines that matched
4. Click a file or matching line to open the file preview
5. Click the icon again or clear search to return to filename search

**Backend Implementation:**
- New `/api/files/search-content` endpoint
- Uses ripgrep subprocess for fast content searching
- Falls back to Python-based search if ripgrep not installed
- Configurable limits:
  - `max_files`: Maximum files to return (default 100, max 200)
  - `max_depth`: Maximum directory depth (default 3, max 5)
  - `max_file_size_kb`: Max file size to search (1MB)
  - `max_matches_per_file`: Max matches per file (5)
- Excludes: node_modules, .git, __pycache__, dist, build, venv, minified files

**Supported File Types:**
Text files with extensions: .txt, .md, .log, .json, .xml, .yaml, .yml, .toml, .ini, .cfg, .conf, .env, .py, .js, .ts, .tsx, .jsx, .html, .css, .scss, .sh, .bash, .c, .h, .cpp, .java, .go, .rs, .rb, .php, .sql, and many more.

**Frontend Implementation:**
- Toggle button in header switches between filename and content search
- `ContentSearchResults` component displays matches with:
  - File name, path, size, and modification date
  - Matching lines with line numbers
  - Highlighted search term in matches
- URL-backed state (`?content=true&search=query`) for bookmarkable searches
- Scroll position restoration when navigating back from preview

**UX Improvements:**
- Scroll position saved to sessionStorage when navigating away
- Restored when navigating back (browser back or in-app back button)
- Search state preserved immediately (no debounce delay for UI)
- Back button uses `navigate(-1)` for proper history navigation

**Files Created:**
- `backend/app/models/schemas.py` - ContentSearchMatch, ContentSearchResult, ContentSearchResponse
- `frontend/src/components/ContentSearchResults.tsx` - Results display with highlighting
- `frontend/src/hooks/useScrollRestoration.ts` - Scroll position persistence

**Files Modified:**
- `backend/app/services/filesystem.py` - Added `search_content()` method with ripgrep/Python
- `backend/app/routers/files.py` - Added `/search-content` endpoint
- `frontend/src/api/client.ts` - Added `searchContent()` function and types
- `frontend/src/components/Header.tsx` - Added content search toggle button
- `frontend/src/components/ui/scroll-area.tsx` - Added `viewportRef` prop
- `frontend/src/pages/FilesPage.tsx` - Content search integration, scroll restoration
- `frontend/src/pages/PreviewPage.tsx` - Back button uses history navigation

**API Usage:**
```bash
# Search for "useState" in frontend source files
curl "http://spark.local:8011/api/files/search-content?query=useState&path=/Claude/FLATSTONE/FilaMama/frontend/src&max_files=10"

# Response includes files with matches
{
  "results": [
    {
      "path": "/path/to/file.tsx",
      "name": "file.tsx",
      "type": "file",
      "size": 1234,
      "modified": "2026-02-04T12:00:00",
      "matches": [
        {"line_number": 1, "line_content": "import { useState } from 'react'"},
        {"line_number": 15, "line_content": "const [value, setValue] = useState('')"}
      ]
    }
  ],
  "files_searched": 50,
  "files_with_matches": 5,
  "has_more": false
}
```

---

### Potential Future Work
- Dark/light theme toggle
- Drag and drop to sidebar folders
- Picture-in-picture mode for videos
- Subtitle/caption support for videos
- Audio visualizer in mini-player
- Queue management (add/remove tracks, reorder)
- Crossfade between tracks
