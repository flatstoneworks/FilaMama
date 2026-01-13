import os
import shutil
import asyncio
from pathlib import Path
from datetime import datetime
from typing import List, Optional, AsyncGenerator
import mimetypes
import magic

from ..models.schemas import (
    FileType,
    FileInfo,
    DirectoryListing,
    DiskUsage,
    SortField,
    SortOrder,
    SearchResult,
)


class FilesystemService:
    def __init__(self, root_path: str):
        self.root_path = Path(root_path).resolve()
        self._magic = magic.Magic(mime=True)

    def _resolve_path(self, relative_path: str) -> Path:
        if relative_path.startswith('/'):
            relative_path = relative_path[1:]
        full_path = (self.root_path / relative_path).resolve()
        if not str(full_path).startswith(str(self.root_path)):
            raise ValueError("Path traversal attempt detected")
        return full_path

    def _get_relative_path(self, absolute_path: Path) -> str:
        try:
            return "/" + str(absolute_path.relative_to(self.root_path))
        except ValueError:
            return "/"

    def _get_file_type(self, path: Path) -> FileType:
        if path.is_symlink():
            return FileType.SYMLINK
        elif path.is_dir():
            return FileType.DIRECTORY
        return FileType.FILE

    def _get_mime_type(self, path: Path) -> Optional[str]:
        if path.is_dir():
            return "inode/directory"
        try:
            return self._magic.from_file(str(path))
        except Exception:
            mime, _ = mimetypes.guess_type(str(path))
            return mime

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

        items: List[FileInfo] = []
        total_size = 0

        try:
            for entry in dir_path.iterdir():
                if not show_hidden and entry.name.startswith('.'):
                    continue
                file_info = self._get_file_info(entry)
                items.append(file_info)
                total_size += file_info.size
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
            if str(parent_path).startswith(str(self.root_path)):
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
        parent_path = self._resolve_path(path)
        new_dir = parent_path / name
        if new_dir.exists():
            raise FileExistsError(f"Directory already exists: {name}")
        new_dir.mkdir(parents=True)
        return self._get_file_info(new_dir)

    async def delete(self, paths: List[str]) -> int:
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

    async def rename(self, path: str, new_name: str) -> FileInfo:
        file_path = self._resolve_path(path)
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {path}")
        new_path = file_path.parent / new_name
        if new_path.exists():
            raise FileExistsError(f"File already exists: {new_name}")
        file_path.rename(new_path)
        return self._get_file_info(new_path)

    async def copy(self, source: str, destination: str) -> FileInfo:
        src_path = self._resolve_path(source)
        dst_path = self._resolve_path(destination)
        if not src_path.exists():
            raise FileNotFoundError(f"Source not found: {source}")
        if dst_path.exists() and dst_path.is_dir():
            dst_path = dst_path / src_path.name
        if dst_path.exists():
            base = dst_path.stem
            ext = dst_path.suffix
            counter = 1
            while dst_path.exists():
                dst_path = dst_path.parent / f"{base}({counter}){ext}"
                counter += 1
        if src_path.is_dir():
            shutil.copytree(src_path, dst_path)
        else:
            shutil.copy2(src_path, dst_path)
        return self._get_file_info(dst_path)

    async def move(self, source: str, destination: str) -> FileInfo:
        src_path = self._resolve_path(source)
        dst_path = self._resolve_path(destination)
        if not src_path.exists():
            raise FileNotFoundError(f"Source not found: {source}")
        if dst_path.exists() and dst_path.is_dir():
            dst_path = dst_path / src_path.name
        if dst_path.exists():
            base = dst_path.stem
            ext = dst_path.suffix
            counter = 1
            while dst_path.exists():
                dst_path = dst_path.parent / f"{base}({counter}){ext}"
                counter += 1
        shutil.move(str(src_path), str(dst_path))
        return self._get_file_info(dst_path)

    async def search(
        self,
        query: str,
        path: str = "/",
        max_results: int = 100,
    ) -> AsyncGenerator[SearchResult, None]:
        search_path = self._resolve_path(path)
        query_lower = query.lower()
        count = 0

        for root, dirs, files in os.walk(search_path):
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            root_path = Path(root)

            for d in dirs:
                if count >= max_results:
                    return
                if query_lower in d.lower():
                    dir_path = root_path / d
                    info = self._get_file_info(dir_path)
                    yield SearchResult(
                        path=info.path,
                        name=info.name,
                        type=info.type,
                        size=info.size,
                        modified=info.modified,
                    )
                    count += 1

            for f in files:
                if count >= max_results:
                    return
                if f.startswith('.'):
                    continue
                if query_lower in f.lower():
                    file_path = root_path / f
                    info = self._get_file_info(file_path)
                    yield SearchResult(
                        path=info.path,
                        name=info.name,
                        type=info.type,
                        size=info.size,
                        modified=info.modified,
                    )
                    count += 1

            await asyncio.sleep(0)

    async def get_disk_usage(self, path: str = "/") -> DiskUsage:
        dir_path = self._resolve_path(path)
        usage = shutil.disk_usage(dir_path)
        return DiskUsage(
            total=usage.total,
            used=usage.used,
            free=usage.free,
            percent=(usage.used / usage.total) * 100,
        )

    def get_absolute_path(self, relative_path: str) -> Path:
        return self._resolve_path(relative_path)
