"""Content search service.

Searches inside text files for a literal substring. Uses ripgrep when
available and falls back to a pure-Python walker if ripgrep is missing.

Path resolution and file metadata are delegated to the FilesystemService
that this service is constructed with — that's the single place that knows
about mount points, root bounds, and FileInfo shape.
"""

import asyncio
import json
import logging
import subprocess
from pathlib import Path
from typing import TYPE_CHECKING

from ..models.schemas import ContentSearchMatch, ContentSearchResult

if TYPE_CHECKING:
    from .filesystem import FilesystemService

logger = logging.getLogger(__name__)


# File extensions the Python fallback will read. ripgrep uses its own
# built-in text detection so this list only constrains the fallback path.
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

# Directories ripgrep and the Python fallback both skip.
EXCLUDED_DIRS = {'node_modules', '__pycache__', 'dist', 'build', 'venv', '.venv'}

# Glob excludes passed to ripgrep. Mirrors EXCLUDED_DIRS plus a few file globs.
_RIPGREP_EXCLUDES = [
    '!.git', '!node_modules', '!__pycache__',
    '!*.min.js', '!*.min.css',
    '!dist', '!build', '!.venv', '!venv',
]


class ContentSearchService:
    """Search file contents using ripgrep, with a Python fallback."""

    def __init__(self, fs: "FilesystemService"):
        self.fs = fs

    async def search(
        self,
        query: str,
        path: str = "/",
        max_files: int = 100,
        max_depth: int = 3,
        max_file_size_kb: int = 1024,  # 1MB max per file
        max_matches_per_file: int = 5,
    ) -> tuple[list[ContentSearchResult], int, int, bool]:
        """Search file contents under ``path`` for the literal ``query``.

        Returns:
            (results, files_searched, files_with_matches, has_more)
        """
        search_path = self.fs._resolve_path(path)

        if not search_path.exists():
            raise FileNotFoundError(f"Path not found: {path}")

        try:
            return await self._search_ripgrep(
                query, search_path, max_files, max_depth,
                max_file_size_kb, max_matches_per_file,
            )
        except FileNotFoundError:
            # ripgrep binary missing — fall back to pure Python.
            return await self._search_python(
                query, search_path, max_files, max_depth,
                max_file_size_kb, max_matches_per_file,
            )

    async def _search_ripgrep(
        self,
        query: str,
        search_path: Path,
        max_files: int,
        max_depth: int,
        max_file_size_kb: int,
        max_matches_per_file: int,
    ) -> tuple[list[ContentSearchResult], int, int, bool]:
        cmd = [
            'rg',
            '--json',                                  # JSON output for parsing
            '-i',                                      # Case insensitive
            '-n',                                      # Line numbers
            '--fixed-strings',                         # Literal string (prevents ReDoS)
            '--max-depth', str(max_depth),
            '--max-filesize', f'{max_file_size_kb}K',
            '--max-count', str(max_matches_per_file),
            '--hidden',
            '--no-heading',
        ]
        for glob in _RIPGREP_EXCLUDES:
            cmd.extend(['--glob', glob])
        cmd.extend([query, str(search_path)])

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            limit=1024 * 1024 * 10,  # 10MB buffer
        )
        try:
            stdout, _stderr = await asyncio.wait_for(
                proc.communicate(), timeout=30
            )
        except asyncio.TimeoutError:
            return [], 0, 0, True

        return self._parse_ripgrep_output(stdout, max_files)

    def _parse_ripgrep_output(
        self,
        stdout: bytes,
        max_files: int,
    ) -> tuple[list[ContentSearchResult], int, int, bool]:
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

            kind = data.get('type')
            if kind == 'summary':
                files_searched = data.get('data', {}).get('stats', {}).get('searched_files', 0)
                continue
            if kind != 'match':
                continue

            match_data = data.get('data', {})
            abs_path = match_data.get('path', {}).get('text', '')
            if not abs_path:
                continue

            # Hit the file cap — note it but keep parsing for the summary line.
            if abs_path not in results_by_file and len(results_by_file) >= max_files:
                has_more = True
                continue

            file_path = Path(abs_path)
            rel_path = self.fs._get_relative_path(file_path)

            line_number = match_data.get('line_number', 0)
            line_content = match_data.get('lines', {}).get('text', '').strip()[:200]

            if abs_path not in results_by_file:
                try:
                    info = self.fs._get_file_info(file_path)
                except Exception:
                    continue
                results_by_file[abs_path] = ContentSearchResult(
                    path=rel_path,
                    name=file_path.name,
                    type=info.type,
                    size=info.size,
                    modified=info.modified,
                    matches=[],
                )

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

    async def _search_python(
        self,
        query: str,
        search_path: Path,
        max_files: int,
        max_depth: int,
        max_file_size_kb: int,
        max_matches_per_file: int,
    ) -> tuple[list[ContentSearchResult], int, int, bool]:
        """Fallback Python-based content search when ripgrep is not available."""
        query_lower = query.lower()
        results: list[ContentSearchResult] = []
        files_searched = 0
        has_more = False

        for file_path in self._walk_text_files(search_path, max_depth):
            if len(results) >= max_files:
                has_more = True
                break

            try:
                size = file_path.stat().st_size
                if size > max_file_size_kb * 1024:
                    continue
            except OSError:
                continue

            files_searched += 1

            matches = self._scan_file(file_path, query_lower, max_matches_per_file)
            if not matches:
                continue

            try:
                info = self.fs._get_file_info(file_path)
            except Exception:
                continue
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

    def _walk_text_files(self, start: Path, max_depth: int):
        """Yield text-file paths under ``start`` up to ``max_depth`` levels deep."""
        def walk(current: Path, depth: int):
            if depth > max_depth:
                return
            try:
                entries = list(current.iterdir())
            except PermissionError:
                return
            for entry in entries:
                if entry.is_dir():
                    if entry.name.startswith('.') or entry.name in EXCLUDED_DIRS:
                        continue
                    yield from walk(entry, depth + 1)
                elif entry.is_file():
                    if entry.suffix.lower() in TEXT_EXTENSIONS:
                        yield entry

        yield from walk(start, 0)

    def _scan_file(
        self,
        file_path: Path,
        query_lower: str,
        max_matches: int,
    ) -> list[ContentSearchMatch]:
        matches: list[ContentSearchMatch] = []
        try:
            rel_path = self.fs._get_relative_path(file_path)
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                for line_num, line in enumerate(f, 1):
                    if query_lower in line.lower():
                        matches.append(ContentSearchMatch(
                            path=rel_path,
                            name=file_path.name,
                            line_number=line_num,
                            line_content=line.strip()[:200],
                        ))
                        if len(matches) >= max_matches:
                            break
        except Exception:
            return []
        return matches
