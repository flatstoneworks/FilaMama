"""Unit tests for FilesystemService."""

import pytest
from pathlib import Path

from app.services.filesystem import FilesystemService, CONTENT_TYPES


# ─── _resolve_path security ──────────────────────────────────────────────────


class TestResolvePath:
    def test_normal_path(self, fs_service, tmp_tree):
        result = fs_service._resolve_path("/file1.txt")
        assert result == (tmp_tree / "root" / "file1.txt").resolve()

    def test_root_path(self, fs_service, tmp_tree):
        result = fs_service._resolve_path("/")
        assert result == (tmp_tree / "root").resolve()

    def test_nested_path(self, fs_service, tmp_tree):
        result = fs_service._resolve_path("/subdir/nested.txt")
        assert result == (tmp_tree / "root" / "subdir" / "nested.txt").resolve()

    def test_traversal_attack_dotdot(self, fs_service):
        with pytest.raises(ValueError, match="Path traversal"):
            fs_service._resolve_path("/../../../etc/passwd")

    def test_traversal_attack_encoded(self, fs_service):
        # Path.resolve() normalizes .. so this should still be caught
        with pytest.raises(ValueError, match="Path traversal"):
            fs_service._resolve_path("/subdir/../../etc/passwd")

    def test_mount_normal_path(self, fs_service, tmp_tree):
        mount_path = str(tmp_tree / "mount_a")
        result = fs_service._resolve_path(f"{mount_path}/mount_file.txt")
        assert result == (tmp_tree / "mount_a" / "mount_file.txt").resolve()

    def test_mount_traversal_escape(self, fs_service, tmp_tree):
        mount_path = str(tmp_tree / "mount_a")
        with pytest.raises(ValueError, match="Path traversal"):
            fs_service._resolve_path(f"{mount_path}/../root/file1.txt")

    def test_path_without_leading_slash(self, fs_service, tmp_tree):
        # Paths without leading slash should still resolve relative to root
        result = fs_service._resolve_path("file1.txt")
        assert result == (tmp_tree / "root" / "file1.txt").resolve()

    def test_traversal_attack_sibling_prefix(self, fs_service, tmp_tree):
        sibling = tmp_tree / "root_evil"
        sibling.mkdir()
        with pytest.raises(ValueError, match="Path traversal"):
            fs_service._resolve_path("/../root_evil")


# ─── list_directory ──────────────────────────────────────────────────────────


class TestListDirectory:
    @pytest.mark.asyncio
    async def test_list_root(self, fs_service):
        listing = await fs_service.list_directory("/")
        names = [item.name for item in listing.items]
        assert "file1.txt" in names
        assert "subdir" in names
        assert "empty_dir" in names
        # Hidden files excluded by default
        assert ".hidden" not in names

    @pytest.mark.asyncio
    async def test_list_with_hidden(self, fs_service):
        listing = await fs_service.list_directory("/", show_hidden=True)
        names = [item.name for item in listing.items]
        assert ".hidden" in names

    @pytest.mark.asyncio
    async def test_list_nonexistent(self, fs_service):
        with pytest.raises(FileNotFoundError):
            await fs_service.list_directory("/nonexistent")

    @pytest.mark.asyncio
    async def test_list_file_not_directory(self, fs_service):
        with pytest.raises(NotADirectoryError):
            await fs_service.list_directory("/file1.txt")

    @pytest.mark.asyncio
    async def test_list_sorting_name(self, fs_service):
        from app.models.schemas import SortField, SortOrder
        listing = await fs_service.list_directory("/", sort_by=SortField.NAME)
        # Directories should come first
        dirs = [i for i in listing.items if i.type.value == "directory"]
        files = [i for i in listing.items if i.type.value != "directory"]
        assert all(d.name.lower() <= d2.name.lower() for d, d2 in zip(dirs, dirs[1:]))

    @pytest.mark.asyncio
    async def test_total_items_and_size(self, fs_service):
        listing = await fs_service.list_directory("/")
        assert listing.total_items == len(listing.items)
        assert listing.total_items > 0


# ─── search ──────────────────────────────────────────────────────────────────


class TestSearch:
    @pytest.mark.asyncio
    async def test_search_by_name(self, fs_service):
        results, has_more, total = await fs_service.search("file1", "/")
        names = [r.name for r in results]
        assert "file1.txt" in names

    @pytest.mark.asyncio
    async def test_search_recursive(self, fs_service):
        results, has_more, total = await fs_service.search("nested", "/")
        names = [r.name for r in results]
        assert "nested.txt" in names

    @pytest.mark.asyncio
    async def test_search_content_type(self, fs_service, tmp_tree):
        # Create some files for content type search
        (tmp_tree / "root" / "photo.jpg").write_bytes(b"\xff\xd8\xff")
        (tmp_tree / "root" / "subdir" / "photo2.png").write_bytes(b"\x89PNG")

        results, has_more, total = await fs_service.search(
            query="", path="/", content_type="photos"
        )
        names = [r.name for r in results]
        assert "photo.jpg" in names
        assert "photo2.png" in names
        # Non-photo files excluded
        assert "file1.txt" not in names

    @pytest.mark.asyncio
    async def test_search_max_results(self, fs_service, tmp_tree):
        # Create many files
        for i in range(10):
            (tmp_tree / "root" / f"bulk_{i}.txt").write_text(f"file {i}")

        results, has_more, total = await fs_service.search("bulk", "/", max_results=3)
        assert len(results) == 3
        assert has_more is True

    @pytest.mark.asyncio
    async def test_search_empty_query_with_content_type(self, fs_service, tmp_tree):
        (tmp_tree / "root" / "song.mp3").write_bytes(b"fake mp3")
        results, _, _ = await fs_service.search("", "/", content_type="audio")
        names = [r.name for r in results]
        assert "song.mp3" in names

    @pytest.mark.asyncio
    async def test_search_no_results(self, fs_service):
        results, has_more, total = await fs_service.search("zzz_nonexistent_zzz", "/")
        assert results == []


# ─── File operations ─────────────────────────────────────────────────────────


class TestFileOperations:
    @pytest.mark.asyncio
    async def test_create_directory(self, fs_service, tmp_tree):
        result = await fs_service.create_directory("/", "new_folder")
        assert result.name == "new_folder"
        assert (tmp_tree / "root" / "new_folder").is_dir()

    @pytest.mark.asyncio
    async def test_create_existing_directory(self, fs_service):
        with pytest.raises(FileExistsError):
            await fs_service.create_directory("/", "subdir")

    @pytest.mark.asyncio
    async def test_create_directory_rejects_nested_name(self, fs_service):
        with pytest.raises(ValueError, match="Invalid directory name"):
            await fs_service.create_directory("/", "../escape")

    @pytest.mark.asyncio
    async def test_delete_file(self, fs_service, tmp_tree):
        assert (tmp_tree / "root" / "file1.txt").exists()
        count = await fs_service.delete(["/file1.txt"])
        assert count == 1
        assert not (tmp_tree / "root" / "file1.txt").exists()

    @pytest.mark.asyncio
    async def test_delete_directory(self, fs_service, tmp_tree):
        count = await fs_service.delete(["/empty_dir"])
        assert count == 1
        assert not (tmp_tree / "root" / "empty_dir").exists()

    @pytest.mark.asyncio
    async def test_delete_nonexistent(self, fs_service):
        count = await fs_service.delete(["/nonexistent.txt"])
        assert count == 0

    @pytest.mark.asyncio
    async def test_rename(self, fs_service, tmp_tree):
        result = await fs_service.rename("/file1.txt", "renamed.txt")
        assert result.name == "renamed.txt"
        assert (tmp_tree / "root" / "renamed.txt").exists()
        assert not (tmp_tree / "root" / "file1.txt").exists()

    @pytest.mark.asyncio
    async def test_rename_to_existing(self, fs_service):
        with pytest.raises(FileExistsError):
            await fs_service.rename("/file1.txt", "file2.py")

    @pytest.mark.asyncio
    async def test_rename_rejects_nested_name(self, fs_service):
        with pytest.raises(ValueError, match="Invalid name"):
            await fs_service.rename("/file1.txt", "../escape.txt")

    @pytest.mark.asyncio
    async def test_copy_file(self, fs_service, tmp_tree):
        result = await fs_service.copy("/file1.txt", "/empty_dir")
        assert result.name == "file1.txt"
        assert (tmp_tree / "root" / "empty_dir" / "file1.txt").exists()
        # Original still exists
        assert (tmp_tree / "root" / "file1.txt").exists()

    @pytest.mark.asyncio
    async def test_copy_auto_rename(self, fs_service, tmp_tree):
        # Copy file1.txt to root (same dir) — should auto-rename
        (tmp_tree / "root" / "dest_dir").mkdir()
        (tmp_tree / "root" / "dest_dir" / "file1.txt").write_text("existing")
        result = await fs_service.copy("/file1.txt", "/dest_dir")
        assert result.name == "file1(1).txt"

    @pytest.mark.asyncio
    async def test_move_file(self, fs_service, tmp_tree):
        result = await fs_service.move("/file1.txt", "/empty_dir")
        assert result.name == "file1.txt"
        assert (tmp_tree / "root" / "empty_dir" / "file1.txt").exists()
        assert not (tmp_tree / "root" / "file1.txt").exists()

    @pytest.mark.asyncio
    async def test_check_conflicts(self, fs_service, tmp_tree):
        (tmp_tree / "root" / "empty_dir" / "file1.txt").write_text("conflict")
        conflicts = await fs_service.check_conflicts(["/file1.txt"], "/empty_dir")
        assert "/file1.txt" in conflicts

    @pytest.mark.asyncio
    async def test_check_no_conflicts(self, fs_service):
        conflicts = await fs_service.check_conflicts(["/file1.txt"], "/empty_dir")
        assert conflicts == []

    @pytest.mark.asyncio
    async def test_get_folder_size(self, fs_service):
        size = await fs_service.get_folder_size("/subdir")
        # nested.txt (12) + deep_file.txt (9) = 21
        assert size == 21

    @pytest.mark.asyncio
    async def test_get_file_info(self, fs_service):
        info = await fs_service.get_file_info("/file1.txt")
        assert info.name == "file1.txt"
        assert info.size == 13  # "Hello, world!" = 13 bytes

    @pytest.mark.asyncio
    async def test_get_file_info_nonexistent(self, fs_service):
        with pytest.raises(FileNotFoundError):
            await fs_service.get_file_info("/nonexistent.txt")
