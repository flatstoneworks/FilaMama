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

- **Grid & List Views** - Toggle between views with adjustable thumbnail size slider
- **Breadcrumb Navigation** - Click any path segment to navigate
- **File Operations** - Copy, cut, paste, rename, delete, create folder
- **Drag & Drop Upload** - Upload files by dragging onto the browser
- **Upload Progress** - Track multiple uploads with progress indicators
- **Context Menu** - Right-click for quick actions
- **File Preview** - View images, videos, audio, PDFs, and text files
- **Thumbnails** - Auto-generated thumbnails for images and videos
- **Search** - Filter files by name
- **Keyboard Navigation** - Arrow keys in preview modal

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

### Using the start script

```bash
cd FilaMama
./start.sh
```

This will:
1. Create Python virtual environment if needed
2. Install backend dependencies
3. Install frontend dependencies
4. Start both servers

### Manual Setup

**Backend:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8002
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Access

- **Frontend:** http://spark.local:5175
- **Backend API:** http://spark.local:8002
- **API Docs:** http://spark.local:8002/docs

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

| Service | Port |
|---------|------|
| Frontend (Vite) | 5175 |
| Backend (FastAPI) | 8002 |

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

## License

MIT
