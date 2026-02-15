# FilaMama

A fast, beautiful file manager web application. Browse, preview, and manage your files from any browser.

Built with React + FastAPI. Single-process deployment — the backend serves both the API and the frontend.

## Features

- **Grid & List views** with adjustable thumbnail sizes
- **File operations** — copy, cut, paste, rename, delete, move, create folder
- **Drag & drop** — upload files/folders, move files between folders
- **Trash** — soft-delete with restore, permanent delete, empty trash
- **Audio mini-player** — Spotify-style player with playlist, shuffle, repeat, cover art, and metadata (MP3, FLAC, OGG, M4A, WAV, WMA, OPUS)
- **Video player** — custom controls, keyboard shortcuts, timeline scrub preview on hover
- **Video transcoding** — FFmpeg streaming for non-native formats (.avi, .wmv, .flv, etc.)
- **Code preview** — syntax highlighting for 50+ languages, hover preview in grid
- **PDF viewer** — page navigation, zoom (50%-300%)
- **Search** — recursive filename search with debounce, file content search (ripgrep)
- **Content filters** — quick sidebar filters for Photos, Videos, GIFs, PDFs, Audio
- **Favorites** — right-click folders to bookmark them
- **Keyboard navigation** — full arrow key nav, selection, shortcuts (press `?` for help)
- **Mount points** — access directories outside the root path
- **Parallel uploads** — 3 concurrent with speed, ETA, retry

## Quick Start

### Option 1: Docker (easiest)

```bash
git clone https://github.com/flatstoneworks/FilaMama.git
cd FilaMama
docker compose up
```

Browse your home directory at `http://localhost:1031`

To browse a different directory:

```bash
BROWSE_PATH=/path/to/files docker compose up
```

### Option 2: Install Script (Linux & macOS)

```bash
git clone https://github.com/flatstoneworks/FilaMama.git
cd FilaMama
./install-filamama.sh
```

The script will:
1. Install system dependencies (ffmpeg, ripgrep, libmagic, cairo, python3, node)
2. Create Python venv and install pip dependencies
3. Build the frontend
4. Run an interactive config wizard (root path, port, upload limit)
5. Set up a systemd (Linux) or launchd (macOS) service

After install:

```bash
./install-filamama.sh --status     # Check service status
./install-filamama.sh --update     # Pull latest + rebuild + restart
./install-filamama.sh --configure  # Re-run config wizard
./install-filamama.sh --uninstall  # Remove service
```

### Option 3: Development Mode

```bash
./start.sh
```

Starts backend (port 8011) and frontend dev server (port 8010) with hot reloading.

## Configuration

### Config file

Edit `backend/config.yaml`:

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

### Environment variables

All optional — override `config.yaml` without editing it:

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

## Keyboard Shortcuts

Press `?` in the file browser to see all shortcuts.

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + A` | Select all |
| `Ctrl/Cmd + C/X/V` | Copy / Cut / Paste |
| `Delete` | Move to trash |
| `Enter` | Open file/folder |
| `F2` | Rename |
| `Backspace` | Go to parent |
| `Arrow keys` | Navigate files |
| `Shift + Arrow` | Extend selection |
| `Space` | Toggle selection / Play-pause audio |
| `Shift + ←/→` | Previous/next track |
| `M` | Mute/unmute |

## API

Interactive API docs available at `/docs` (Swagger UI).

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/files/list` | List directory contents |
| GET | `/api/files/download` | Download file |
| GET | `/api/files/stream` | Stream file (Range support) |
| GET | `/api/files/thumbnail` | Get thumbnail |
| GET | `/api/files/search` | Recursive filename search |
| GET | `/api/files/search-content` | Search inside files (ripgrep) |
| GET | `/api/files/audio-metadata` | Audio metadata (ID3, Vorbis) |
| GET | `/api/files/audio-cover` | Embedded cover art |
| GET | `/api/files/transcode-stream` | FFmpeg transcode stream |
| POST | `/api/files/mkdir` | Create directory |
| POST | `/api/files/rename` | Rename file |
| POST | `/api/files/copy` | Copy files |
| POST | `/api/files/move` | Move files |
| POST | `/api/files/download-zip` | Download as ZIP (4GB limit) |
| POST | `/api/files/check-conflicts` | Check paste conflicts |
| POST | `/api/upload` | Upload files |
| POST | `/api/trash/move-to-trash` | Soft delete |
| GET | `/api/trash/list` | List trash contents |
| POST | `/api/trash/restore` | Restore from trash |
| POST | `/api/trash/delete-permanent` | Permanent delete |
| POST | `/api/trash/empty` | Empty trash |
| GET | `/api/health` | Health check |
| GET | `/api/config` | App configuration |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, TanStack Query, Tailwind CSS, shadcn/ui |
| Backend | FastAPI, Python 3.12, Pydantic, Pillow, mutagen, CairoSVG |
| System | FFmpeg (transcoding), ripgrep (content search), libmagic (MIME detection) |
| Packaging | Docker, systemd, launchd |

## Project Structure

```
FilaMama/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app, config, env var overrides
│   │   ├── routers/
│   │   │   ├── files.py            # File operations API
│   │   │   ├── upload.py           # Upload API
│   │   │   └── trash.py            # Trash API
│   │   ├── services/
│   │   │   ├── filesystem.py       # File operations, search
│   │   │   ├── thumbnails.py       # Thumbnail generation
│   │   │   ├── audio.py            # Audio metadata & cover art
│   │   │   ├── transcoding.py      # FFmpeg video transcoding
│   │   │   └── trash.py            # Trash with manifest tracking
│   │   └── models/
│   │       └── schemas.py          # Pydantic models
│   ├── config.yaml                 # Server configuration
│   ├── config.docker.yaml          # Docker defaults
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/                  # FilesPage, PreviewPage
│   │   ├── components/             # UI components
│   │   ├── hooks/                  # Custom hooks (selection, clipboard, upload, etc.)
│   │   ├── contexts/               # AudioPlayerContext
│   │   └── api/client.ts           # API client
│   ├── package.json
│   └── vite.config.ts
├── templates/                      # Service templates (systemd, launchd, config)
├── Dockerfile                      # Multi-stage Docker build
├── docker-compose.yml
├── install-filamama.sh             # Smart install script
└── start.sh                        # Development start script
```

## Development

```bash
# Type checking
cd frontend && npx tsc --noEmit

# Production build
cd frontend && npm run build

# Run backend directly
cd backend && source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8011 --reload
```

## License

MIT
