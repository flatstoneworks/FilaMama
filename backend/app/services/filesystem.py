import os
import shutil
import asyncio
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Optional
import mimetypes
import magic

logger = logging.getLogger(__name__)

from ..models.schemas import (
    FileType,
    FileInfo,
    DirectoryListing,
    DiskUsage,
    SortField,
    SortOrder,
    SearchResult,
)
from ..utils.paths import (
    generate_unique_path,
    relative_to_root,
    resolve_within_root,
)

# Content type definitions for filtering
CONTENT_TYPES = {
    'photos': ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.raw', '.cr2', '.nef'],
    'videos': ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.flv', '.wmv'],
    'gifs': ['.gif'],
    'pdfs': ['.pdf'],
    'audio': ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma', '.opus'],
}


class FilesystemService:
    def __init__(self, root_path: str, mounts: list = None):
        self.root_path = Path(root_path).resolve()
        self.mounts = []
        for m in (mounts or []):
            self.mounts.append({
                'name': m['name'],
                'path': Path(m['path']).resolve(),
                'icon': m.get('icon', 'folder'),
            })
        self._magic = magic.Magic(mime=True)

    @staticmethod
    def _validate_name(name: str) -> None:
        """Ensure name is a bare filename with no path separators or traversal."""
        if not name or '/' in name or '\\' in name or name in ('.', '..'):
            raise ValueError(f"Invalid name: {name}")

    def _is_within_bounds(self, resolved_path: Path) -> bool:
        """Check if a resolved path is within root_path or any mount point."""
        try:
            resolved_path.relative_to(self.root_path)
            return True
        except ValueError:
            pass
        for mount in self.mounts:
            try:
                resolved_path.relative_to(mount['path'])
                return True
            except ValueError:
                continue
        return False

    def _mount_paths(self) -> list[Path]:
        return [m['path'] for m in self.mounts]

    def _resolve_path(self, path: str) -> Path:
        return resolve_within_root(path, self.root_path, self._mount_paths())

    def _get_relative_path(self, absolute_path: Path) -> str:
        return relative_to_root(absolute_path, self.root_path, self._mount_paths())

    def _get_file_type(self, path: Path) -> FileType:
        if path.is_symlink():
            return FileType.SYMLINK
        elif path.is_dir():
            return FileType.DIRECTORY
        return FileType.FILE

    def _get_mime_type(self, path: Path) -> Optional[str]:
        if path.is_dir():
            return "inode/directory"
        # Use extension-based detection first (fast), fall back to python-magic (reads file header)
        mime, _ = mimetypes.guess_type(str(path))
        if mime:
            return mime
        try:
            return self._magic.from_file(str(path))
        except Exception:
            return None

    def _get_file_info(self, path: Path) -> FileInfo:
        try:
            stat_info = path.stat()
        except (OSError, PermissionError):
            return FileInfo(
                name=path.name,
                path=self._get_relative_path(path),
                type=FileType.FILE,
                size=0,
                modified=datetime.now(),
                is_hidden=path.name.startswith('.'),
            )

        file_type = self._get_file_type(path)
        extension = path.suffix.lower()[1:] if path.suffix else None
        size = stat_info.st_size if file_type == FileType.FILE else 0

        has_thumbnail = False
        mime = None
        if file_type == FileType.FILE:
            mime = self._get_mime_type(path)
            if mime and (mime.startswith('image/') or mime.startswith('video/')):
                has_thumbnail = True

        return FileInfo(
            name=path.name,
            path=self._get_relative_path(path),
            type=file_type,
            size=size,
            modified=datetime.fromtimestamp(stat_info.st_mtime),
            extension=extension,
            mime_type=mime,
            is_hidden=path.name.startswith('.'),
            has_thumbnail=has_thumbnail,
        )

    async def list_directory(
        self,
        path: str = "/",
        sort_by: SortField = SortField.NAME,
        sort_order: SortOrder = SortOrder.ASC,
        show_hidden: bool = False,
    ) -> DirectoryListing:
        dir_path = self._resolve_path(path)

        if not dir_path.exists():
            raise FileNotFoundError(f"Directory not found: {path}")
        if not dir_path.is_dir():
            raise NotADirectoryError(f"Not a directory: {path}")

        def _list_sync():
            items: List[FileInfo] = []
            total_size = 0
            for entry in dir_path.iterdir():
                if not show_hidden and entry.name.startswith('.'):
                    continue
                file_info = self._get_file_info(entry)
                items.append(file_info)
                total_size += file_info.size
            return items, total_size

        try:
            items, total_size = await asyncio.to_thread(_list_sync)
        except PermissionError:
            raise PermissionError(f"Permission denied: {path}")

        def sort_key(item: FileInfo):
            is_dir = 0 if item.type == FileType.DIRECTORY else 1
            if sort_by == SortField.NAME:
                return (is_dir, item.name.lower())
            elif sort_by == SortField.SIZE:
                return (is_dir, item.size)
            elif sort_by == SortField.MODIFIED:
                return (is_dir, item.modified)
            elif sort_by == SortField.TYPE:
                return (is_dir, item.extension or "", item.name.lower())
            return (is_dir, item.name.lower())

        items.sort(key=sort_key, reverse=(sort_order == SortOrder.DESC))

        parent = None
        if path != "/":
            parent_path = dir_path.parent
            parent_str = str(parent_path)
            # Check if parent is within a mount
            for mount in self.mounts:
                mount_str = str(mount['path'])
                if parent_str.startswith(mount_str):
                    parent = self._get_relative_path(parent_path)
                    break
            # Check if parent is within root_path
            if parent is None and parent_str.startswith(str(self.root_path)):
                parent = self._get_relative_path(parent_path)

        return DirectoryListing(
            path=self._get_relative_path(dir_path),
            parent=parent,
            items=items,
            total_items=len(items),
            total_size=total_size,
        )

    async def get_file_info(self, path: str) -> FileInfo:
        file_path = self._resolve_path(path)
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {path}")
        return self._get_file_info(file_path)

    async def create_directory(self, path: str, name: str) -> FileInfo:
        self._validate_name(name)
        parent_path = self._resolve_path(path)
        new_dir = (parent_path / name).resolve()
        if not self._is_within_bounds(new_dir):
            raise ValueError("Path traversal attempt detected")
        if new_dir.exists():
            raise FileExistsError(f"Directory already exists: {name}")
        new_dir.mkdir(parents=True)
        return self._get_file_info(new_dir)

    async def delete(self, paths: List[str]) -> int:
        def _delete_sync():
            deleted = 0
            for path in paths:
                file_path = self._resolve_path(path)
                if not file_path.exists():
                    continue
                if file_path.is_dir():
                    shutil.rmtree(file_path)
                else:
                    file_path.unlink()
                deleted += 1
            return deleted
        return await asyncio.to_thread(_delete_sync)

    async def rename(self, path: str, new_name: str) -> FileInfo:
        self._validate_name(new_name)
        file_path = self._resolve_path(path)
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {path}")
        new_path = (file_path.parent / new_name).resolve()
        if not self._is_within_bounds(new_path):
            raise ValueError("Path traversal attempt detected")
        if new_path.exists():
            raise FileExistsError(f"File already exists: {new_name}")
        file_path.rename(new_path)
        return self._get_file_info(new_path)

    async def copy(self, source: str, destination: str, overwrite: bool = False) -> FileInfo:
        src_path = self._resolve_path(source)
        dst_path = self._resolve_path(destination)
        if not src_path.exists():
            raise FileNotFoundError(f"Source not found: {source}")

        def _copy_sync():
            nonlocal dst_path
            if dst_path.exists() and dst_path.is_dir():
                dst_path = dst_path / src_path.name
            if dst_path.exists():
                if overwrite:
                    if dst_path.is_dir():
                        shutil.rmtree(dst_path)
                    else:
                        dst_path.unlink()
                else:
                    dst_path = generate_unique_path(dst_path)
            if src_path.is_dir():
                shutil.copytree(src_path, dst_path)
            else:
                shutil.copy2(src_path, dst_path)
            return self._get_file_info(dst_path)

        return await asyncio.to_thread(_copy_sync)

    async def move(self, source: str, destination: str, overwrite: bool = False) -> FileInfo:
        src_path = self._resolve_path(source)
        dst_path = self._resolve_path(destination)
        if not src_path.exists():
            raise FileNotFoundError(f"Source not found: {source}")

        def _move_sync():
            nonlocal dst_path
            if dst_path.exists() and dst_path.is_dir():
                dst_path = dst_path / src_path.name
            if dst_path.exists():
                if overwrite:
                    if dst_path.is_dir():
                        shutil.rmtree(dst_path)
                    else:
                        dst_path.unlink()
                else:
                    dst_path = generate_unique_path(dst_path)
            shutil.move(str(src_path), str(dst_path))
            return self._get_file_info(dst_path)

        return await asyncio.to_thread(_move_sync)

    async def check_conflicts(self, sources: list[str], destination: str) -> list[str]:
        """Check which source files would conflict with existing files in destination."""
        dst_path = self._resolve_path(destination)
        if not dst_path.exists() or not dst_path.is_dir():
            return []

        conflicts = []
        for source in sources:
            src_path = self._resolve_path(source)
            target = dst_path / src_path.name
            if target.exists():
                conflicts.append(source)
        return conflicts

    async def get_folder_size(self, path: str) -> int:
        """Calculate total size of a folder recursively."""
        folder_path = self._resolve_path(path)
        if not folder_path.exists():
            raise FileNotFoundError(f"Folder not found: {path}")
        if not folder_path.is_dir():
            raise ValueError(f"Not a directory: {path}")

        def _get_size_sync():
            total_size = 0
            for root, dirs, files in os.walk(folder_path):
                dirs[:] = [d for d in dirs if not d.startswith('.')]
                for file in files:
                    if file.startswith('.'):
                        continue
                    try:
                        file_path = Path(root) / file
                        total_size += file_path.stat().st_size
                    except (OSError, PermissionError):
                        continue
            return total_size

        return await asyncio.to_thread(_get_size_sync)

    async def search(
        self,
        query: str = "",
        path: str = "/",
        max_results: int = 100,
        content_type: str = None,
    ) -> tuple[list[SearchResult], bool, int]:
        """
        Search for files recursively.

        Returns:
            Tuple of (results, has_more, total_scanned)
            - results: List of SearchResult objects (up to max_results)
            - has_more: True if there are more results beyond max_results
            - total_scanned: Number of matching items found (may be > max_results)
        """
        search_path = self._resolve_path(path)
        query_lower = query.lower() if query else ""

        # Get extensions for content type filtering
        type_extensions = None
        if content_type and content_type in CONTENT_TYPES:
            type_extensions = CONTENT_TYPES[content_type]

        def _search_sync():
            results: list[SearchResult] = []
            total_scanned = 0
            has_more = False

            for root, dirs, files in os.walk(search_path):
                dirs[:] = [d for d in dirs if not d.startswith('.')]
                root_path = Path(root)

                # Only search directories if not filtering by content type
                if not content_type:
                    for d in dirs:
                        if not query_lower or query_lower in d.lower():
                            total_scanned += 1
                            if len(results) >= max_results:
                                has_more = True
                                continue
                            dir_path = root_path / d
                            info = self._get_file_info(dir_path)
                            results.append(SearchResult(
                                path=info.path,
                                name=info.name,
                                type=info.type,
                                size=info.size,
                                modified=info.modified,
                            ))

                for f in files:
                    if f.startswith('.'):
                        continue

                    if type_extensions:
                        ext = Path(f).suffix.lower()
                        if ext not in type_extensions:
                            continue

                    if query_lower and query_lower not in f.lower():
                        continue

                    total_scanned += 1
                    if len(results) >= max_results:
                        has_more = True
                        return results, has_more, total_scanned

                    file_path = root_path / f
                    info = self._get_file_info(file_path)
                    results.append(SearchResult(
                        path=info.path,
                        name=info.name,
                        type=info.type,
                        size=info.size,
                        modified=info.modified,
                    ))

            return results, has_more, total_scanned

        return await asyncio.to_thread(_search_sync)

    async def get_disk_usage(self, path: str = "/") -> DiskUsage:
        dir_path = self._resolve_path(path)
        usage = await asyncio.to_thread(shutil.disk_usage, dir_path)
        return DiskUsage(
            total=usage.total,
            used=usage.used,
            free=usage.free,
            percent=(usage.used / usage.total) * 100,
        )

    def get_absolute_path(self, relative_path: str) -> Path:
        return self._resolve_path(relative_path)
