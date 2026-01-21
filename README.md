# FilaMama

A fast, beautiful file manager web application built with React and FastAPI.

## Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite (dev server & build)
- TanStack Query (data fetching)
- Tailwind CSS + shadcn/ui (styling)
- Radix UI (accessible components)
- Lucide React (icons)

**Backend:**
- FastAPI (Python)
- Pydantic (validation)
- python-magic (MIME detection)
- Pillow (image thumbnails)
- aiofiles (async file I/O)

## Features

### File Management
- **Grid & List Views** - Toggle between views with adjustable thumbnail size slider
- **Breadcrumb Navigation** - Click any path segment to navigate
- **File Operations** - Copy, cut, paste, rename, delete, move, create folder
- **Drag & Drop Upload** - Upload files/folders by dragging onto the browser
- **Drag & Drop Moving** - Drag files/folders onto folders to move them
- **Upload Progress** - Track multiple uploads with progress indicators
- **Context Menu** - Right-click for quick actions
- **Multi-Selection** - Click checkboxes or Ctrl/Cmd+Click to select multiple files

### Preview & Viewing
- **File Preview** - View images, videos, audio, PDFs, and text files
- **PDF Viewer** - Custom PDF viewer with page navigation, zoom controls, and text selection
- **Thumbnails** - Auto-generated thumbnails for images and videos
- **Search** - Filter files by name
- **Content Type Filters** - Quick filters for Photos, Videos, GIFs, PDFs, Audio

### Keyboard Shortcuts
- **Ctrl/Cmd + A** - Select all files
- **Ctrl/Cmd + C/X/V** - Copy, cut, paste operations
- **Delete** - Delete selected files
- **Enter** - Open selected file/folder
- **Escape** - Clear selection and search
- **F2** - Rename selected file
- **Backspace** - Navigate to parent directory
- **Arrow Keys** - Navigate in preview modal

## Project Structure

```
FilaMama/
├── backend/
│   ├── app/
│   │   ├── models/
│   │   │   └── schemas.py          # Pydantic models
│   │   ├── services/
│   │   │   ├── filesystem.py       # File operations service
│   │   │   └── thumbnails.py       # Thumbnail generation
│   │   ├── routers/
│   │   │   ├── files.py            # File API endpoints
│   │   │   └── upload.py           # Upload endpoint
│   │   └── main.py                 # FastAPI application
│   ├── config.yaml                 # Server configuration
│   ├── requirements.txt            # Python dependencies
│   └── venv/                       # Python virtual environment
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts           # API client functions
│   │   ├── components/
│   │   │   ├── Breadcrumbs.tsx     # Path navigation
│   │   │   ├── Toolbar.tsx         # Actions toolbar
│   │   │   ├── FileIcon.tsx        # File type icons
│   │   │   ├── FileGrid.tsx        # Grid view
│   │   │   ├── FileList.tsx        # List view
│   │   │   ├── RenameDialog.tsx    # Rename modal
│   │   │   ├── NewFolderDialog.tsx # Create folder modal
│   │   │   ├── DeleteDialog.tsx    # Delete confirmation
│   │   │   ├── UploadDropzone.tsx  # Drag-drop upload area
│   │   │   ├── UploadProgress.tsx  # Upload status panel
│   │   │   ├── PreviewModal.tsx    # File preview
│   │   │   ├── Layout.tsx          # App layout
│   │   │   └── ui/                 # shadcn/ui components
│   │   ├── hooks/
│   │   │   └── useFileSelection.ts # Multi-select hook
│   │   ├── lib/
│   │   │   └── utils.ts            # Utility functions
│   │   ├── pages/
│   │   │   └── FilesPage.tsx       # Main files page
│   │   ├── main.tsx                # App entry point
│   │   └── index.css               # Global styles
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── tsconfig.json
├── data/
│   ├── files/                      # Managed files (optional)
│   └── thumbnails/                 # Generated thumbnails
├── start.sh                        # Start both services
├── ports.json                      # Port configuration
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
  port: 8002

app:
  root_path: /home/flatstone    # Root directory for file browsing
  thumbnail_dir: ../data/thumbnails
  thumbnail_sizes:
    thumb: 150
    large: 400
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/files/list` | List directory contents |
| GET | `/api/files/info` | Get file info |
| GET | `/api/files/download` | Download file |
| GET | `/api/files/thumbnail` | Get file thumbnail |
| GET | `/api/files/preview` | Preview file |
| GET | `/api/files/text` | Get text file content |
| GET | `/api/files/search` | Search files |
| GET | `/api/files/disk-usage` | Get disk usage stats |
| POST | `/api/files/mkdir` | Create directory |
| POST | `/api/files/delete` | Delete files |
| POST | `/api/files/rename` | Rename file |
| POST | `/api/files/copy` | Copy file |
| POST | `/api/files/move` | Move file |
| POST | `/api/files/download-zip` | Download as ZIP |
| POST | `/api/upload` | Upload files |

## Ports

| Environment | Service | Port |
|-------------|---------|------|
| **Production** | Frontend (Vite Preview) | 1030 |
| **Production** | Backend (FastAPI) | 1031 |
| **Development** | Frontend (Vite Dev) | 8010 |
| **Development** | Backend (FastAPI) | 8011 |

This allows you to run both production and development instances simultaneously without port conflicts.

See `ports.json` for port allocation details.

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
- **[PDF_VIEWER_GUIDE.md](PDF_VIEWER_GUIDE.md)** - PDF viewer implementation options

## License

MIT
