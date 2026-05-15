# AGENTS.md

This file provides guidance to Codex. For detailed file maps, API endpoints, and reference tables, see [REFERENCE.md](REFERENCE.md).

- **Repo:** github.com/flatstoneworks/FilaMama
- **Main dev:** flatstoneworks

## Project Overview

FilaMama is a fast, beautiful file manager web application. Browse, preview, and manage files from any browser. Features include grid/list views, drag-and-drop, trash, audio mini-player, video player with transcoding, PDF viewer, code preview with syntax highlighting, recursive search (filename + content via ripgrep), content type filters, favorites, keyboard navigation, mount points, and parallel uploads. Single-process deployment — the backend serves both the API and the frontend.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, TanStack Query, Tailwind CSS, shadcn/ui, React Router (dev: 8010, prod: 1031)
- **Backend:** FastAPI, Python 3.12, Pydantic, Pillow, mutagen, CairoSVG (dev: 8011, prod: 1031)
- **System:** FFmpeg (transcoding), ripgrep (content search), libmagic (MIME detection)
- **Packaging:** Docker, systemd, launchd, install script
- **URLs:** http://spark.local:8010 (dev) | http://spark.local:1031 (prod) | `/docs` (Swagger)

## Development Commands

```bash
./start.sh                            # Backend (8011) + frontend dev (8010) with hot reload
cd frontend && npx tsc --noEmit       # TypeScript check
cd frontend && npm run build          # Production build
cd backend && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8011 --reload
docker compose up                     # Docker (port 1031)
./install-filamama.sh                 # Interactive install (systemd/launchd)
```

## Architecture (high-level)

Single-process FastAPI server serves both API and built frontend. Data stored on filesystem — no database. Trash uses manifest JSON with file-based locking.

```
backend/app/
  routers/     — API endpoints (files, upload, trash)
  services/    — Business logic (filesystem, thumbnails, audio, transcoding, trash)
  models/      — Pydantic schemas
  utils/       — Error handling decorators
backend/
  config.yaml       — Server config (root path, mounts, thumbnails, transcoding, upload)
  config.docker.yaml — Docker defaults
  config.dev.yaml   — Development defaults

frontend/src/
  pages/       — FilesPage (browser), PreviewPage (file viewer)
  components/  — 24 components (Header, Sidebar, Toolbar, FileGrid, FileList, VideoPlayer, MiniPlayer, PdfViewer, etc.)
  hooks/       — 9 hooks (selection, clipboard, upload, navigation, keyboard, drag-drop, favorites, scroll, debounce)
  contexts/    — AudioPlayerContext (global player state)
  api/         — Typed API client
  lib/         — Utility functions

templates/     — Service templates (systemd, launchd, config wizard)
tests/         — Playwright (frontend) + Pytest (backend)
```

## Key Patterns

- **Single-process prod** — FastAPI serves API at `/api/*` and static frontend from `frontend/dist/`
- **Async I/O** — File operations use `asyncio.to_thread` for non-blocking access
- **Path security** — All operations validate resolved paths stay within root; traversal attempts rejected
- **Trash manifest** — `.deleted_items/.manifest.json` tracks original paths; file-based locking for concurrency
- **Audio mini-player** — Global context persists across pages; plays all audio in current folder as playlist
- **Video transcoding** — FFmpeg streams non-native formats (.avi, .wmv, .flv) in real-time
- **Content search** — ripgrep subprocess for searching inside text/code files
- **Thumbnail pipeline** — Pillow (images), FFmpeg (video frames), CairoSVG (SVG rasterization)
- **CSS variable** — `--sidebar-width: 13rem` shared across Sidebar, MiniPlayer, keyboard navigation
- **Env var overrides** — 7 `FILAMAMA_*` env vars override config.yaml without editing it
- **CamelModel** — snake_case in Python, camelCase in JSON responses
