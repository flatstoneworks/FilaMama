import logging

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List, Optional
import aiofiles
from pathlib import Path

logger = logging.getLogger(__name__)

from ..services.filesystem import FilesystemService
from ..utils.error_handlers import handle_fs_errors

router = APIRouter(prefix="/api/upload", tags=["upload"])

fs_service: FilesystemService = None
max_upload_bytes: int = 0


def init_services(filesystem: FilesystemService, max_size_mb: int = 10240):
    global fs_service, max_upload_bytes
    fs_service = filesystem
    max_upload_bytes = max_size_mb * 1024 * 1024


@router.post("")
@handle_fs_errors
async def upload_files(
    files: List[UploadFile] = File(...),
    path: str = Form("/"),
    overwrite: bool = Form(False),
    relative_paths: Optional[str] = Form(None),
):
    if fs_service is None:
        raise HTTPException(status_code=503, detail="Upload service not initialized")
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
            # Check if we have a relative path for this file (folder upload)
            # Since we upload one file at a time, relative_paths is a single string
            rel_path = relative_paths if relative_paths and i == 0 else None
            logger.debug("Processing file %d: %s, rel_path=%s", i, file.filename, rel_path)

            if rel_path:
                # Folder upload: use the relative path to preserve structure
                # Sanitize: reject path traversal attempts
                if '..' in rel_path.split('/') or '..' in rel_path.split('\\'):
                    raise HTTPException(status_code=400, detail=f"Invalid relative path: {rel_path}")
                file_path = (target_dir / rel_path).resolve()
                if not str(file_path).startswith(str(target_dir.resolve())):
                    raise HTTPException(status_code=400, detail=f"Path traversal detected: {rel_path}")
                # Create parent directories if they don't exist
                file_path.parent.mkdir(parents=True, exist_ok=True)
            else:
                # Regular file upload - sanitize filename
                safe_name = Path(file.filename).name  # Strip any directory components
                if not safe_name or safe_name in ('.', '..'):
                    raise HTTPException(status_code=400, detail=f"Invalid filename: {file.filename}")
                file_path = (target_dir / safe_name).resolve()
                if not str(file_path).startswith(str(target_dir.resolve())):
                    raise HTTPException(status_code=400, detail=f"Invalid filename: {file.filename}")

            if file_path.exists() and not overwrite:
                base = file_path.stem
                ext = file_path.suffix
                parent = file_path.parent
                counter = 1
                while file_path.exists():
                    file_path = parent / f"{base}({counter}){ext}"
                    counter += 1

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
                "path": str(file_path.relative_to(fs_service.root_path)),
                "size": file_path.stat().st_size,
            })
        except Exception as e:
            errors.append({"name": file.filename, "error": str(e)})

    return {
        "uploaded": uploaded,
        "errors": errors,
        "total": len(files),
        "success": len(uploaded),
        "failed": len(errors),
    }
