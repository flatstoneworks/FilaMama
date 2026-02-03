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

## Current Features (as of 2026-02-03)

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
  - Content Type filters: Photos, Videos, GIFs, PDFs, Audio
- **Toolbar**:
  - Left: item count, refresh, selection actions (copy/cut/delete/paste)
  - Right: size slider, grid/list toggle, new folder, upload
- **FilaMama logo**: Bottom of sidebar

### File Operations
- Grid/List views with adjustable thumbnail size
- Copy, cut, paste, rename, delete, move
- Drag-and-drop upload with progress
- Drag-and-drop moving between folders
- File preview (images, videos with custom player, audio, PDF, text)
- Thumbnail generation
- Search/filter functionality
- Content type filtering

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
- `frontend/src/pages/PreviewPage.tsx` - File preview page (images, video, audio, PDF, text)
- `frontend/src/components/Header.tsx` - Header with breadcrumbs + search
- `frontend/src/components/Sidebar.tsx` - Navigation sidebar with folders & filters
- `frontend/src/components/Toolbar.tsx` - Action toolbar
- `frontend/src/components/FileGrid.tsx` - Grid view with checkbox selection
- `frontend/src/components/FileList.tsx` - List view with checkbox selection
- `frontend/src/components/VideoPlayer.tsx` - Custom video player with controls & keyboard shortcuts
- `frontend/src/components/PdfViewer.tsx` - PDF viewer using react-pdf
- `frontend/src/api/client.ts` - API client with URL helpers
- `frontend/src/lib/utils.ts` - Utility functions (formatVideoTime, formatBytes, etc.)
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

### Potential Future Work
- Recursive content type search across entire filesystem (requires backend API)
- Favorites management (add/remove from context menu)
- Dark/light theme toggle
- Arrow key navigation in file grid/list
- Drag and drop to sidebar folders
- Video thumbnail preview on hover (timeline scrubbing)
- Picture-in-picture mode for videos
- Subtitle/caption support for videos
