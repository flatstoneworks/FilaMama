from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from pathlib import Path
import base64
import binascii
import secrets
import yaml

from .routers import files, upload, trash, system, agent
from .services.filesystem import FilesystemService, CONTENT_TYPES
from .services.thumbnails import ThumbnailService
from .services.audio import AudioMetadataService
from .services.content_search import ContentSearchService
from .services.transcoding import TranscodingService
from .services.trash import TrashService
from .services.agent import AgentService

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


def _expand_path(value: str) -> str:
    return str(Path(os.path.expandvars(os.path.expanduser(value))).resolve())

# Root path override
if os.environ.get("FILAMAMA_ROOT_PATH"):
    config["root_path"] = os.environ["FILAMAMA_ROOT_PATH"]
config["root_path"] = _expand_path(config["root_path"])

for mount in config.get("mounts", []):
    mount["path"] = _expand_path(mount["path"])

# Server host/port overrides
if os.environ.get("FILAMAMA_HOST"):
    config["server"]["host"] = os.environ["FILAMAMA_HOST"]
if os.environ.get("FILAMAMA_PORT"):
    port_val = int(os.environ["FILAMAMA_PORT"])
    if not (1 <= port_val <= 65535):
        raise ValueError(f"FILAMAMA_PORT must be 1-65535, got {port_val}")
    config["server"]["port"] = port_val

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
auth_user = os.environ.get("FILAMAMA_AUTH_USER")
auth_password = os.environ.get("FILAMAMA_AUTH_PASSWORD")
allow_insecure = dev_mode or os.environ.get("FILAMAMA_ALLOW_INSECURE", "").lower() in ("1", "true", "yes")


def _is_loopback_host(host: str) -> bool:
    normalized = host.strip().lower()
    return normalized in {"127.0.0.1", "localhost", "::1"}


class BasicAuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, username: str, password: str):
        super().__init__(app)
        self.username = username
        self.password = password

    async def dispatch(self, request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)

        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Basic "):
            token = auth_header[6:]
            try:
                decoded = base64.b64decode(token).decode("utf-8")
                username, password = decoded.split(":", 1)
            except (binascii.Error, UnicodeDecodeError, ValueError):
                username, password = "", ""

            if secrets.compare_digest(username, self.username) and secrets.compare_digest(password, self.password):
                return await call_next(request)

        return Response(
            status_code=401,
            headers={"WWW-Authenticate": 'Basic realm="FilaMama"'},
        )

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
    filesystem_service=fs_service,
)
content_search_service = ContentSearchService(fs_service)
agent_service = AgentService(fs_service, trash_service)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("FilaMama starting...")
    logger.info("Root path: %s", config['root_path'])
    logger.info("Server: http://%s:%s", config['server']['host'], config['server']['port'])
    files.init_services(
        fs_service, thumb_service, audio_service, transcode_service, content_search_service, agent_service
    )
    upload.init_services(fs_service, max_size_mb=config["upload"]["max_size_mb"], agent=agent_service)
    trash.init_services(trash_service, agent=agent_service)
    agent.init_services(agent_service, max_size_mb=config["upload"]["max_size_mb"])
    system.init_services(
        root_path=config["root_path"],
        thumb_cache_dir=config["thumbnails"]["cache_dir"],
        transcode_cache_dir=config["transcoding"]["cache_dir"],
    )
    yield
    logger.info("FilaMama shutting down...")


app = FastAPI(
    title="FilaMama",
    description="Fast, beautiful file manager",
    version="1.0.0",
    lifespan=lifespan,
)

if bool(auth_user) != bool(auth_password):
    raise RuntimeError("Set both FILAMAMA_AUTH_USER and FILAMAMA_AUTH_PASSWORD, or neither.")

if not auth_user and not allow_insecure and not _is_loopback_host(config["server"]["host"]):
    raise RuntimeError(
        "Refusing insecure network-exposed startup without authentication. "
        "Set FILAMAMA_AUTH_USER and FILAMAMA_AUTH_PASSWORD, or FILAMAMA_ALLOW_INSECURE=true."
    )

# CORS: use env var override or hardcoded defaults
if cors_origins_override:
    cors_origins = [o.strip() for o in cors_origins_override.split(",") if o.strip()]
else:
    port = config["server"]["port"]
    cors_origins = [
        f"http://spark.local:{port}",  # Self-origin (unified service)
        "http://spark.local:1030",     # Production frontend
        "http://spark.local:5030",     # Dev frontend
        "http://localhost:5030",       # Dev fallback
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if auth_user and auth_password:
    app.add_middleware(BasicAuthMiddleware, username=auth_user, password=auth_password)

app.include_router(files.router)
app.include_router(upload.router)
app.include_router(trash.router)
app.include_router(system.router)
app.include_router(agent.router)


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
