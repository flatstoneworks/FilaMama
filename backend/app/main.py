from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
import yaml

from .routers import files, upload, trash
from .services.filesystem import FilesystemService, CONTENT_TYPES
from .services.thumbnails import ThumbnailService
from .services.audio import AudioMetadataService
from .services.transcoding import TranscodingService
from .services.trash import TrashService

import logging
import os

logger = logging.getLogger(__name__)

# --- Config loading with env var overrides ---

# Config file path: FILAMAMA_CONFIG or auto-detect dev/prod
config_path_override = os.environ.get("FILAMAMA_CONFIG")
if config_path_override:
    config_path = Path(config_path_override)
else:
    dev_mode = os.environ.get("FILAMAMA_DEV", "").lower() in ("1", "true", "yes")
    config_filename = "config.dev.yaml" if dev_mode else "config.yaml"
    config_path = Path(__file__).parent.parent / config_filename

with open(config_path) as f:
    config = yaml.safe_load(f)

# Root path override
if os.environ.get("FILAMAMA_ROOT_PATH"):
    config["root_path"] = os.environ["FILAMAMA_ROOT_PATH"]

# Server host/port overrides
if os.environ.get("FILAMAMA_HOST"):
    config["server"]["host"] = os.environ["FILAMAMA_HOST"]
if os.environ.get("FILAMAMA_PORT"):
    config["server"]["port"] = int(os.environ["FILAMAMA_PORT"])

# Data directory override — redirects thumbnail + transcoding cache paths
if os.environ.get("FILAMAMA_DATA_DIR"):
    data_dir = os.environ["FILAMAMA_DATA_DIR"]
    config["thumbnails"]["cache_dir"] = os.path.join(data_dir, "thumbnails")
    config["transcoding"]["cache_dir"] = os.path.join(data_dir, "transcoded")

# Upload limit override
if os.environ.get("FILAMAMA_MAX_UPLOAD_MB"):
    config["upload"]["max_size_mb"] = int(os.environ["FILAMAMA_MAX_UPLOAD_MB"])

# CORS origins override (comma-separated)
cors_origins_override = os.environ.get("FILAMAMA_CORS_ORIGINS")

# Frontend dist override
frontend_dist_override = os.environ.get("FILAMAMA_FRONTEND_DIST")

# --- Service initialization ---

fs_service = FilesystemService(
    root_path=config["root_path"],
    mounts=config.get("mounts", []),
)
thumb_service = ThumbnailService(
    cache_dir=config["thumbnails"]["cache_dir"],
    sizes=config["thumbnails"]["sizes"],
    quality=config["thumbnails"]["quality"],
    max_cache_size_mb=config["thumbnails"].get("max_cache_size_mb", 0),
)
audio_service = AudioMetadataService(
    root_path=Path(config["root_path"]),
)
transcode_service = TranscodingService(
    cache_dir=config["transcoding"]["cache_dir"],
    max_cache_size_mb=config["transcoding"].get("max_cache_size_mb", 2000),
    max_concurrent=config["transcoding"].get("max_concurrent", 2),
    transcode_timeout=config["transcoding"].get("transcode_timeout", 3600),
)
trash_service = TrashService(
    root_path=config["root_path"],
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("FilaMama starting...")
    logger.info("Root path: %s", config['root_path'])
    logger.info("Server: http://%s:%s", config['server']['host'], config['server']['port'])
    files.init_services(fs_service, thumb_service, audio_service, transcode_service)
    upload.init_services(fs_service, max_size_mb=config["upload"]["max_size_mb"])
    trash.init_services(trash_service)
    yield
    logger.info("FilaMama shutting down...")


app = FastAPI(
    title="FilaMama",
    description="Fast, beautiful file manager",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: use env var override or hardcoded defaults
if cors_origins_override:
    cors_origins = [o.strip() for o in cors_origins_override.split(",") if o.strip()]
else:
    cors_origins = [
        "http://spark.local:1030",   # Production frontend
        "http://spark.local:8010",   # Dev frontend
        "http://localhost:8010",     # Dev fallback
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(files.router)
app.include_router(upload.router)
app.include_router(trash.router)


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
        "content_types": CONTENT_TYPES,
    }


# Serve static frontend files in production
if frontend_dist_override:
    frontend_dist = Path(frontend_dist_override)
else:
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
