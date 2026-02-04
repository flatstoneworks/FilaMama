import os
import shutil
import asyncio
import subprocess
import json
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
    ContentSearchMatch,
    ContentSearchResult,
)

# Content type definitions for filtering
CONTENT_TYPES = {
    'photos': ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.raw', '.cr2', '.nef'],
    'videos': ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'],
    'gifs': ['.gif'],
    'pdfs': ['.pdf'],
    'audio': ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'],
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

    def _resolve_path(self, path: str) -> Path:
        # Check if path matches a mount point
        for mount in self.mounts:
            mount_str = str(mount['path'])
            if path == mount_str or path.startswith(mount_str + '/'):
                full_path = Path(path).resolve()
                # Security check: ensure resolved path is within mount
                if not str(full_path).startswith(mount_str):
                    raise ValueError("Path traversal attempt detected")
                return full_path

        # Existing root_path logic
        if path.startswith('/'):
            path = path[1:]
        full_path = (self.root_path / path).resolve()
        if not str(full_path).startswith(str(self.root_path)):
            raise ValueError("Path traversal attempt detected")
        return full_path

    def _get_relative_path(self, absolute_path: Path) -> str:
        abs_str = str(absolute_path)
        # Check mounts first - return absolute path for mount locations
        for mount in self.mounts:
            if abs_str.startswith(str(mount['path'])):
                return abs_str
        # Existing root_path logic
        try:
            rel = str(absolute_path.relative_to(self.root_path))
            # Handle case where path equals root_path (relative_to returns ".")
            if rel == ".":
                return "/"
            return "/" + rel
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

    async def copy(self, source: str, destination: str, overwrite: bool = False) -> FileInfo:
        src_path = self._resolve_path(source)
        dst_path = self._resolve_path(destination)
        if not src_path.exists():
            raise FileNotFoundError(f"Source not found: {source}")
        if dst_path.exists() and dst_path.is_dir():
            dst_path = dst_path / src_path.name
        if dst_path.exists():
            if overwrite:
                # Remove existing file/directory before copying
                if dst_path.is_dir():
                    shutil.rmtree(dst_path)
                else:
                    dst_path.unlink()
            else:
                # Auto-rename with counter
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

    async def move(self, source: str, destination: str, overwrite: bool = False) -> FileInfo:
        src_path = self._resolve_path(source)
        dst_path = self._resolve_path(destination)
        if not src_path.exists():
            raise FileNotFoundError(f"Source not found: {source}")
        if dst_path.exists() and dst_path.is_dir():
            dst_path = dst_path / src_path.name
        if dst_path.exists():
            if overwrite:
                # Remove existing file/directory before moving
                if dst_path.is_dir():
                    shutil.rmtree(dst_path)
                else:
                    dst_path.unlink()
            else:
                # Auto-rename with counter
                base = dst_path.stem
                ext = dst_path.suffix
                counter = 1
                while dst_path.exists():
                    dst_path = dst_path.parent / f"{base}({counter}){ext}"
                    counter += 1
        shutil.move(str(src_path), str(dst_path))
        return self._get_file_info(dst_path)

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

        total_size = 0
        for root, dirs, files in os.walk(folder_path):
            # Skip hidden directories
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
        results: list[SearchResult] = []
        total_scanned = 0
        has_more = False

        # Get extensions for content type filtering
        type_extensions = None
        if content_type and content_type in CONTENT_TYPES:
            type_extensions = CONTENT_TYPES[content_type]

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
                            continue  # Keep scanning to count total
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

                # Check content type filter
                if type_extensions:
                    ext = Path(f).suffix.lower()
                    if ext not in type_extensions:
                        continue

                # Check query filter
                if query_lower and query_lower not in f.lower():
                    continue

                total_scanned += 1
                if len(results) >= max_results:
                    has_more = True
                    # Stop early once we know there are more results
                    # (counting all would be too slow for large directories)
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

            await asyncio.sleep(0)

        return results, has_more, total_scanned

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

    # Text file extensions for content search
    TEXT_EXTENSIONS = {
        '.txt', '.md', '.markdown', '.rst', '.log', '.csv', '.tsv',
        '.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.env',
        '.py', '.pyw', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
        '.html', '.htm', '.css', '.scss', '.sass', '.less',
        '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
        '.c', '.h', '.cpp', '.hpp', '.cc', '.cxx', '.java', '.kt', '.kts',
        '.go', '.rs', '.rb', '.php', '.pl', '.pm', '.swift', '.scala',
        '.sql', '.r', '.R', '.lua', '.vim', '.el', '.clj', '.ex', '.exs',
        '.erl', '.hrl', '.hs', '.fs', '.fsx', '.ml', '.mli',
        '.dockerfile', '.makefile', '.cmake', '.gradle', '.sbt',
        '.gitignore', '.gitattributes', '.editorconfig', '.prettierrc',
        '.eslintrc', '.babelrc', '.npmrc', '.nvmrc',
    }

    async def search_content(
        self,
        query: str,
        path: str = "/",
        max_files: int = 100,
        max_depth: int = 3,
        max_file_size_kb: int = 1024,  # 1MB max per file
        max_matches_per_file: int = 5,
    ) -> tuple[list[ContentSearchResult], int, int, bool]:
        """
        Search file contents using ripgrep.

        Returns:
            Tuple of (results, files_searched, files_with_matches, has_more)
        """
        search_path = self._resolve_path(path)

        if not search_path.exists():
            raise FileNotFoundError(f"Path not found: {path}")

        # Build ripgrep command
        # -n: line numbers, -i: case insensitive, --json: JSON output
        # --max-depth: limit depth, --max-filesize: limit file size
        # --type: only search text files (rg's built-in types)
        cmd = [
            'rg',
            '--json',                           # JSON output for parsing
            '-i',                               # Case insensitive
            '-n',                               # Line numbers
            '--max-depth', str(max_depth),      # Limit search depth
            '--max-filesize', f'{max_file_size_kb}K',  # Limit file size
            '--max-count', str(max_matches_per_file),  # Max matches per file
            '--hidden',                         # Include hidden files
            '--no-heading',                     # Don't group by file
            '--glob', '!.git',                  # Exclude .git directory
            '--glob', '!node_modules',          # Exclude node_modules
            '--glob', '!__pycache__',           # Exclude pycache
            '--glob', '!*.min.js',              # Exclude minified JS
            '--glob', '!*.min.css',             # Exclude minified CSS
            '--glob', '!dist',                  # Exclude dist folders
            '--glob', '!build',                 # Exclude build folders
            '--glob', '!.venv',                 # Exclude venv
            '--glob', '!venv',                  # Exclude venv
            query,
            str(search_path)
        ]

        try:
            # Run ripgrep
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                limit=1024*1024*10  # 10MB buffer
            )
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(),
                timeout=30  # 30 second timeout
            )
        except asyncio.TimeoutError:
            return [], 0, 0, True
        except FileNotFoundError:
            # ripgrep not installed - fall back to Python search
            return await self._search_content_python(
                query, search_path, max_files, max_depth, max_file_size_kb, max_matches_per_file
            )

        # Parse JSON output
        results_by_file: dict[str, ContentSearchResult] = {}
        files_searched = 0
        has_more = False

        for line in stdout.decode('utf-8', errors='replace').strip().split('\n'):
            if not line:
                continue

            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue

            if data.get('type') == 'summary':
                files_searched = data.get('data', {}).get('stats', {}).get('searched_files', 0)
                continue

            if data.get('type') != 'match':
                continue

            match_data = data.get('data', {})
            abs_path = match_data.get('path', {}).get('text', '')

            if not abs_path:
                continue

            # Check if we've hit file limit
            if abs_path not in results_by_file and len(results_by_file) >= max_files:
                has_more = True
                continue

            file_path = Path(abs_path)

            # Get relative path
            rel_path = self._get_relative_path(file_path)

            # Get line info
            line_number = match_data.get('line_number', 0)
            lines = match_data.get('lines', {})
            line_content = lines.get('text', '').strip()[:200]  # Limit line length

            # Create or update result entry
            if abs_path not in results_by_file:
                try:
                    info = self._get_file_info(file_path)
                    results_by_file[abs_path] = ContentSearchResult(
                        path=rel_path,
                        name=file_path.name,
                        type=info.type,
                        size=info.size,
                        modified=info.modified,
                        matches=[]
                    )
                except Exception:
                    continue

            # Add match
            results_by_file[abs_path].matches.append(
                ContentSearchMatch(
                    path=rel_path,
                    name=file_path.name,
                    line_number=line_number,
                    line_content=line_content,
                )
            )

        results = list(results_by_file.values())
        return results, files_searched, len(results), has_more

    async def _search_content_python(
        self,
        query: str,
        search_path: Path,
        max_files: int,
        max_depth: int,
        max_file_size_kb: int,
        max_matches_per_file: int,
    ) -> tuple[list[ContentSearchResult], int, int, bool]:
        """
        Fallback Python-based content search when ripgrep is not available.
        """
        query_lower = query.lower()
        results: list[ContentSearchResult] = []
        files_searched = 0
        has_more = False

        def walk_with_depth(start_path: Path, current_depth: int = 0):
            if current_depth > max_depth:
                return

            try:
                for entry in start_path.iterdir():
                    # Skip hidden and common excluded directories
                    if entry.name.startswith('.') and entry.is_dir():
                        continue
                    if entry.name in {'node_modules', '__pycache__', 'dist', 'build', 'venv', '.venv'}:
                        continue

                    if entry.is_dir():
                        yield from walk_with_depth(entry, current_depth + 1)
                    elif entry.is_file():
                        yield entry
            except PermissionError:
                pass

        for file_path in walk_with_depth(search_path):
            if len(results) >= max_files:
                has_more = True
                break

            # Check extension
            ext = file_path.suffix.lower()
            if ext not in self.TEXT_EXTENSIONS:
                continue

            # Check file size
            try:
                size = file_path.stat().st_size
                if size > max_file_size_kb * 1024:
                    continue
            except OSError:
                continue

            files_searched += 1

            # Search file content
            matches: list[ContentSearchMatch] = []
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    for line_num, line in enumerate(f, 1):
                        if query_lower in line.lower():
                            matches.append(ContentSearchMatch(
                                path=self._get_relative_path(file_path),
                                name=file_path.name,
                                line_number=line_num,
                                line_content=line.strip()[:200],
                            ))
                            if len(matches) >= max_matches_per_file:
                                break
            except Exception:
                continue

            if matches:
                info = self._get_file_info(file_path)
                results.append(ContentSearchResult(
                    path=info.path,
                    name=info.name,
                    type=info.type,
                    size=info.size,
                    modified=info.modified,
                    matches=matches,
                ))

            await asyncio.sleep(0)  # Yield to event loop

        return results, files_searched, len(results), has_more
