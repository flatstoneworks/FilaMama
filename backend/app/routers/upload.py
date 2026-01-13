from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List
import aiofiles

from ..services.filesystem import FilesystemService

router = APIRouter(prefix="/api/upload", tags=["upload"])

fs_service: FilesystemService = None


def init_services(filesystem: FilesystemService):
    global fs_service
    fs_service = filesystem


@router.post("")
async def upload_files(
    files: List[UploadFile] = File(...),
    path: str = Form("/"),
    overwrite: bool = Form(False),
):
    try:
        target_dir = fs_service.get_absolute_path(path)

        if not target_dir.exists():
            raise HTTPException(status_code=404, detail="Target directory not found")
        if not target_dir.is_dir():
            raise HTTPException(status_code=400, detail="Target is not a directory")

        uploaded = []
        errors = []

        for file in files:
            try:
                file_path = target_dir / file.filename

                if file_path.exists() and not overwrite:
                    base = file_path.stem
                    ext = file_path.suffix
                    counter = 1
                    while file_path.exists():
                        file_path = target_dir / f"{base}({counter}){ext}"
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

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
