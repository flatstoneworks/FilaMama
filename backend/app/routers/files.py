from fastapi import APIRouter, HTTPException, Query, Request
from starlette.background import BackgroundTask
from fastapi.responses import FileResponse, StreamingResponse, Response
from typing import List, Optional
import zipfile
import io
import os
import asyncio
import tempfile
import aiofiles

from ..models.schemas import (
    FileInfo, DirectoryListing, DiskUsage, SortField, SortOrder,
    RenameRequest, DeleteRequest, CreateDirectoryRequest, FileOperation,
    DeleteResponse, TextFileContent, OperationSuccess, Actor, ActorType,
    ConflictCheckRequest, ConflictCheckResponse,
)
from ..services.filesystem import FilesystemService
from ..services.thumbnails import ThumbnailService
from ..services.audio import AudioMetadataService
from ..services.content_search import ContentSearchService
from ..services.transcoding import TranscodingService, BROWSER_VIDEO_CODECS, BROWSER_AUDIO_CODECS
from ..services.agent import AgentService
from ..utils.error_handlers import handle_fs_errors

router = APIRouter(prefix="/api/files", tags=["files"])

fs_service: FilesystemService = None
thumb_service: ThumbnailService = None
audio_service: AudioMetadataService = None
transcode_service: TranscodingService = None
content_search_service: ContentSearchService = None
agent_service: AgentService = None


def _require_fs():
    if fs_service is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    return fs_service


def _require_thumb():
    if thumb_service is None:
        raise HTTPException(status_code=503, detail="Thumbnail service not initialized")
    return thumb_service


def _require_content_search():
    if content_search_service is None:
        raise HTTPException(status_code=503, detail="Content search service not initialized")
    return content_search_service


def init_services(
    filesystem: FilesystemService,
    thumbnails: ThumbnailService,
    audio: AudioMetadataService = None,
    transcoding: TranscodingService = None,
    content_search: ContentSearchService = None,
    agent: AgentService = None,
):
    global fs_service, thumb_service, audio_service, transcode_service, content_search_service, agent_service
    fs_service = filesystem
    thumb_service = thumbnails
    audio_service = audio
    transcode_service = transcoding
    # Default to a content searcher backed by the same filesystem service.
    content_search_service = content_search or ContentSearchService(filesystem)
    agent_service = agent


def _actor_from_request(request: Request) -> Actor:
    actor_type_value = request.headers.get("X-FilaMama-Actor-Type", "human")
    try:
        actor_type = ActorType(actor_type_value)
    except ValueError:
        actor_type = ActorType.HUMAN
    return Actor(
        id=request.headers.get("X-FilaMama-Actor-Id", "local-user"),
        type=actor_type,
        name=request.headers.get(
            "X-FilaMama-Actor-Name",
            "Local user" if actor_type == ActorType.HUMAN else "Agent",
        ),
    )


async def _audit(request: Request, action: str, paths: list[str], summary: str, metadata: dict | None = None):
    if agent_service is None:
        return
    try:
        await agent_service.record_activity(_actor_from_request(request), action, paths, summary, metadata)
    except Exception:
        # File operations should not fail because the audit log is temporarily unavailable.
        pass


@router.get("/list", response_model=DirectoryListing)
@handle_fs_errors
async def list_directory(
    path: str = "/",
    sort_by: SortField = SortField.NAME,
    sort_order: SortOrder = SortOrder.ASC,
    show_hidden: bool = False,
):
    svc = _require_fs()
    return await svc.list_directory(path, sort_by, sort_order, show_hidden)


@router.get("/info", response_model=FileInfo)
@handle_fs_errors
async def get_file_info(path: str):
    return await _require_fs().get_file_info(path)


@router.post("/mkdir", response_model=FileInfo)
@handle_fs_errors
async def create_directory(http_request: Request, request: CreateDirectoryRequest):
    info = await _require_fs().create_directory(request.path, request.name)
    await _audit(http_request, "file.mkdir", [info.path], f"Created folder {info.name}")
    return info


@router.post("/delete", response_model=DeleteResponse)
@handle_fs_errors
async def delete_files(http_request: Request, request: DeleteRequest):
    count = await _require_fs().delete(request.paths)
    await _audit(http_request, "file.delete", request.paths, f"Deleted {count} item(s)", {"count": count})
    return DeleteResponse(deleted=count)


@router.post("/rename", response_model=FileInfo)
@handle_fs_errors
async def rename_file(http_request: Request, request: RenameRequest):
    info = await _require_fs().rename(request.path, request.new_name)
    await _audit(http_request, "file.rename", [request.path, info.path], f"Renamed to {info.name}")
    return info


@router.post("/copy", response_model=FileInfo)
@handle_fs_errors
async def copy_file(http_request: Request, request: FileOperation):
    info = await _require_fs().copy(request.source, request.destination, request.overwrite)
    await _audit(
        http_request,
        "file.copy",
        [request.source, info.path],
        f"Copied {request.source} to {info.path}",
        {"overwrite": request.overwrite},
    )
    return info


@router.post("/move", response_model=FileInfo)
@handle_fs_errors
async def move_file(http_request: Request, request: FileOperation):
    info = await _require_fs().move(request.source, request.destination, request.overwrite)
    await _audit(
        http_request,
        "file.move",
        [request.source, info.path],
        f"Moved {request.source} to {info.path}",
        {"overwrite": request.overwrite},
    )
    return info


@router.post("/check-conflicts", response_model=ConflictCheckResponse)
@handle_fs_errors
async def check_conflicts(request: ConflictCheckRequest):
    """Check if any source files would conflict with existing files in destination."""
    conflicts = await _require_fs().check_conflicts(request.sources, request.destination)
    return ConflictCheckResponse(conflicts=conflicts)


@router.get("/folder-size")
@handle_fs_errors
async def get_folder_size(path: str):
    """Calculate total size of a folder recursively."""
    size = await _require_fs().get_folder_size(path)
    return {"path": path, "size": size}


@router.get("/search")
@handle_fs_errors
async def search_files(
    query: str = "",
    path: str = "/",
    max_results: int = Query(100, le=5000),
    content_type: Optional[str] = None,
):
    """Search files recursively. Returns results with truncation info."""
    results, has_more, total_scanned = await _require_fs().search(
        query, path, max_results, content_type
    )
    if agent_service is not None and query:
        remaining = max(max_results - len(results), 0)
        if remaining:
            metadata_results = await agent_service.search_artifacts(query, path, remaining)
            existing_paths = {item.path for item in results}
            for item in metadata_results:
                if item.path not in existing_paths:
                    results.append(item)
                    existing_paths.add(item.path)
            total_scanned += len(metadata_results)
    return {
        "results": [r.model_dump() for r in results],
        "has_more": has_more,
        "total_scanned": total_scanned,
    }


@router.get("/search-content")
@handle_fs_errors
async def search_content(
    query: str,
    path: str = "/",
    max_files: int = Query(100, le=200),
    max_depth: int = Query(3, le=5),
):
    """
    Search file contents for a text pattern.
    Uses ripgrep for fast searching when available.

    Args:
        query: Text pattern to search for
        path: Directory to search in
        max_files: Maximum number of files to return (up to 200)
        max_depth: Maximum directory depth to search (up to 5)
    """
    if not query or len(query) < 2:
        raise HTTPException(status_code=400, detail="Query must be at least 2 characters")

    results, files_searched, files_with_matches, has_more = await _require_content_search().search(
        query, path, max_files, max_depth
    )
    return {
        "results": [r.model_dump() for r in results],
        "files_searched": files_searched,
        "files_with_matches": files_with_matches,
        "has_more": has_more,
    }


@router.get("/disk-usage", response_model=DiskUsage)
@handle_fs_errors
async def get_disk_usage(path: str = "/"):
    return await _require_fs().get_disk_usage(path)


@router.get("/download")
@handle_fs_errors
async def download_file(path: str):
    file_path = _require_fs().get_absolute_path(path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if file_path.is_dir():
        raise HTTPException(status_code=400, detail="Cannot download directory directly")
    return FileResponse(file_path, filename=file_path.name, media_type="application/octet-stream")


@router.post("/download-zip")
@handle_fs_errors
async def download_zip(paths: List[str]):
    MAX_ZIP_SIZE = 4 * 1024 * 1024 * 1024  # 4GB limit

    def build_zip_file() -> str:
        total_size = 0
        temp_file = tempfile.NamedTemporaryFile(prefix="filamama-", suffix=".zip", delete=False)
        temp_file.close()

        try:
            with zipfile.ZipFile(temp_file.name, 'w', zipfile.ZIP_DEFLATED) as zf:
                for path in paths:
                    try:
                        file_path = _require_fs().get_absolute_path(path)
                        if not file_path.exists():
                            continue
                        if file_path.is_file():
                            total_size += file_path.stat().st_size
                            if total_size > MAX_ZIP_SIZE:
                                raise HTTPException(status_code=413, detail="Zip would exceed 4GB size limit")
                            zf.write(file_path, file_path.name)
                        else:
                            for root, dirs, files_in_dir in file_path.walk():
                                dirs[:] = [d for d in dirs if not d.startswith('.')]
                                for file in files_in_dir:
                                    if file.startswith('.'):
                                        continue
                                    full_path = root / file
                                    total_size += full_path.stat().st_size
                                    if total_size > MAX_ZIP_SIZE:
                                        raise HTTPException(status_code=413, detail="Zip would exceed 4GB size limit")
                                    arcname = str(full_path.relative_to(file_path.parent))
                                    zf.write(full_path, arcname)
                    except HTTPException:
                        raise
                    except (ValueError, PermissionError):
                        continue
            return temp_file.name
        except Exception:
            os.unlink(temp_file.name)
            raise

    zip_path = await asyncio.to_thread(build_zip_file)
    return FileResponse(
        zip_path,
        filename="download.zip",
        media_type="application/zip",
        background=BackgroundTask(os.unlink, zip_path),
    )


@router.get("/thumbnail")
@handle_fs_errors
async def get_thumbnail(path: str, size: str = Query("thumb", pattern="^(thumb|large)$")):
    file_path = _require_fs().get_absolute_path(path)
    thumb_bytes = await _require_thumb().get_thumbnail(file_path, size)
    if thumb_bytes is None:
        raise HTTPException(status_code=404, detail="Cannot generate thumbnail")
    return StreamingResponse(io.BytesIO(thumb_bytes), media_type="image/jpeg")


@router.get("/preview")
@handle_fs_errors
async def preview_file(path: str):
    file_path = _require_fs().get_absolute_path(path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)


@router.get("/text", response_model=TextFileContent)
@handle_fs_errors
async def get_text_content(path: str, max_size: int = Query(10 * 1024 * 1024)):
    file_path = _require_fs().get_absolute_path(path)
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


MAX_TEXT_SAVE_SIZE = 50 * 1024 * 1024  # 50MB limit for text saves


@router.post("/text", response_model=OperationSuccess)
@handle_fs_errors
async def save_text_content(request: Request, path: str, content: str):
    if len(content.encode('utf-8')) > MAX_TEXT_SAVE_SIZE:
        raise HTTPException(status_code=413, detail="Content too large (max 50MB)")
    file_path = _require_fs().get_absolute_path(path)
    file_path.write_text(content, encoding='utf-8')
    await _audit(request, "file.text.save", [path], f"Saved text file {file_path.name}", {"size": file_path.stat().st_size})
    return OperationSuccess(success=True, message="File saved successfully")


STREAM_MIME_TYPES = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.flv': 'video/x-flv',
    '.wmv': 'video/x-ms-wmv',
    '.m4v': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.wma': 'audio/x-ms-wma',
    '.opus': 'audio/opus',
}


@router.get("/stream")
@handle_fs_errors
async def stream_file(path: str, request: Request):
    """Stream a file with HTTP Range request support for video seeking."""
    file_path = _require_fs().get_absolute_path(path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if file_path.is_dir():
        raise HTTPException(status_code=400, detail="Cannot stream directory")

    content_type = STREAM_MIME_TYPES.get(file_path.suffix.lower(), 'application/octet-stream')
    return await _serve_file_with_ranges(file_path, content_type, request)


async def _serve_file_with_ranges(file_path, content_type: str, request: Request):
    """Shared helper: serve a file with HTTP Range request support."""
    file_size = file_path.stat().st_size
    range_header = request.headers.get('range')

    if range_header:
        try:
            range_spec = range_header.replace('bytes=', '')
            parts = range_spec.split('-')
            if len(parts) != 2:
                raise ValueError

            if parts[0] and parts[1]:
                start = int(parts[0])
                end = int(parts[1])
            elif parts[0]:
                start = int(parts[0])
                end = file_size - 1
            elif parts[1]:
                suffix_length = int(parts[1])
                if suffix_length <= 0:
                    raise ValueError
                start = max(file_size - suffix_length, 0)
                end = file_size - 1
            else:
                raise ValueError
        except (ValueError, IndexError):
            raise HTTPException(status_code=416, detail="Invalid range header")

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


@router.get("/video-info")
@handle_fs_errors
async def get_video_info(path: str):
    """Probe video file codecs to determine if transcoding is needed."""
    if not transcode_service:
        raise HTTPException(status_code=501, detail="Transcoding service not available")

    file_path = _require_fs().get_absolute_path(path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    probe = await transcode_service.probe_codecs(file_path)
    if not probe:
        raise HTTPException(status_code=400, detail="Could not probe video file")

    needs_processing = transcode_service.needs_processing(file_path)
    is_cached = transcode_service.get_cached_path(file_path) is not None

    video_ok = probe['video_codec'] in BROWSER_VIDEO_CODECS
    audio_ok = probe['audio_codec'] in BROWSER_AUDIO_CODECS or probe['audio_codec'] is None

    return {
        "video_codec": probe['video_codec'],
        "audio_codec": probe['audio_codec'],
        "container": probe['container'],
        "duration": probe['duration'],
        "needs_processing": needs_processing,
        "processing_type": "none" if not needs_processing else ("remux" if (video_ok and audio_ok) else "transcode"),
        "is_cached": is_cached,
    }


@router.get("/transcode-stream")
@handle_fs_errors
async def transcode_stream(path: str, request: Request):
    """Stream a transcoded/remuxed version of a video file."""
    if not transcode_service:
        raise HTTPException(status_code=501, detail="Transcoding service not available")

    file_path = _require_fs().get_absolute_path(path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    mp4_path = await transcode_service.get_or_create_mp4(file_path)
    if not mp4_path:
        raise HTTPException(status_code=500, detail="Failed to transcode video")

    return await _serve_file_with_ranges(mp4_path, 'video/mp4', request)


@router.get("/audio-metadata")
@handle_fs_errors
async def get_audio_metadata(path: str):
    """Get metadata (title, artist, album, etc.) from an audio file."""
    if not audio_service:
        raise HTTPException(status_code=501, detail="Audio metadata service not available")

    file_path = _require_fs().get_absolute_path(path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    metadata = audio_service.get_metadata(file_path)
    if metadata is None:
        raise HTTPException(status_code=400, detail="Could not extract audio metadata")

    return metadata


@router.get("/audio-cover")
@handle_fs_errors
async def get_audio_cover(path: str):
    """Get cover art from an audio file."""
    if not audio_service:
        raise HTTPException(status_code=501, detail="Audio metadata service not available")

    file_path = _require_fs().get_absolute_path(path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    cover = audio_service.get_cover_art(file_path)
    if cover is None:
        raise HTTPException(status_code=404, detail="No cover art found")

    image_bytes, mime_type = cover
    return Response(content=image_bytes, media_type=mime_type)


@router.get("/audio-lyrics")
@handle_fs_errors
async def get_audio_lyrics(path: str):
    """Get lyrics from an audio file."""
    if not audio_service:
        raise HTTPException(status_code=501, detail="Audio metadata service not available")

    file_path = _require_fs().get_absolute_path(path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    lyrics = audio_service.get_lyrics(file_path)
    if lyrics is None:
        raise HTTPException(status_code=404, detail="No lyrics found")

    return {"lyrics": lyrics}
