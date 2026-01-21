from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List, Optional
import aiofiles
from pathlib import Path

from ..services.filesystem import FilesystemService
from ..utils.error_handlers import handle_fs_errors

router = APIRouter(prefix="/api/upload", tags=["upload"])

fs_service: FilesystemService = None


def init_services(filesystem: FilesystemService):
    global fs_service
    fs_service = filesystem


@router.post("")
@handle_fs_errors
async def upload_files(
    files: List[UploadFile] = File(...),
    path: str = Form("/"),
    overwrite: bool = Form(False),
    relative_paths: Optional[str] = Form(None),
):
    print(f"[UPLOAD] path={path}, relative_paths={relative_paths}, files={[f.filename for f in files]}")
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
            print(f"[UPLOAD] Processing file {i}: {file.filename}, rel_path={rel_path}")

            if rel_path:
                # Folder upload: use the relative path to preserve structure
                file_path = target_dir / rel_path
                # Create parent directories if they don't exist
                file_path.parent.mkdir(parents=True, exist_ok=True)
            else:
                # Regular file upload
                file_path = target_dir / file.filename

            if file_path.exists() and not overwrite:
                base = file_path.stem
                ext = file_path.suffix
                parent = file_path.parent
                counter = 1
                while file_path.exists():
                    file_path = parent / f"{base}({counter}){ext}"
                    counter += 1

            async with aiofiles.open(file_path, 'wb') as f:
                while chunk := await file.read(1024 * 1024):
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
