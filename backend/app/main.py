from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
import yaml

from .routers import files, upload
from .services.filesystem import FilesystemService
from .services.thumbnails import ThumbnailService

import os

# Use dev config if FILAMAMA_DEV environment variable is set
dev_mode = os.environ.get("FILAMAMA_DEV", "").lower() in ("1", "true", "yes")
config_filename = "config.dev.yaml" if dev_mode else "config.yaml"
config_path = Path(__file__).parent.parent / config_filename
with open(config_path) as f:
    config = yaml.safe_load(f)

fs_service = FilesystemService(
    root_path=config["root_path"],
    mounts=config.get("mounts", []),
)
thumb_service = ThumbnailService(
    cache_dir=config["thumbnails"]["cache_dir"],
    sizes=config["thumbnails"]["sizes"],
    quality=config["thumbnails"]["quality"],
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"FilaMama starting...")
    print(f"Root path: {config['root_path']}")
    print(f"Server: http://{config['server']['host']}:{config['server']['port']}")
    files.init_services(fs_service, thumb_service)
    upload.init_services(fs_service)
    yield
    print("FilaMama shutting down...")


app = FastAPI(
    title="FilaMama",
    description="Fast, beautiful file manager",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(files.router)
app.include_router(upload.router)


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "FilaMama"}


@app.get("/api/config")
async def get_config():
    return {
        "root_path": config["root_path"],
        "thumbnails_enabled": config["thumbnails"]["enabled"],
        "max_upload_size_mb": config["upload"]["max_size_mb"],
        "file_types": config["file_types"],
        "mounts": config.get("mounts", []),
    }


# Serve static frontend files in production
frontend_dist = Path(__file__).parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    # Serve static assets
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")

    # Serve favicon/static files at root
    @app.get("/folder.svg")
    async def serve_favicon():
        return FileResponse(frontend_dist / "folder.svg")

    # Catch-all route for SPA - must be last
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Serve index.html for all non-API routes (SPA routing)
        return FileResponse(frontend_dist / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=config["server"]["host"],
        port=config["server"]["port"],
        reload=True,
    )
