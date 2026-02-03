from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse, StreamingResponse, Response
from typing import List
import zipfile
import io
import os
import aiofiles

from ..models.schemas import (
    FileInfo, DirectoryListing, DiskUsage, SortField, SortOrder,
    RenameRequest, DeleteRequest, CreateDirectoryRequest, FileOperation,
    DeleteResponse, TextFileContent, OperationSuccess,
)
from ..services.filesystem import FilesystemService
from ..services.thumbnails import ThumbnailService
from ..utils.error_handlers import handle_fs_errors

router = APIRouter(prefix="/api/files", tags=["files"])

fs_service: FilesystemService = None
thumb_service: ThumbnailService = None


def init_services(filesystem: FilesystemService, thumbnails: ThumbnailService):
    global fs_service, thumb_service
    fs_service = filesystem
    thumb_service = thumbnails


@router.get("/list", response_model=DirectoryListing)
@handle_fs_errors
async def list_directory(
    path: str = "/",
    sort_by: SortField = SortField.NAME,
    sort_order: SortOrder = SortOrder.ASC,
    show_hidden: bool = False,
):
    return await fs_service.list_directory(path, sort_by, sort_order, show_hidden)


@router.get("/info", response_model=FileInfo)
@handle_fs_errors
async def get_file_info(path: str):
    return await fs_service.get_file_info(path)


@router.post("/mkdir", response_model=FileInfo)
@handle_fs_errors
async def create_directory(request: CreateDirectoryRequest):
    return await fs_service.create_directory(request.path, request.name)


@router.post("/delete", response_model=DeleteResponse)
@handle_fs_errors
async def delete_files(request: DeleteRequest):
    count = await fs_service.delete(request.paths)
    return DeleteResponse(deleted=count)


@router.post("/rename", response_model=FileInfo)
@handle_fs_errors
async def rename_file(request: RenameRequest):
    return await fs_service.rename(request.path, request.new_name)


@router.post("/copy", response_model=FileInfo)
@handle_fs_errors
async def copy_file(request: FileOperation):
    return await fs_service.copy(request.source, request.destination)


@router.post("/move", response_model=FileInfo)
@handle_fs_errors
async def move_file(request: FileOperation):
    return await fs_service.move(request.source, request.destination)


@router.get("/search")
async def search_files(query: str, path: str = "/", max_results: int = Query(100, le=500)):
    async def generate():
        yield "["
        first = True
        async for result in fs_service.search(query, path, max_results):
            if not first:
                yield ","
            first = False
            yield result.model_dump_json()
        yield "]"
    return StreamingResponse(generate(), media_type="application/json")


@router.get("/disk-usage", response_model=DiskUsage)
@handle_fs_errors
async def get_disk_usage(path: str = "/"):
    return await fs_service.get_disk_usage(path)


@router.get("/download")
@handle_fs_errors
async def download_file(path: str):
    file_path = fs_service.get_absolute_path(path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if file_path.is_dir():
        raise HTTPException(status_code=400, detail="Cannot download directory directly")
    return FileResponse(file_path, filename=file_path.name, media_type="application/octet-stream")


@router.post("/download-zip")
async def download_zip(paths: List[str]):
    def generate_zip():
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            for path in paths:
                try:
                    file_path = fs_service.get_absolute_path(path)
                    if not file_path.exists():
                        continue
                    if file_path.is_file():
                        zf.write(file_path, file_path.name)
                    else:
                        for root, dirs, files in file_path.walk():
                            dirs[:] = [d for d in dirs if not d.startswith('.')]
                            for file in files:
                                if file.startswith('.'):
                                    continue
                                full_path = root / file
                                arcname = str(full_path.relative_to(file_path.parent))
                                zf.write(full_path, arcname)
                except (ValueError, PermissionError):
                    continue
        buffer.seek(0)
        return buffer.getvalue()

    try:
        zip_content = generate_zip()
        return StreamingResponse(
            io.BytesIO(zip_content),
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=download.zip"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/thumbnail")
@handle_fs_errors
async def get_thumbnail(path: str, size: str = Query("thumb", pattern="^(thumb|large)$")):
    file_path = fs_service.get_absolute_path(path)
    thumb_bytes = await thumb_service.get_thumbnail(file_path, size)
    if thumb_bytes is None:
        raise HTTPException(status_code=404, detail="Cannot generate thumbnail")
    return StreamingResponse(io.BytesIO(thumb_bytes), media_type="image/jpeg")


@router.get("/preview")
@handle_fs_errors
async def preview_file(path: str):
    file_path = fs_service.get_absolute_path(path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)


@router.get("/text", response_model=TextFileContent)
@handle_fs_errors
async def get_text_content(path: str, max_size: int = Query(10 * 1024 * 1024)):
    file_path = fs_service.get_absolute_path(path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if file_path.is_dir():
        raise HTTPException(status_code=400, detail="Cannot read directory as text")
    size = file_path.stat().st_size
    if size > max_size:
        raise HTTPException(status_code=413, detail="File too large")
    try:
        content = file_path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File is not valid UTF-8 text")
    return TextFileContent(content=content, size=size)


@router.post("/text", response_model=OperationSuccess)
@handle_fs_errors
async def save_text_content(path: str, content: str):
    file_path = fs_service.get_absolute_path(path)
    file_path.write_text(content, encoding='utf-8')
    return OperationSuccess(success=True, message="File saved successfully")


@router.get("/stream")
@handle_fs_errors
async def stream_file(path: str, request: Request):
    """Stream a file with HTTP Range request support for video seeking."""
    file_path = fs_service.get_absolute_path(path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if file_path.is_dir():
        raise HTTPException(status_code=400, detail="Cannot stream directory")

    file_size = file_path.stat().st_size

    # Determine MIME type based on extension
    ext = file_path.suffix.lower()
    mime_types = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mkv': 'video/x-matroska',
        '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime',
        '.flv': 'video/x-flv',
        '.wmv': 'video/x-ms-wmv',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.flac': 'audio/flac',
        '.aac': 'audio/aac',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4',
    }
    content_type = mime_types.get(ext, 'application/octet-stream')

    # Parse Range header
    range_header = request.headers.get('range')

    if range_header:
        # Parse "bytes=start-end" format
        try:
            range_spec = range_header.replace('bytes=', '')
            parts = range_spec.split('-')
            start = int(parts[0]) if parts[0] else 0
            end = int(parts[1]) if parts[1] else file_size - 1
        except (ValueError, IndexError):
            raise HTTPException(status_code=416, detail="Invalid range header")

        # Validate range
        if start >= file_size or end >= file_size or start > end:
            raise HTTPException(
                status_code=416,
                detail="Range not satisfiable",
                headers={'Content-Range': f'bytes */{file_size}'}
            )

        chunk_size = end - start + 1

        async def range_generator():
            async with aiofiles.open(file_path, 'rb') as f:
                await f.seek(start)
                remaining = chunk_size
                while remaining > 0:
                    read_size = min(8192, remaining)
                    data = await f.read(read_size)
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        return StreamingResponse(
            range_generator(),
            status_code=206,
            media_type=content_type,
            headers={
                'Content-Range': f'bytes {start}-{end}/{file_size}',
                'Accept-Ranges': 'bytes',
                'Content-Length': str(chunk_size),
            }
        )
    else:
        # No Range header - return full file
        async def file_generator():
            async with aiofiles.open(file_path, 'rb') as f:
                while True:
                    data = await f.read(8192)
                    if not data:
                        break
                    yield data

        return StreamingResponse(
            file_generator(),
            media_type=content_type,
            headers={
                'Accept-Ranges': 'bytes',
                'Content-Length': str(file_size),
            }
        )
