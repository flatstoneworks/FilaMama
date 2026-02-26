# FilaMama

A fast, beautiful file manager web application. Browse, preview, and manage your files from any browser.

Built with React + FastAPI. Single-process deployment — the backend serves both the API and the frontend.

- **Repo:** [github.com/flatstoneworks/FilaMama](https://github.com/flatstoneworks/FilaMama)

For detailed file maps, API endpoints, and configuration reference, see [REFERENCE.md](REFERENCE.md).

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

The script installs system dependencies, creates a Python venv, builds the frontend, runs an interactive config wizard, and sets up a systemd (Linux) or launchd (macOS) service.

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

All config values can be overridden via environment variables (`FILAMAMA_ROOT_PATH`, `FILAMAMA_PORT`, etc.). See [REFERENCE.md](REFERENCE.md) for the full list.

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
| `Space` | Toggle selection / Play-pause audio |
| `?` | Show shortcuts help |

See [REFERENCE.md](REFERENCE.md) for video player and audio mini-player shortcuts.

## API

Interactive API docs available at `/docs` (Swagger UI). See [REFERENCE.md](REFERENCE.md) for the full endpoint list.

## Tech Stack

| Layer | Technology |
|-------|-----------:|
| Frontend | React 18, TypeScript, Vite, TanStack Query, Tailwind CSS, shadcn/ui |
| Backend | FastAPI, Python 3.12, Pydantic, Pillow, mutagen, CairoSVG |
| System | FFmpeg (transcoding), ripgrep (content search), libmagic (MIME detection) |
| Packaging | Docker, systemd, launchd |

## Development

```bash
cd frontend && npx tsc --noEmit    # Type checking
cd frontend && npm run build       # Production build
cd backend && source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8011 --reload
```

## License

MIT
