"""Shared fixtures for backend tests."""

import os
import pytest
import pytest_asyncio
from pathlib import Path
from httpx import AsyncClient, ASGITransport

from app.services.filesystem import FilesystemService
from app.services.thumbnails import ThumbnailService


@pytest.fixture
def tmp_tree(tmp_path):
    """Create a temporary file tree for testing.

    Structure:
        tmp_path/
            root/
                file1.txt (13 bytes)
                file2.py (21 bytes)
                image.jpg (0 bytes)
                .hidden (0 bytes)
                subdir/
                    nested.txt (12 bytes)
                    deep/
                        deep_file.txt (9 bytes)
                empty_dir/
            mount_a/
                mount_file.txt (12 bytes)
    """
    root = tmp_path / "root"
    root.mkdir()

    (root / "file1.txt").write_text("Hello, world!")
    (root / "file2.py").write_text("print('hello world')")
    (root / "image.jpg").write_bytes(b"")
    (root / ".hidden").write_text("")

    subdir = root / "subdir"
    subdir.mkdir()
    (subdir / "nested.txt").write_text("nested file!")
    deep = subdir / "deep"
    deep.mkdir()
    (deep / "deep_file.txt").write_text("deep file")

    (root / "empty_dir").mkdir()

    mount_a = tmp_path / "mount_a"
    mount_a.mkdir()
    (mount_a / "mount_file.txt").write_text("mount content")

    return tmp_path


@pytest.fixture
def fs_service(tmp_tree):
    """FilesystemService rooted at tmp_tree/root with a mount at tmp_tree/mount_a."""
    root = tmp_tree / "root"
    mount_a = tmp_tree / "mount_a"
    return FilesystemService(
        root_path=str(root),
        mounts=[{"name": "MountA", "path": str(mount_a), "icon": "hard-drive"}],
    )


@pytest.fixture
def thumb_service(tmp_path):
    """ThumbnailService with a temporary cache directory."""
    cache_dir = tmp_path / "thumb_cache"
    cache_dir.mkdir()
    return ThumbnailService(
        cache_dir=str(cache_dir),
        sizes={"thumb": 256, "large": 1080},
        quality=85,
    )


@pytest_asyncio.fixture
async def client(tmp_tree):
    """FastAPI test client using httpx with a fresh app instance."""
    # Set up config to point at temp directories
    root = tmp_tree / "root"
    mount_a = tmp_tree / "mount_a"
    cache_dir = tmp_tree / "thumb_cache"
    cache_dir.mkdir(exist_ok=True)

    from app.services.filesystem import FilesystemService
    from app.services.thumbnails import ThumbnailService
    from app.services.audio import AudioMetadataService
    from app.routers import files, upload

    fs = FilesystemService(
        root_path=str(root),
        mounts=[{"name": "MountA", "path": str(mount_a), "icon": "hard-drive"}],
    )
    thumb = ThumbnailService(
        cache_dir=str(cache_dir),
        sizes={"thumb": 256, "large": 1080},
        quality=85,
    )
    audio = AudioMetadataService(root_path=root)

    files.init_services(fs, thumb, audio)
    upload.init_services(fs)

    # Import the app after services are wired
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
