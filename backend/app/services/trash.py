import os
import json
import shutil
import asyncio
import logging
import time
from pathlib import Path
from datetime import datetime
from typing import List, Optional

from ..models.schemas import FileType, FileInfo

logger = logging.getLogger(__name__)

TRASH_DIR_NAME = ".deleted_items"
MANIFEST_NAME = ".manifest.json"


class TrashService:
    def __init__(self, root_path: str):
        self.root_path = Path(root_path).resolve()
        self.trash_dir = self.root_path / TRASH_DIR_NAME
        self.manifest_path = self.trash_dir / MANIFEST_NAME

    def _ensure_trash_dir(self):
        self.trash_dir.mkdir(exist_ok=True)

    def _read_manifest(self) -> list[dict]:
        if not self.manifest_path.exists():
            return []
        try:
            data = json.loads(self.manifest_path.read_text(encoding="utf-8"))
            return data if isinstance(data, list) else []
        except (json.JSONDecodeError, OSError):
            return []

    def _write_manifest(self, entries: list[dict]):
        self._ensure_trash_dir()
        self.manifest_path.write_text(
            json.dumps(entries, indent=2, default=str), encoding="utf-8"
        )

    def _resolve_path(self, path: str) -> Path:
        if path.startswith("/"):
            path = path[1:]
        full_path = (self.root_path / path).resolve()
        if not str(full_path).startswith(str(self.root_path)):
            raise ValueError("Path traversal attempt detected")
        return full_path

    def _get_relative_path(self, absolute_path: Path) -> str:
        try:
            rel = str(absolute_path.relative_to(self.root_path))
            if rel == ".":
                return "/"
            return "/" + rel
        except ValueError:
            return "/"

    async def move_to_trash(self, paths: list[str]) -> int:
        def _move_sync():
            self._ensure_trash_dir()
            manifest = self._read_manifest()
            moved = 0

            for path in paths:
                file_path = self._resolve_path(path)
                if not file_path.exists():
                    continue

                # Prevent trashing the trash folder itself
                if str(file_path).startswith(str(self.trash_dir)):
                    continue

                timestamp = int(time.time() * 1000)
                trash_name = f"{timestamp}_{file_path.name}"
                trash_path = self.trash_dir / trash_name

                # Ensure unique trash name
                while trash_path.exists():
                    timestamp += 1
                    trash_name = f"{timestamp}_{file_path.name}"
                    trash_path = self.trash_dir / trash_name

                shutil.move(str(file_path), str(trash_path))

                manifest.append({
                    "id": trash_name,
                    "original_path": self._get_relative_path(file_path),
                    "trash_name": trash_name,
                    "deleted_at": datetime.now().isoformat(),
                })
                moved += 1

            self._write_manifest(manifest)
            return moved

        return await asyncio.to_thread(_move_sync)

    async def list_trash(self) -> list[dict]:
        def _list_sync():
            manifest = self._read_manifest()
            items = []

            for entry in manifest:
                trash_path = self.trash_dir / entry["trash_name"]
                if not trash_path.exists():
                    continue

                try:
                    stat = trash_path.stat()
                except OSError:
                    continue

                is_dir = trash_path.is_dir()
                # Extract original name from trash_name: "<timestamp>_<original_name>"
                original_name = entry["trash_name"].split("_", 1)[1] if "_" in entry["trash_name"] else entry["trash_name"]

                items.append({
                    "name": entry["trash_name"],
                    "original_name": original_name,
                    "original_path": entry["original_path"],
                    "path": self._get_relative_path(trash_path),
                    "type": "directory" if is_dir else "file",
                    "size": stat.st_size if not is_dir else 0,
                    "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "deleted_at": entry["deleted_at"],
                    "extension": trash_path.suffix.lower()[1:] if trash_path.suffix and not is_dir else None,
                    "is_hidden": False,
                    "has_thumbnail": False,
                })

            return items

        return await asyncio.to_thread(_list_sync)

    async def restore(self, trash_names: list[str]) -> int:
        def _restore_sync():
            manifest = self._read_manifest()
            restored = 0

            for trash_name in trash_names:
                entry = next((e for e in manifest if e["trash_name"] == trash_name), None)
                if not entry:
                    continue

                trash_path = self.trash_dir / trash_name
                if not trash_path.exists():
                    manifest = [e for e in manifest if e["trash_name"] != trash_name]
                    continue

                original_path = self._resolve_path(entry["original_path"])

                # Recreate parent directory if needed
                original_path.parent.mkdir(parents=True, exist_ok=True)

                # Handle name collision
                dest = original_path
                if dest.exists():
                    base = dest.stem
                    ext = dest.suffix
                    counter = 1
                    while dest.exists():
                        dest = dest.parent / f"{base}({counter}){ext}"
                        counter += 1

                shutil.move(str(trash_path), str(dest))
                manifest = [e for e in manifest if e["trash_name"] != trash_name]
                restored += 1

            self._write_manifest(manifest)
            return restored

        return await asyncio.to_thread(_restore_sync)

    async def delete_permanent(self, trash_names: list[str]) -> int:
        def _delete_sync():
            manifest = self._read_manifest()
            deleted = 0

            for trash_name in trash_names:
                trash_path = self.trash_dir / trash_name
                if trash_path.exists():
                    if trash_path.is_dir():
                        shutil.rmtree(trash_path)
                    else:
                        trash_path.unlink()
                    deleted += 1

                manifest = [e for e in manifest if e["trash_name"] != trash_name]

            self._write_manifest(manifest)
            return deleted

        return await asyncio.to_thread(_delete_sync)

    async def empty_trash(self) -> int:
        def _empty_sync():
            manifest = self._read_manifest()
            deleted = 0

            for entry in manifest:
                trash_path = self.trash_dir / entry["trash_name"]
                if trash_path.exists():
                    if trash_path.is_dir():
                        shutil.rmtree(trash_path)
                    else:
                        trash_path.unlink()
                    deleted += 1

            self._write_manifest([])
            return deleted

        return await asyncio.to_thread(_empty_sync)

    async def get_info(self) -> dict:
        def _info_sync():
            manifest = self._read_manifest()
            count = 0
            total_size = 0

            for entry in manifest:
                trash_path = self.trash_dir / entry["trash_name"]
                if not trash_path.exists():
                    continue
                count += 1
                try:
                    if trash_path.is_dir():
                        for root, dirs, files in os.walk(trash_path):
                            for f in files:
                                try:
                                    total_size += (Path(root) / f).stat().st_size
                                except OSError:
                                    pass
                    else:
                        total_size += trash_path.stat().st_size
                except OSError:
                    pass

            return {"count": count, "size": total_size}

        return await asyncio.to_thread(_info_sync)
