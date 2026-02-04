# FilaMama

A fast, beautiful file manager web application built with React and FastAPI. Features a Spotify-style audio player with metadata and cover art, video timeline scrubbing, syntax-highlighted code previews, recursive search, and parallel uploads.

![FilaMama Screenshot](https://img.shields.io/badge/Status-Active-brightgreen)

## Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite (dev server & build)
- TanStack Query (data fetching)
- Tailwind CSS + shadcn/ui (styling)
- Radix UI (accessible components)
- Lucide React (icons)
- react-syntax-highlighter (code highlighting)
- react-pdf (PDF viewing)

**Backend:**
- FastAPI (Python)
- Pydantic (validation)
- python-magic (MIME detection)
- Pillow (image thumbnails)
- aiofiles (async file I/O)
- ffmpeg (video thumbnails)
- mutagen (audio metadata & cover art extraction)

## Features

### File Management
- **Grid & List Views** - Toggle between views with adjustable thumbnail size slider
- **Breadcrumb Navigation** - Click any path segment to navigate
- **File Operations** - Copy, cut, paste, rename, delete, move, create folder
- **Drag & Drop Upload** - Upload files/folders by dragging onto the browser
- **Drag & Drop Moving** - Drag files/folders onto folders to move them
- **Multi-Selection** - Click checkboxes or Ctrl/Cmd+Click to select multiple files
- **Context Menu** - Right-click for quick actions
- **Favorites** - Bookmark folders for quick access (right-click → Add to Favorites)
- **Arrow Key Navigation** - Navigate files with arrow keys, Shift+Arrow to extend selection

### Upload Experience
- **Parallel Uploads** - 3 concurrent uploads for faster batch transfers
- **Speed & ETA Display** - Real-time upload speed (MB/s) and time remaining
- **Progress Tracking** - Individual and overall progress indicators
- **Retry Failed Uploads** - One-click retry for failed uploads
- **Client-Side Validation** - Size limit warnings before upload begins
- **Better Error Messages** - Detailed error feedback from server

### Preview & Viewing

#### Video Preview
- **Custom Video Player** - Full-featured player with keyboard controls
- **Timeline Scrubbing on Hover** - Move mouse over video thumbnails to preview different frames
- **Playback Speed Control** - 0.5x to 2x speed options
- **Fullscreen Support** - Press F for fullscreen mode

#### Code & Text Preview
- **50+ File Types Supported** - JavaScript, Python, Shell, JSON, YAML, Markdown, and many more
- **Syntax Highlighting** - Beautiful code coloring with oneDark theme
- **Line Numbers** - Easy code navigation in full preview
- **Hover Preview** - See first 12 lines of code by hovering in grid view

**Supported Languages:**
| Category | Extensions |
|----------|------------|
| JavaScript/TypeScript | `.js`, `.ts`, `.jsx`, `.tsx`, `.mjs`, `.cjs` |
| Python | `.py`, `.pyw`, `.pyx` |
| Shell | `.sh`, `.bash`, `.zsh`, `.ps1`, `.bat`, `.cmd` |
| Web | `.html`, `.css`, `.scss`, `.sass`, `.less` |
| Data | `.json`, `.xml`, `.yaml`, `.yml`, `.toml` |
| C/C++/Java | `.c`, `.cpp`, `.h`, `.java`, `.cs`, `.go`, `.rs` |
| Config | `.ini`, `.cfg`, `.conf`, `.env`, `.properties` |
| Text | `.txt`, `.md`, `.log`, `.rst` |

#### Audio Mini-Player (Spotify-style)
- **Global Player** - Persists across all pages (file browser, preview, etc.)
- **Playlist Mode** - Click any audio file to play all audio files in the current folder
- **Playback Controls** - Play/pause, previous/next track, progress bar with seek
- **Shuffle & Repeat** - Shuffle mode, repeat modes (off, repeat all, repeat one)
- **Volume Control** - Volume slider with mute toggle
- **Metadata Display** - Shows title, artist, album extracted from ID3/Vorbis tags
- **Cover Art** - Displays embedded album artwork from audio files
- **Keyboard Shortcuts** - Space (play/pause), Shift+Arrow (prev/next), M (mute)

**Supported Audio Formats:**
| Format | Metadata Support |
|--------|------------------|
| MP3 | ID3v1, ID3v2 tags |
| FLAC | Vorbis comments |
| OGG | Vorbis comments |
| M4A/AAC | iTunes-style tags |
| WAV | Basic metadata |
| WMA | ASF metadata |
| OPUS | Vorbis comments |

#### Other Previews
- **Image Preview** - Full-size image viewing with navigation
- **PDF Viewer** - Page navigation, zoom controls (50%-300%), text selection
- **Thumbnails** - Auto-generated for images (including SVG), videos, and GIFs

### Search & Navigation
- **Recursive Search** - Search files in current folder and all subfolders
- **300ms Debounce** - Smooth typing experience without lag
- **Truncation Warning** - Shows when results exceed 500 limit
- **Content Type Filters** - Quick filters for Photos, Videos, GIFs, PDFs, Audio
- **URL-Based State** - Bookmarkable views, browser back/forward support

### Keyboard Shortcuts

#### File Browser
| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + A` | Select all files |
| `Ctrl/Cmd + C` | Copy selected files |
| `Ctrl/Cmd + X` | Cut selected files |
| `Ctrl/Cmd + V` | Paste files |
| `Delete` | Delete selected files |
| `Enter` | Open selected file/folder |
| `Escape` | Clear selection and search |
| `F2` | Rename selected file |
| `Backspace` | Navigate to parent directory |
| `Arrow Keys` | Navigate between files in grid/list |
| `Shift + Arrow` | Extend selection while navigating |
| `Space` | Toggle selection of focused file |

#### Video Player
| Shortcut | Action |
|----------|--------|
| `Space` / `K` | Play/Pause |
| `←` / `J` | Seek back 10 seconds |
| `→` / `L` | Seek forward 10 seconds |
| `↑` / `↓` | Volume up/down 10% |
| `M` | Mute/unmute |
| `F` | Toggle fullscreen |
| `0-9` | Jump to 0%-90% of video |

#### Audio Mini-Player
| Shortcut | Action |
|----------|--------|
| `Space` | Play/Pause (when not in input field) |
| `Shift + ←` | Previous track |
| `Shift + →` | Next track |
| `M` | Mute/unmute |

## Project Structure

```
FilaMama/
├── backend/
│   ├── app/
│   │   ├── models/
│   │   │   └── schemas.py          # Pydantic models
│   │   ├── services/
│   │   │   ├── filesystem.py       # File operations service
│   │   │   ├── thumbnails.py       # Thumbnail generation
│   │   │   └── audio.py            # Audio metadata & cover art extraction
│   │   ├── routers/
│   │   │   ├── files.py            # File API endpoints
│   │   │   └── upload.py           # Upload endpoint
│   │   └── main.py                 # FastAPI application
│   ├── config.yaml                 # Server configuration
│   └── requirements.txt            # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts           # API client functions
│   │   ├── components/
│   │   │   ├── Header.tsx          # Breadcrumbs + search
│   │   │   ├── Sidebar.tsx         # Navigation sidebar
│   │   │   ├── Toolbar.tsx         # Actions toolbar
│   │   │   ├── FileIcon.tsx        # File type icons + helpers
│   │   │   ├── FileGrid.tsx        # Grid view with hover previews
│   │   │   ├── FileList.tsx        # List view
│   │   │   ├── VideoPlayer.tsx     # Custom video player
│   │   │   ├── VideoPreview.tsx    # Video hover timeline scrubbing
│   │   │   ├── TextPreview.tsx     # Code hover preview
│   │   │   ├── PdfViewer.tsx       # PDF viewer with zoom
│   │   │   ├── UploadDropzone.tsx  # Drag-drop upload area
│   │   │   ├── UploadProgress.tsx  # Upload status with speed/ETA
│   │   │   ├── MiniPlayer.tsx      # Audio mini-player with cover art
│   │   │   ├── RenameDialog.tsx    # Rename modal
│   │   │   ├── NewFolderDialog.tsx # Create folder modal
│   │   │   ├── DeleteDialog.tsx    # Delete confirmation
│   │   │   └── ui/                 # shadcn/ui components
│   │   ├── contexts/
│   │   │   └── AudioPlayerContext.tsx  # Global audio player state
│   │   ├── hooks/
│   │   │   ├── useFileSelection.ts # Multi-select hook
│   │   │   └── useDebounce.ts      # Search debounce hook
│   │   ├── lib/
│   │   │   └── utils.ts            # Utility functions
│   │   ├── pages/
│   │   │   ├── FilesPage.tsx       # Main files page
│   │   │   └── PreviewPage.tsx     # File preview page
│   │   ├── main.tsx                # App entry point
│   │   └── index.css               # Global styles
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── tsconfig.json
├── data/
│   └── thumbnails/                 # Generated thumbnails
├── start.sh                        # Start both services
├── install.sh                      # Install as system service
├── uninstall.sh                    # Remove system service
└── README.md
```

## Quick Start

### Option 1: Install as System Service (Recommended)

Run the installation script to set up FilaMama as a systemd service that starts automatically on boot:

```bash
cd FilaMama
./install.sh
```

This will:
1. Create Python virtual environment if needed
2. Install backend dependencies
3. Install frontend dependencies
4. Build frontend for production
5. Create and enable systemd services
6. Start both services

The services will automatically start on system boot.

**Useful commands:**
```bash
sudo systemctl status filamama-backend   # Check backend status
sudo systemctl status filamama-frontend  # Check frontend status
sudo systemctl restart filamama-backend  # Restart backend
sudo systemctl restart filamama-frontend # Restart frontend
sudo journalctl -u filamama-backend -f   # View backend logs
sudo journalctl -u filamama-frontend -f  # View frontend logs
```

**To uninstall:**
```bash
./uninstall.sh
```

### Option 2: Development Mode

Use the start script for development with hot reloading:

```bash
./start.sh
```

This will:
1. Create Python virtual environment if needed
2. Install backend dependencies
3. Install frontend dependencies
4. Start both servers in development mode

Press Ctrl+C to stop.

### Option 3: Manual Setup

**Backend:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8011
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Access

### Production (systemd service)
- **Frontend:** http://spark.local:1030
- **Backend API:** http://spark.local:1031
- **API Docs:** http://spark.local:1031/docs

### Development (./start.sh)
- **Frontend:** http://spark.local:8010
- **Backend API:** http://spark.local:8011
- **API Docs:** http://spark.local:8011/docs

## Configuration

Edit `backend/config.yaml`:

```yaml
server:
  host: 0.0.0.0
  port: 8011

app:
  root_path: /home/flatstone    # Root directory for file browsing
  thumbnail_dir: ../data/thumbnails
  thumbnail_sizes:
    thumb: 150
    large: 400
  max_upload_size_mb: 1024      # Maximum upload file size
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/files/list` | List directory contents |
| GET | `/api/files/info` | Get file info |
| GET | `/api/files/download` | Download file |
| GET | `/api/files/stream` | Stream file (supports Range requests) |
| GET | `/api/files/thumbnail` | Get file thumbnail |
| GET | `/api/files/preview` | Preview file |
| GET | `/api/files/text` | Get text file content |
| GET | `/api/files/search` | Search files (recursive, with truncation info) |
| GET | `/api/files/audio-metadata` | Get audio file metadata (title, artist, album, etc.) |
| GET | `/api/files/audio-cover` | Get embedded cover art from audio file |
| GET | `/api/files/disk-usage` | Get disk usage stats |
| POST | `/api/files/mkdir` | Create directory |
| POST | `/api/files/delete` | Delete files |
| POST | `/api/files/rename` | Rename file |
| POST | `/api/files/copy` | Copy file |
| POST | `/api/files/move` | Move file |
| POST | `/api/files/check-conflicts` | Check for name conflicts |
| POST | `/api/files/download-zip` | Download as ZIP |
| POST | `/api/upload` | Upload files |
| GET | `/api/config` | Get app configuration |

## Ports

| Environment | Service | Port |
|-------------|---------|------|
| **Production** | Frontend (Vite Preview) | 1030 |
| **Production** | Backend (FastAPI) | 1031 |
| **Development** | Frontend (Vite Dev) | 8010 |
| **Development** | Backend (FastAPI) | 8011 |

This allows you to run both production and development instances simultaneously without port conflicts.

## Development

**Type checking:**
```bash
cd frontend
npx tsc --noEmit
```

**Build for production:**
```bash
cd frontend
npm run build
```

## Documentation

- **[USAGE.md](USAGE.md)** - Comprehensive user guide with instructions for all features
- **[DEVELOPER.md](DEVELOPER.md)** - Technical documentation for developers
- **[URL_STRUCTURE.md](URL_STRUCTURE.md)** - Complete URL structure and state management guide
- **[CHANGELOG.md](CHANGELOG.md)** - Version history and release notes
- **[CLAUDE.md](CLAUDE.md)** - Project memory and session notes for Claude Code
- **[INSTALLATION.md](INSTALLATION.md)** - Detailed installation and deployment guide

## License

MIT
