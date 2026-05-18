# REFERENCE.md — FilaMama

Detailed file maps, API endpoints, and configuration reference. See [CLAUDE.md](CLAUDE.md) for high-level overview.

## Directory Tree

```
FilaMama/
├── backend/
│   ├── app/
│   │   ├── main.py                       # FastAPI app, lifespan, service init, CORS, env var overrides, static file serving
│   │   ├── routers/
│   │   │   ├── files.py                  # File ops API (list, download, stream, thumbnail, search, content-search, audio, transcode)
│   │   │   ├── upload.py                 # Upload API with size enforcement
│   │   │   └── trash.py                  # Trash API (move, list, restore, delete-permanent, empty, info)
│   │   ├── services/
│   │   │   ├── filesystem.py             # List, search, content search (ripgrep), path validation
│   │   │   ├── thumbnails.py             # Thumbnail generation (Pillow for images, FFmpeg for video, CairoSVG for SVG)
│   │   │   ├── audio.py                  # Audio metadata extraction (mutagen) and embedded cover art
│   │   │   ├── transcoding.py            # FFmpeg video transcoding/remuxing for non-native containers
│   │   │   └── trash.py                  # Trash service with manifest tracking and file-based locking
│   │   ├── models/
│   │   │   └── schemas.py                # Pydantic models for API request/response
│   │   └── utils/
│   │       └── error_handlers.py         # @handle_fs_errors decorator for consistent error responses
│   ├── tests/
│   │   ├── conftest.py                   # Pytest fixtures
│   │   ├── test_api.py                   # API integration tests
│   │   ├── test_filesystem.py            # Filesystem service tests
│   │   └── test_thumbnails.py            # Thumbnail service tests
│   ├── config.yaml                       # Production config (root path, mounts, thumbnails, transcoding, upload)
│   ├── config.docker.yaml                # Docker defaults (/browse root, /data cache)
│   ├── config.dev.yaml                   # Development defaults
│   └── requirements.txt                  # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── main.tsx                      # Router config, ErrorBoundary, global AudioPlayerProvider
│   │   ├── pages/
│   │   │   ├── FilesPage.tsx             # Main file browser page (all state, queries, mutations)
│   │   │   └── PreviewPage.tsx           # File preview (images, video, audio, PDF, SVG, code/text)
│   │   ├── components/
│   │   │   ├── Header.tsx                # Breadcrumbs + search bar (filename & content search toggle)
│   │   │   ├── Breadcrumbs.tsx           # Breadcrumb navigation with path segments
│   │   │   ├── Sidebar.tsx               # Navigation (favorites, folders, mounts, trash badge, file type filters)
│   │   │   ├── Toolbar.tsx               # Actions, sort, view controls, clipboard indicator, upload buttons
│   │   │   ├── Layout.tsx                # App shell layout (sidebar + header + outlet)
│   │   │   ├── FileGrid.tsx              # Grid view with checkbox, video/text hover previews, relative paths
│   │   │   ├── FileList.tsx              # Virtualized list view with checkbox, relative paths
│   │   │   ├── FileContextMenu.tsx       # Right-click context menu (normal + trash mode)
│   │   │   ├── FileIcon.tsx              # File type detection, icons, and preview helpers
│   │   │   ├── VideoPlayer.tsx           # Custom video player with controls & keyboard shortcuts
│   │   │   ├── VideoPreview.tsx          # Video hover preview with timeline scrubbing
│   │   │   ├── TextPreview.tsx           # Text/code hover preview with syntax highlighting
│   │   │   ├── PdfViewer.tsx             # PDF viewer (react-pdf) with page nav and zoom
│   │   │   ├── MiniPlayer.tsx            # Spotify-style audio player (cover art, metadata, playlist)
│   │   │   ├── AudioCover.tsx            # Audio file cover art thumbnail
│   │   │   ├── ContentSearchResults.tsx  # File content search results with match highlighting
│   │   │   ├── UploadDropzone.tsx        # Drag-and-drop upload zone (files + folders)
│   │   │   ├── UploadProgress.tsx        # Upload progress with speed, ETA, retry
│   │   │   ├── DeleteDialog.tsx          # Delete confirmation (soft delete / permanent)
│   │   │   ├── ConflictDialog.tsx        # Paste conflict resolution (skip/overwrite/keep both)
│   │   │   ├── RenameDialog.tsx          # Rename with validation and extension change warning
│   │   │   ├── NewFolderDialog.tsx       # New folder creation with validation
│   │   │   ├── KeyboardShortcutsDialog.tsx # Keyboard shortcuts help dialog (? key)
│   │   │   ├── ErrorBoundary.tsx         # React error boundary with reload button
│   │   │   └── ui/                       # shadcn/ui primitives (button, dialog, input, slider, toast, etc.)
│   │   ├── hooks/
│   │   │   ├── useKeyboardShortcuts.ts   # All keyboard shortcuts (file nav, copy/cut/paste, arrows)
│   │   │   ├── useFileSelection.ts       # Selection state (single, multi, range with Shift)
│   │   │   ├── useClipboard.ts           # Copy/cut/paste with conflict detection
│   │   │   ├── useFileUpload.ts          # Upload queue with 3 concurrent parallel processing
│   │   │   ├── useFileNavigation.ts      # Navigate, open, preview, download handlers
│   │   │   ├── useFavorites.ts           # Favorites persistence (localStorage)
│   │   │   ├── useDragAndDrop.ts         # Internal drag-and-drop file moving
│   │   │   ├── useDebounce.ts            # Debounce hook (300ms for search)
│   │   │   └── useScrollRestoration.ts   # Scroll position restoration on back navigation
│   │   ├── contexts/
│   │   │   └── AudioPlayerContext.tsx     # Global audio player state (playlist, playback, shuffle, repeat)
│   │   ├── api/
│   │   │   └── client.ts                 # Typed API client with all endpoints and URL helpers
│   │   ├── lib/
│   │   │   └── utils.ts                  # Utilities (formatVideoTime, formatBytes, formatUploadSpeed, cn)
│   │   └── index.css                     # Theme tokens, CSS variables (--sidebar-width: 13rem)
│   ├── tests/
│   │   ├── navigation.spec.ts            # Navigation e2e tests (Playwright)
│   │   ├── file-operations.spec.ts       # File operations e2e tests
│   │   ├── video-player.spec.ts          # Video player e2e tests
│   │   └── pdf-viewer.spec.ts            # PDF viewer e2e tests
│   ├── package.json
│   ├── vite.config.ts                    # Vite config with /api proxy to backend
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── playwright.config.ts
├── templates/
│   ├── filamama.service.template         # systemd unit template
│   ├── com.filamama.plist.template       # launchd plist template (macOS)
│   └── config.yaml.template             # Config wizard template
├── Dockerfile                            # Multi-stage: node:20-slim (build) → python:3.12-slim (runtime)
├── docker-compose.yml                    # Single service, volume mounts, BROWSE_PATH env
├── .dockerignore
├── install-filamama.sh                   # Smart install script (Linux apt/dnf/pacman + macOS brew)
├── install.sh                            # Legacy install script
├── uninstall.sh                          # Uninstall script
├── start.sh                              # Development start (backend 8011 + frontend 8010)
├── ports.json                            # Port configuration reference
├── filamama-backend.service              # Legacy systemd service (backend only)
├── filamama-frontend.service             # Legacy systemd service (frontend only)
├── CHANGELOG.md
├── DEVELOPER.md
├── INSTALLATION.md
├── USAGE.md
├── URL_STRUCTURE.md
├── PDF_VIEWER_GUIDE.md
└── WORD_VIEWER_ROADMAP.md
```

## API Endpoints

### Files (`/api/files/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/files/list` | List directory contents (with thumbnails, metadata) |
| GET | `/api/files/download` | Download single file |
| GET | `/api/files/stream` | Stream file with HTTP Range support |
| GET | `/api/files/thumbnail` | Get generated thumbnail (images, video, SVG) |
| GET | `/api/files/search` | Recursive filename search (300ms debounce on client) |
| GET | `/api/files/search-content` | Search inside files using ripgrep |
| GET | `/api/files/audio-metadata` | Audio metadata (ID3, Vorbis via mutagen) |
| GET | `/api/files/audio-cover` | Embedded cover art extraction |
| GET | `/api/files/transcode-stream` | FFmpeg transcode stream for non-native video |
| POST | `/api/files/mkdir` | Create directory |
| POST | `/api/files/rename` | Rename file/folder |
| POST | `/api/files/copy` | Copy files |
| POST | `/api/files/move` | Move files |
| POST | `/api/files/download-zip` | Download as ZIP (4GB limit) |
| POST | `/api/files/check-conflicts` | Check paste conflicts before copy/move |

### Upload (`/api/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload files (3 concurrent, client + server size validation) |

### Trash (`/api/trash/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/trash/move-to-trash` | Soft delete (moves to `.deleted_items/`) |
| GET | `/api/trash/list` | List trash contents |
| POST | `/api/trash/restore` | Restore to original location (recreates parent dirs) |
| POST | `/api/trash/delete-permanent` | Permanently delete from trash |
| POST | `/api/trash/empty` | Empty all trash |
| GET | `/api/trash/info` | Trash summary (item count) |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/config` | App configuration (root path, mounts, upload limits) |

## Configuration

### config.yaml

```yaml
server:
  host: "0.0.0.0"
  port: 1031

root_path: "/home/user"

mounts:
  - name: "External"
    path: "/media/external"
    icon: "hard-drive"

thumbnails:
  enabled: true
  cache_dir: "data/thumbnails"
  sizes: { thumb: 256, large: 1080 }
  quality: 85
  max_cache_size_mb: 500

transcoding:
  cache_dir: "data/transcoded"
  max_cache_size_mb: 2000

upload:
  max_size_mb: 10240
```

### Environment Variable Overrides

| Variable | Description |
|----------|-------------|
| `FILAMAMA_CONFIG` | Config file path |
| `FILAMAMA_ROOT_PATH` | Root browse directory |
| `FILAMAMA_HOST` | Server bind host |
| `FILAMAMA_PORT` | Server bind port |
| `FILAMAMA_DATA_DIR` | Thumbnail + transcoding cache directory |
| `FILAMAMA_MAX_UPLOAD_MB` | Max upload size in MB |
| `FILAMAMA_CORS_ORIGINS` | Comma-separated CORS origins |
| `FILAMAMA_FRONTEND_DIST` | Frontend dist directory path |
| `FILAMAMA_AUTH_USER` | Basic Auth username |
| `FILAMAMA_AUTH_PASSWORD` | Basic Auth password |
| `FILAMAMA_ALLOW_INSECURE` | Allow network-exposed startup without auth; local development only |

## Keyboard Shortcuts

### File Browser

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + A` | Select all |
| `Ctrl/Cmd + C/X/V` | Copy / Cut / Paste |
| `Delete` | Move to trash |
| `Enter` | Open file/folder |
| `Escape` | Clear selection and search |
| `F2` | Rename |
| `Backspace` | Go to parent |
| `Arrow keys` | Navigate files |
| `Shift + Arrow` | Extend selection |
| `Space` | Toggle selection |
| `?` | Show shortcuts help |

### Video Player

| Shortcut | Action |
|----------|--------|
| `Space / K` | Play/Pause |
| `← / J` | Seek back 10s |
| `→ / L` | Seek forward 10s |
| `↑ / ↓` | Volume up/down 10% |
| `M` | Mute/unmute |
| `F` | Toggle fullscreen |
| `0-9` | Jump to 0%-90% |

### Audio Mini-Player

| Shortcut | Action |
|----------|--------|
| `Space` | Play/Pause |
| `Shift + ←/→` | Previous/next track |
| `M` | Mute/unmute |

## Deployment Options

### VPS Docker

```bash
curl -fsSL https://raw.githubusercontent.com/flatstoneworks/FilaMama/main/install-vps.sh | bash
```

Uses `ghcr.io/flatstoneworks/filamama:latest`, writes `/opt/filamama/docker-compose.yml`, and requires Basic Auth.

### Local Docker

```bash
docker compose up                              # Browse ~/
BROWSE_PATH=/path/to/files docker compose up   # Browse custom path
```

The local Compose file builds from source and enables insecure mode for local-only testing. Multi-stage build: `node:20-slim` (frontend build) → `python:3.12-slim` (runtime). Config: `config.docker.yaml`.

### Install Script

```bash
./install-filamama.sh              # Interactive install
./install-filamama.sh --status     # Check service status
./install-filamama.sh --update     # Pull + rebuild + restart
./install-filamama.sh --configure  # Re-run config wizard
./install-filamama.sh --uninstall  # Remove service
```

Supports Linux (apt/dnf/pacman) and macOS (brew). Sets up systemd or launchd service. Interactive config wizard for root path, port, upload limit.

## Supported Formats

### Audio (Mini-Player)
MP3, FLAC, OGG, M4A, WAV, WMA, AAC, OPUS

### Video (Native playback)
MP4, WebM, MOV

### Video (Transcoded via FFmpeg)
AVI, WMV, FLV, TS, 3GP, MKV, and other non-native containers

### Code Preview (Syntax Highlighting)
50+ languages including JS, TS, Python, Ruby, Go, Rust, Java, C/C++, PHP, SQL, YAML, JSON, HTML, CSS, Markdown, Shell, and more

### Thumbnails
Images (JPEG, PNG, GIF, WebP, BMP, TIFF), Video (frame extraction), SVG (CairoSVG rasterization)
