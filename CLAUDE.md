# FilaMama - Project Memory

## Project Overview
FilaMama is a fast, beautiful file manager web application built with React (frontend) and FastAPI (backend).

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, TanStack Query, Tailwind CSS, shadcn/ui, React Router
- **Backend**: FastAPI, Python, Pydantic, Pillow (thumbnails)

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
- `frontend/src/hooks/useDebounce.ts` - Debounce hook for search
- `frontend/src/api/client.ts` - API client with URL helpers
- `frontend/src/lib/utils.ts` - Utility functions (formatVideoTime, formatBytes, formatUploadSpeed, etc.)
- `frontend/src/main.tsx` - Router configuration

### Backend
- `backend/app/routers/files.py` - File operations API (list, download, stream, thumbnail, etc.)
- `backend/app/services/filesystem.py` - Filesystem operations service
- `backend/app/services/thumbnails.py` - Thumbnail generation service

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
- Browser natively displays SVG in preview (no frontend changes needed)
- cairosvg requires system Cairo library (usually pre-installed on Linux)

---

### Potential Future Work
- Favorites management (add/remove from context menu)
- Dark/light theme toggle
- Arrow key navigation in file grid/list
- Drag and drop to sidebar folders
- Picture-in-picture mode for videos
- Subtitle/caption support for videos
- File content search (search inside text files)
