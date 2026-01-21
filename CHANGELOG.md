# Changelog

All notable changes to FilaMama will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned Features
- Recursive content type search across entire filesystem
- Favorites management (add/remove from context menu)
- Dark/light theme toggle
- Arrow key navigation in file grid/list
- Drag and drop to sidebar folders
- Text file editing
- Bulk rename operations
- Advanced search filters
- Undo/redo file operations

---

## [1.1.0] - 2026-01-21

### Added
- **Drag and Drop File Moving**: Drag files/folders onto other folders to move them
  - Works with single files and multiple selections
  - Visual feedback: folders highlight with blue ring when hovering
  - Dragged items become semi-transparent
  - Works in both grid and list views
- **Keyboard Shortcuts**: Full keyboard navigation and file operations
  - `Ctrl/Cmd + A`: Select all files
  - `Ctrl/Cmd + C/X/V`: Copy, cut, paste operations
  - `Delete`: Delete selected files
  - `Enter`: Open selected file/folder
  - `Escape`: Clear selection and search
  - `F2`: Rename selected file
  - `Backspace`: Navigate to parent directory
  - Shortcuts automatically disabled when typing in input fields
- **PDF Viewer**: Custom PDF viewer using react-pdf (Mozilla PDF.js)
  - Page navigation with prev/next buttons
  - Zoom controls (50% to 300%)
  - Page counter display ("Page 1 of 10")
  - Loading spinner with status messages
  - Error handling with user-friendly messages
  - Text selection and copy support
  - Consistent experience across all browsers and mobile devices
  - Replaces unreliable browser iframe implementation
- **URL-Based State Management**: All view settings stored in URL
  - View mode (grid/list) stored in `?view=` parameter
  - Grid size stored in `?size=` parameter
  - Search query stored in `?search=` parameter
  - Content filter stored in `?filter=` parameter
  - File preview stored in `?file=` parameter
  - Every view is bookmarkable and shareable
  - Browser back/forward fully supported
  - Clean URLs with defaults omitted
  - Example: `/browse/Documents?view=list&size=150&search=report&file=doc.pdf`

### Changed
- Updated README.md with new features and keyboard shortcuts
- Created comprehensive user documentation (USAGE.md) with URL bookmarking section
- Created technical developer documentation (DEVELOPER.md)
- Created PDF viewer implementation guide (PDF_VIEWER_GUIDE.md)
- Created URL structure documentation (URL_STRUCTURE.md)
- Updated CLAUDE.md with session notes and implementation details
- Refactored FilesPage.tsx from useState to URL-based state management

### Fixed
- Resolved conflict between upload drag-and-drop and file moving drag-and-drop
- External file uploads now work correctly alongside internal file moves
- Added detection to distinguish between internal and external drag events

### Technical Details
- Modified `frontend/src/components/FileGrid.tsx` with drag handlers and external/internal drag detection
- Modified `frontend/src/components/FileList.tsx` with drag handlers and external/internal drag detection
- Modified `frontend/src/pages/FilesPage.tsx` - Complete refactor:
  - Replaced `useState` with `useSearchParams` for URL-based state
  - Added keyboard event handler with proper cleanup
  - Added `handleMove` function for drag and drop operations
  - Implemented `updateUrlParam` helper for clean URL management
  - View settings persist across folder navigation
  - Search/filter/preview cleared when changing folders
- Created `frontend/src/components/PdfViewer.tsx` - Custom PDF viewer component
- Modified `frontend/src/components/PreviewModal.tsx` to use PdfViewer
- Implemented input field detection to prevent shortcut conflicts
- Configured PDF.js worker from unpkg CDN for reliability
- Added dependencies: `react-pdf@^10.3.0`, `pdfjs-dist@^5.4.530`
- URL state management uses `{ replace: true }` to avoid polluting browser history

---

## [1.0.0] - 2026-01-13

### Added
- **URL-Based Navigation**: Browser back/forward button support with `/browse/path` URLs
- **Sidebar Navigation**:
  - Favorites section for bookmarked folders
  - Main Folders: Home, Documents, Downloads, Pictures, Videos, Music
  - Content Type Filters: Photos, Videos, GIFs, PDFs, Audio
- **Header with Breadcrumbs**: Click any path segment to navigate directly
- **Search Bar**: Real-time file filtering in top-right corner
- **Single-Click Navigation**: Open files/folders with single click
- **Checkbox Selection**: Hover to reveal checkbox, click to toggle
  - Supports multi-select (Ctrl/Cmd + Click)
  - Visible on hover or when selected
- **Restructured Toolbar**:
  - Left: Item count, refresh, selection actions (copy/cut/delete/paste)
  - Right: Size slider, grid/list toggle, new folder, upload

### Changed
- Moved FilaMama logo to bottom of sidebar
- Changed from double-click to single-click for navigation
- File selection now uses `file.path` instead of `file.name` (unique identifier)
- Sidebar paths are relative to backend root (`/home/flatstone`)
- Improved toolbar layout and action grouping

### Fixed
- Selection state properly maintained across folder navigation
- Content type filters correctly identify file extensions

---

## [0.9.0] - 2026-01-11 (Initial Release)

### Added
- **Grid View**: Responsive grid layout with thumbnails
- **List View**: Table view with name, size, and modified date
- **File Operations**:
  - Copy, cut, paste (clipboard)
  - Rename files and folders
  - Delete with confirmation dialog
  - Create new folders
  - Download single files
  - Download multiple files as ZIP
- **Drag & Drop Upload**:
  - Upload files by dragging onto window
  - Upload entire folders with preserved structure
  - Progress tracking for all uploads
  - Simultaneous multi-file uploads
- **File Preview**:
  - Images: Full-size display with zoom
  - Videos: HTML5 player with controls
  - Audio: HTML5 player with controls
  - PDFs: Browser PDF viewer
  - Text: Syntax-highlighted code display
  - Arrow key navigation between files
- **Thumbnails**:
  - Auto-generated for images
  - Auto-generated for videos (first frame)
  - Cached on backend for performance
  - Configurable sizes (thumb, large)
- **Context Menu**: Right-click menu with common actions
- **Grid Size Slider**: Adjust thumbnail size (80px - 200px)
- **Search**: Filter files by name (case-insensitive)
- **Multi-Selection**: Select multiple files for batch operations
- **Upload Progress Panel**: Track all uploads at bottom of window
- **Toast Notifications**: User feedback for all operations
- **Error Handling**: Graceful error messages for failed operations

### Backend Features
- **FastAPI** REST API with automatic OpenAPI docs
- **File System Service**:
  - List directories with sorting and filtering
  - File metadata (size, modified date, MIME type)
  - Disk usage information
  - Recursive file search
- **Thumbnail Service**:
  - Pillow-based image processing
  - Video frame extraction with ffmpeg
  - On-demand generation with caching
  - Multiple size presets
- **Upload Service**:
  - Chunked upload support (10MB chunks)
  - Folder structure preservation
  - Concurrent upload handling
  - 10GB file size limit
- **Security**:
  - Path traversal prevention
  - File type validation
  - Permission checks
  - Sandboxed to root_path directory

### Technical Stack
- **Frontend**: React 18, TypeScript, Vite, TanStack Query, Tailwind CSS, shadcn/ui
- **Backend**: FastAPI, Python 3.10+, Pydantic, Pillow, aiofiles
- **Development**: Hot reload for both frontend and backend
- **Production**: Systemd services for automatic startup

---

## Version History Summary

- **v1.1.0** (2026-01-21): Drag and drop + keyboard shortcuts
- **v1.0.0** (2026-01-13): UI overhaul with sidebar, breadcrumbs, content filters
- **v0.9.0** (2026-01-11): Initial release with core file management features

---

## Migration Guide

### From 1.0.0 to 1.1.0

No breaking changes. All existing features remain compatible.

**New Features Available:**
- Use drag and drop to move files
- Use keyboard shortcuts for faster operations

**For Developers:**
- `FileGrid` and `FileList` now accept optional `onMove` prop
- `FilesPage` includes new keyboard event handler (check dependency array)
- New documentation files: USAGE.md and DEVELOPER.md

### From 0.9.0 to 1.0.0

**Breaking Changes:**
- File paths in API responses now include full path from root
- Selection state uses `file.path` instead of `file.name`

**Migration Steps:**
1. Update any code that accessed `file.name` for selection
2. Use `file.path` as unique identifier
3. Update any hardcoded paths to be relative to root_path

**New Configuration:**
- Sidebar folders can be customized in `config.yaml`
- Content type filters can be extended with new extensions

---

## Credits

Built with:
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [TanStack Query](https://tanstack.com/query)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Radix UI](https://www.radix-ui.com/)
- [Lucide Icons](https://lucide.dev/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [Pillow](https://python-pillow.org/)
