# FilaMama - Project Memory

## Project Overview
FilaMama is a fast, beautiful file manager web application built with React (frontend) and FastAPI (backend).

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, TanStack Query, Tailwind CSS, shadcn/ui, React Router
- **Backend**: FastAPI, Python, Pydantic, Pillow (thumbnails), mutagen (audio metadata), FFmpeg (video transcoding)

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

## Current Features (as of 2026-02-10)

### Navigation
- **URL-based routing**: Browser history support with `/browse/path` URLs
- **Single-click navigation**: Click to open folders/preview files
- **Checkbox selection**: Hover to reveal checkbox, click to toggle selection (supports multi-select)
- **Drag and drop moving**: Drag files/folders onto other folders to move them
- **Keyboard shortcuts**: Full keyboard navigation and file operations
- **? key help dialog**: Shows all keyboard shortcuts

### Layout
- **Header**: Breadcrumbs (left) + Search bar (right)
- **Sidebar**:
  - Favorites (top) - user-defined bookmarks with "Right-click a folder to add" hint
  - Main Folders: Home, Documents, Downloads, Pictures, Videos, Music, Trash (with count badge)
  - Mounts: Configured external mount points
  - File Type filters: Photos, Videos, GIFs, PDFs, Audio (recursive search)
- **Toolbar**:
  - Left: item count, refresh (spin animation), selection actions (copy/cut/delete/paste), clipboard indicator
  - Right: sort controls, size slider, grid/list toggle, new folder, upload files/folder
- **FilaMama logo**: Bottom of sidebar
- **CSS variable**: `--sidebar-width: 13rem` shared across components

### File Operations
- Grid/List views with adjustable thumbnail size
- Copy, cut, paste, rename, delete (soft-delete to trash), move
- Paste conflict resolution dialog (skip, overwrite, keep both)
- Drag-and-drop upload with progress, speed/ETA display, retry failed uploads
- Parallel uploads (3 concurrent) with client-side + server-side size validation
- Drag-and-drop moving between folders
- File preview (images, videos, audio, PDF, SVG, 50+ code/text formats with syntax highlighting)
- Video hover preview with timeline scrubbing
- Video transcoding (FFmpeg) for non-native containers (.avi, .wmv, .flv, etc.)
- Text/code hover preview with syntax highlighting
- Thumbnail generation (images, videos, SVG)
- Recursive search with 300ms debounce and truncation warnings, load more button
- Content type filtering (Photos, Videos, GIFs, PDFs, Audio) - recursive with relative path display
- **File content search**: Search inside text/code files using ripgrep
- Sort by name, size, date modified, type (ascending/descending)
- Filename validation (illegal characters, reserved names)
- Extension change warning in rename dialog
- "Open in New Tab" context menu for folders
- Scroll position restoration when navigating back

### Trash System
- **Soft delete**: Files moved to `.deleted_items/` folder instead of permanent deletion
- **Manifest**: `.deleted_items/.manifest.json` tracks original paths and deletion timestamps
- **Sidebar badge**: Shows count of items in trash
- **Trash view**: Browse deleted items at `/.deleted_items` path
- **Restore**: Right-click → Restore returns files to original location (recreates parent dirs if needed)
- **Permanent delete**: Delete from within trash view permanently removes files
- **Empty trash**: Bulk permanent deletion of all trash items with confirmation dialog
- **Concurrency safety**: File-based locking on manifest operations

### Audio Mini-Player (Spotify-style)
- **Global player**: Persists across all pages (file browser, preview, etc.)
- **Playlist mode**: Click any audio file to play all audio files in current folder
- **Playback controls**: Play/pause, previous/next track, progress bar with seek
- **Shuffle & Repeat**: Shuffle mode, repeat modes (off, all, one)
- **Volume control**: Volume slider with mute toggle
- **Metadata display**: Shows title, artist, album from ID3 tags
- **Cover art**: Extracts and displays embedded album artwork
- **ARIA labels**: All buttons have descriptive aria-labels
- **Keyboard shortcuts**: Space (play/pause), Shift+Arrow (prev/next), M (mute)
- **Supported formats**: MP3, FLAC, OGG, M4A, WAV, WMA, AAC, OPUS
- **Position**: Fixed at bottom of content area (doesn't cover sidebar), uses CSS variable for left offset

### Security & Reliability
- **Path traversal protection**: All file operations validate resolved paths stay within root
- **Upload size enforcement**: Server-side max upload size (configurable via `config.yaml`)
- **Zip download limit**: 4GB maximum for zip downloads
- **Service initialization guards**: 503 responses when services not yet ready
- **Error boundary**: React ErrorBoundary wraps entire app with friendly error page
- **CORS hardening**: Explicit origin allowlist
- **Input validation**: Filename character validation, reserved name checks

### Accessibility
- **Skip-to-content link**: Hidden link for keyboard users
- **ARIA roles**: `role="grid"/"gridcell"/"row"` on file views, `aria-selected` on items
- **Roving tabindex**: `tabIndex={0}` on focused item, `-1` on others
- **Keyboard navigation**: Full arrow key navigation, Shift+Arrow for selection extension
- **No shortcut conflicts**: Shift+Arrow properly scoped between MiniPlayer and file browser

### Keyboard Shortcuts

#### File Browser
- **Ctrl/Cmd + A**: Select all files
- **Ctrl/Cmd + C**: Copy selected files
- **Ctrl/Cmd + X**: Cut selected files
- **Ctrl/Cmd + V**: Paste files
- **Delete**: Delete selected files (moves to trash)
- **Enter**: Open selected file/folder (single selection only)
- **Escape**: Clear selection and search
- **F2**: Rename selected file (single selection only)
- **Backspace**: Navigate to parent directory
- **Arrow keys**: Navigate between files in grid/list
- **Shift + Arrow**: Extend selection
- **Space**: Toggle selection of focused item
- **?**: Show keyboard shortcuts help dialog

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

### Frontend — Pages
- `frontend/src/pages/FilesPage.tsx` - Main page with all state management, queries, mutations
- `frontend/src/pages/PreviewPage.tsx` - File preview page (images, video, audio, PDF, SVG, code/text)
- `frontend/src/main.tsx` - Router configuration, ErrorBoundary, global audio player provider

### Frontend — Components
- `frontend/src/components/Header.tsx` - Header with breadcrumbs + search (filename & content search toggle)
- `frontend/src/components/Sidebar.tsx` - Navigation sidebar (favorites, folders, mounts, trash, file types)
- `frontend/src/components/Toolbar.tsx` - Action toolbar with sort, view controls, clipboard indicator
- `frontend/src/components/FileGrid.tsx` - Grid view with checkbox, video/text hover previews, relative path display
- `frontend/src/components/FileList.tsx` - Virtualized list view with checkbox, relative path display
- `frontend/src/components/FileContextMenu.tsx` - Right-click context menu (normal + trash mode)
- `frontend/src/components/FileIcon.tsx` - File type detection, icons, and preview helpers
- `frontend/src/components/VideoPlayer.tsx` - Custom video player with controls & keyboard shortcuts
- `frontend/src/components/VideoPreview.tsx` - Video hover preview with timeline scrubbing
- `frontend/src/components/TextPreview.tsx` - Text/code hover preview with syntax highlighting
- `frontend/src/components/PdfViewer.tsx` - PDF viewer using react-pdf
- `frontend/src/components/MiniPlayer.tsx` - Audio mini-player with cover art and metadata
- `frontend/src/components/AudioCover.tsx` - Audio file cover art thumbnail
- `frontend/src/components/UploadDropzone.tsx` - Drag-and-drop upload zone (files + folders)
- `frontend/src/components/UploadProgress.tsx` - Upload progress with speed, ETA, retry
- `frontend/src/components/ContentSearchResults.tsx` - File content search results with match highlighting
- `frontend/src/components/DeleteDialog.tsx` - Delete confirmation (soft delete or permanent)
- `frontend/src/components/ConflictDialog.tsx` - Paste conflict resolution (skip/overwrite/keep both)
- `frontend/src/components/RenameDialog.tsx` - Rename with validation and extension change warning
- `frontend/src/components/NewFolderDialog.tsx` - New folder with validation
- `frontend/src/components/KeyboardShortcutsDialog.tsx` - Keyboard shortcuts help dialog
- `frontend/src/components/ErrorBoundary.tsx` - React error boundary with reload button

### Frontend — Hooks
- `frontend/src/hooks/useKeyboardShortcuts.ts` - All keyboard shortcuts (file nav, copy/cut/paste, arrows)
- `frontend/src/hooks/useFileSelection.ts` - File selection state (single, multi, range)
- `frontend/src/hooks/useClipboard.ts` - Copy/cut/paste with conflict detection
- `frontend/src/hooks/useFileUpload.ts` - Upload queue with parallel processing
- `frontend/src/hooks/useFileNavigation.ts` - Navigate, open, preview, download handlers
- `frontend/src/hooks/useFavorites.ts` - Favorites persistence (localStorage)
- `frontend/src/hooks/useDragAndDrop.ts` - Internal drag-and-drop file moving
- `frontend/src/hooks/useDebounce.ts` - Debounce hook for search
- `frontend/src/hooks/useScrollRestoration.ts` - Scroll position restoration

### Frontend — Other
- `frontend/src/contexts/AudioPlayerContext.tsx` - Global audio player state management
- `frontend/src/api/client.ts` - API client with all endpoints and URL helpers
- `frontend/src/lib/utils.ts` - Utility functions (formatVideoTime, formatBytes, formatUploadSpeed, etc.)
- `frontend/src/index.css` - Theme tokens, CSS variables (`--sidebar-width`)

### Backend
- `backend/app/main.py` - FastAPI app, lifespan, service initialization, CORS config
- `backend/app/routers/files.py` - File operations API (list, download, stream, thumbnail, audio, search)
- `backend/app/routers/upload.py` - Upload API with size enforcement
- `backend/app/routers/trash.py` - Trash API (move-to-trash, list, restore, delete-permanent, empty, info)
- `backend/app/services/filesystem.py` - Filesystem operations (list, search, content search)
- `backend/app/services/thumbnails.py` - Thumbnail generation (images, videos, SVG)
- `backend/app/services/audio.py` - Audio metadata and cover art extraction
- `backend/app/services/trash.py` - Trash service (manifest management, move/restore/delete)
- `backend/app/services/transcoding.py` - FFmpeg video transcoding/remuxing service
- `backend/app/models/schemas.py` - Pydantic models for API request/response
- `backend/config.yaml` - Server configuration (root path, mounts, content types, upload limits)

## Session Notes

### Sessions up to 2026-02-04

Features built in earlier sessions (see git log for details):
- Initial UI overhaul: sidebar, header, breadcrumbs, URL routing, checkbox selection
- Drag & drop file moving, keyboard shortcuts, PDF viewer, URL-based state management
- Video player with HTTP Range seeking support
- Recursive content type search
- Video hover preview with timeline scrubbing
- Text/code file preview with syntax highlighting (50+ extensions)
- Improved search with debounce, truncation warnings, load more
- Parallel uploads with speed/ETA, retry
- SVG preview with thumbnail generation
- Favorites management with localStorage persistence
- Arrow key navigation with visual focus indicator
- Audio mini-player with metadata extraction and cover art
- File content search using ripgrep with highlighted results

---

### Session 2026-02-05: Security Hardening

**Commit**: `3576b27`

- Fixed CORS to use explicit origin allowlist instead of wildcard
- Fixed upload path traversal (reject `..` in filenames)
- Fixed ReDoS in search by sanitizing regex characters
- Added proper input validation throughout

---

### Session 2026-02-05: Backend Refactor

**Commit**: `2a26579`

- Converted synchronous file I/O to async with `asyncio.to_thread`
- Replaced print statements with proper `logging` module
- Cleaned up unused dependencies

---

### Session 2026-02-05: Frontend Refactor

**Commit**: `d6e44ad`

Extracted FilesPage.tsx (was ~800 lines) into reusable hooks:
- `useFileSelection.ts` - Selection state management
- `useClipboard.ts` - Copy/cut/paste with conflict detection
- `useFileUpload.ts` - Upload queue with parallel processing
- `useFileNavigation.ts` - Navigation and preview handlers
- `useFavorites.ts` - Favorites persistence
- `useDragAndDrop.ts` - Internal drag-and-drop
- Also created `ConflictDialog.tsx` for paste conflicts

---

### Session 2026-02-06: Video Transcoding

**Commit**: `898a196`

Added FFmpeg transcoding/remuxing for non-native video containers (.avi, .wmv, .flv, .ts, .3gp, etc.):
- Backend: `TranscodingService` with `GET /api/files/transcode-stream` endpoint
- Streams transcoded video in real-time using FFmpeg subprocess
- Frontend: `videoNeedsTranscoding()` helper, uses transcode URL for non-native formats
- Thumbnail generation also works for transcoded formats

---

### Session 2026-02-07: UI Polish & UX Improvements

**Commits**: `51f3a13`, `20e7f49`, `c2b89fc`, `aa2e99b`

- Scroll position restoration when returning from preview
- "Load more" button for truncated search/filter results
- Unified theme tokens, spacing, selection states, removed dead CSS
- Sort controls (name/size/date/type, asc/desc) with URL persistence
- ARIA labels on toolbar buttons, keyboard shortcuts help dialog (`?` key)

---

### Session 2026-02-08: Trash System

**Commits**: `2ad8c95`, `d1fea04`

Full soft-delete trash system:
- **Backend**: `TrashService` with manifest-based tracking, file-based locking
- **API**: `POST /api/trash/move-to-trash`, `GET /api/trash/list`, `POST /api/trash/restore`, `POST /api/trash/delete-permanent`, `POST /api/trash/empty`, `GET /api/trash/info`
- **Frontend**: Trash entry in sidebar with count badge, trash view at `/.deleted_items`, restore/delete-permanent context menu actions, "Empty Trash" button with confirmation dialog
- **Edge cases**: Name collision on restore (appends counter), recreates parent dirs, manifest concurrency lock

---

### Session 2026-02-10: Security & UX Audit Fixes

**Commits**: `fb64a0c`, `38a7cc2`, `24a48a9`, `1405ba9`

Ran comprehensive visual design audit (mark-angelo) and UX audit (ux-ui-specialist), then fixed all findings by severity:

**HIGH (Security/Architecture)** — `fb64a0c`
- Zip download: `@handle_fs_errors` decorator + 4GB size limit
- Upload: server-side `max_upload_bytes` enforcement
- Audio service: `.resolve()` + bounds check on path validation
- All routers: 503 guards for uninitialized services (`_require_fs()`, `_require_trash()`)
- Stream endpoint: refactored to shared `_serve_file_with_ranges()` helper

**MAJOR (UX/Accessibility)** — `38a7cc2`
- Fixed Shift+Arrow keyboard conflict between MiniPlayer and file browser
- Added `tabIndex`, `aria-selected`, `aria-label` to grid/list items
- Added aria-labels to all 8 MiniPlayer buttons
- Enlarged checkbox click targets with `p-1.5` padding

**MEDIUM** — `24a48a9`
- Renamed "Content Type" → "File Types" in sidebar
- Added clipboard state indicator ("N copied/cut") in toolbar
- Added filename validation (illegal characters) in NewFolderDialog and RenameDialog
- Upload progress panel shifts up when MiniPlayer open
- Extracted `--sidebar-width` CSS variable shared across Sidebar, MiniPlayer, keyboard nav

**LOW** — `1405ba9`
- Removed console.log debug statements from UploadDropzone
- Changed empty favorites text to "Right-click a folder to add"
- Added extension change warning in RenameDialog
- Added React ErrorBoundary wrapping entire app
- Added refresh button spin animation (750ms)
- Added relative path display for search/filter results in grid/list views
- Added "Open in New Tab" context menu for folders

---

### Potential Future Work
- Dark/light theme toggle
- Drag and drop to sidebar folders
- Picture-in-picture mode for videos
- Subtitle/caption support for videos
- Audio visualizer in mini-player
- Queue management (add/remove tracks, reorder)
- Crossfade between tracks
- Batch operations progress (bulk move/copy)
- File info panel (metadata sidebar)
