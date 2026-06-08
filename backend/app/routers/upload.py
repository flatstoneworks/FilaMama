import logging

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request
from typing import List, Optional
import aiofiles
from pathlib import Path, PurePosixPath

logger = logging.getLogger(__name__)

from ..services.filesystem import FilesystemService, RESERVED_AGENT_DIR
from ..services.agent import AgentService
from ..models.schemas import Actor, ActorType
from ..utils.actor import build_actor
from ..utils.error_handlers import handle_fs_errors
from ..utils.paths import generate_unique_path

router = APIRouter(prefix="/api/upload", tags=["upload"])

# Per-request limits to bound disk/inode/directory-depth abuse.
MAX_UPLOAD_FILES = 1000
MAX_UPLOAD_PATH_DEPTH = 50

fs_service: FilesystemService = None
agent_service: AgentService = None
max_upload_bytes: int = 0


def init_services(filesystem: FilesystemService, max_size_mb: int = 10240, agent: AgentService = None):
    global fs_service, max_upload_bytes, agent_service
    fs_service = filesystem
    max_upload_bytes = max_size_mb * 1024 * 1024
    agent_service = agent


def _actor_from_request(request: Request) -> Actor:
    # Actor type is authoritative from the agent token, not a spoofable header.
    return build_actor(
        agent_token=request.headers.get("X-FilaMama-Agent-Token"),
        actor_id=request.headers.get("X-FilaMama-Actor-Id"),
        actor_name=request.headers.get("X-FilaMama-Actor-Name"),
    )


def _safe_relative_upload_path(relative_path: str) -> Path:
    normalized = relative_path.replace("\\", "/")
    candidate = PurePosixPath(normalized)
    parts = tuple(part for part in candidate.parts if part not in ("", "."))

    if candidate.is_absolute() or not parts or any(part == ".." for part in parts):
        raise HTTPException(status_code=400, detail=f"Invalid relative path: {relative_path}")

    if len(parts) > MAX_UPLOAD_PATH_DEPTH:
        raise HTTPException(status_code=400, detail=f"Relative path too deep: {relative_path}")

    if RESERVED_AGENT_DIR in parts:
        raise HTTPException(
            status_code=403,
            detail=f"Access denied: {RESERVED_AGENT_DIR} is reserved for FilaMama metadata",
        )

    return Path(*parts)


async def _audit(request: Request, paths: list[str], uploaded_count: int, failed_count: int):
    if agent_service is None:
        return
    try:
        await agent_service.record_activity(
            _actor_from_request(request),
            "file.upload",
            paths,
            f"Uploaded {uploaded_count} file(s)",
            {"uploaded": uploaded_count, "failed": failed_count},
        )
    except Exception:
        pass


@router.post("")
@handle_fs_errors
async def upload_files(
    request: Request,
    files: List[UploadFile] = File(...),
    path: str = Form("/"),
    overwrite: bool = Form(False),
    relative_paths: Optional[List[str]] = Form(None),
):
    if fs_service is None:
        raise HTTPException(status_code=503, detail="Upload service not initialized")
    if len(files) > MAX_UPLOAD_FILES:
        raise HTTPException(
            status_code=413,
            detail=f"Too many files in one request (max {MAX_UPLOAD_FILES})",
        )
    logger.debug("Upload: path=%s, relative_paths=%s, files=%s", path, relative_paths, [f.filename for f in files])
    target_dir = fs_service.get_absolute_path(path)

    if not target_dir.exists():
        raise HTTPException(status_code=404, detail="Target directory not found")
    if not target_dir.is_dir():
        raise HTTPException(status_code=400, detail="Target is not a directory")

    uploaded = []
    errors = []

    for i, file in enumerate(files):
        try:
            rel_path = relative_paths[i] if relative_paths and i < len(relative_paths) else None
            logger.debug("Processing file %d: %s, rel_path=%s", i, file.filename, rel_path)

            if rel_path:
                relative_file_path = _safe_relative_upload_path(rel_path)
                file_path = (target_dir / relative_file_path).resolve()
                if not fs_service._is_within_path(file_path, target_dir.resolve()):
                    raise HTTPException(status_code=400, detail=f"Path traversal detected: {rel_path}")
                file_path.parent.mkdir(parents=True, exist_ok=True)
            else:
                # Regular file upload - sanitize filename
                safe_name = Path(file.filename).name  # Strip any directory components
                if not safe_name or safe_name in ('.', '..'):
                    raise HTTPException(status_code=400, detail=f"Invalid filename: {file.filename}")
                if safe_name == RESERVED_AGENT_DIR:
                    raise HTTPException(
                        status_code=403,
                        detail=f"Access denied: {RESERVED_AGENT_DIR} is reserved for FilaMama metadata",
                    )
                file_path = (target_dir / safe_name).resolve()
                if not fs_service._is_within_path(file_path, target_dir.resolve()):
                    raise HTTPException(status_code=400, detail=f"Invalid filename: {file.filename}")

            if file_path.exists() and not overwrite:
                file_path = generate_unique_path(file_path)

            async with aiofiles.open(file_path, 'wb') as f:
                bytes_written = 0
                while chunk := await file.read(1024 * 1024):
                    bytes_written += len(chunk)
                    if max_upload_bytes and bytes_written > max_upload_bytes:
                        await f.close()
                        file_path.unlink(missing_ok=True)
                        raise HTTPException(
                            status_code=413,
                            detail=f"File exceeds maximum upload size ({max_upload_bytes // (1024*1024)}MB)",
                        )
                    await f.write(chunk)

            uploaded.append({
                "name": file_path.name,
                "path": fs_service.get_relative_path(file_path),
                "size": file_path.stat().st_size,
            })
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("Unexpected error uploading file %s", file.filename)
            errors.append({"name": file.filename, "error": str(e)})

    await _audit(request, [item["path"] for item in uploaded], len(uploaded), len(errors))

    return {
        "uploaded": uploaded,
        "errors": errors,
        "total": len(files),
        "success": len(uploaded),
        "failed": len(errors),
    }
