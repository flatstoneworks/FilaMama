"""Integration tests for API endpoints."""

import pytest
from pathlib import Path


# ─── List / Info endpoints ───────────────────────────────────────────────────


class TestListEndpoint:
    @pytest.mark.asyncio
    async def test_list_root(self, client):
        response = await client.get("/api/files/list", params={"path": "/"})
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "path" in data
        names = [item["name"] for item in data["items"]]
        assert "file1.txt" in names

    @pytest.mark.asyncio
    async def test_list_nonexistent(self, client):
        response = await client.get("/api/files/list", params={"path": "/nonexistent"})
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_list_file_as_dir(self, client):
        response = await client.get("/api/files/list", params={"path": "/file1.txt"})
        assert response.status_code == 400


class TestInfoEndpoint:
    @pytest.mark.asyncio
    async def test_file_info(self, client):
        response = await client.get("/api/files/info", params={"path": "/file1.txt"})
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "file1.txt"
        assert data["size"] == 13

    @pytest.mark.asyncio
    async def test_file_info_not_found(self, client):
        response = await client.get("/api/files/info", params={"path": "/nope.txt"})
        assert response.status_code == 404


# ─── Search endpoints ────────────────────────────────────────────────────────


class TestSearchEndpoint:
    @pytest.mark.asyncio
    async def test_search_files(self, client):
        response = await client.get(
            "/api/files/search", params={"query": "file1", "path": "/"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        names = [r["name"] for r in data["results"]]
        assert "file1.txt" in names

    @pytest.mark.asyncio
    async def test_search_with_content_type(self, client, tmp_tree):
        (tmp_tree / "root" / "test.mp3").write_bytes(b"mp3data")
        response = await client.get(
            "/api/files/search",
            params={"content_type": "audio", "path": "/"},
        )
        assert response.status_code == 200
        data = response.json()
        names = [r["name"] for r in data["results"]]
        assert "test.mp3" in names

    @pytest.mark.asyncio
    async def test_search_content_min_query(self, client):
        response = await client.get(
            "/api/files/search-content", params={"query": "x", "path": "/"}
        )
        assert response.status_code == 400  # min 2 chars

    @pytest.mark.asyncio
    async def test_search_content_valid(self, client):
        response = await client.get(
            "/api/files/search-content", params={"query": "Hello", "path": "/"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert "files_searched" in data


# ─── File operations endpoints ───────────────────────────────────────────────


class TestFileOperationEndpoints:
    @pytest.mark.asyncio
    async def test_mkdir(self, client, tmp_tree):
        response = await client.post(
            "/api/files/mkdir",
            json={"path": "/", "name": "test_new_dir"},
        )
        assert response.status_code == 200
        assert (tmp_tree / "root" / "test_new_dir").is_dir()

    @pytest.mark.asyncio
    async def test_rename(self, client, tmp_tree):
        response = await client.post(
            "/api/files/rename",
            json={"path": "/file1.txt", "new_name": "api_renamed.txt"},
        )
        assert response.status_code == 200
        assert (tmp_tree / "root" / "api_renamed.txt").exists()

    @pytest.mark.asyncio
    async def test_delete(self, client, tmp_tree):
        response = await client.post(
            "/api/files/delete",
            json={"paths": ["/file1.txt"]},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["deleted"] == 1

    @pytest.mark.asyncio
    async def test_copy(self, client, tmp_tree):
        response = await client.post(
            "/api/files/copy",
            json={"source": "/file1.txt", "destination": "/empty_dir"},
        )
        assert response.status_code == 200
        assert (tmp_tree / "root" / "empty_dir" / "file1.txt").exists()

    @pytest.mark.asyncio
    async def test_move(self, client, tmp_tree):
        response = await client.post(
            "/api/files/move",
            json={"source": "/file2.py", "destination": "/empty_dir"},
        )
        assert response.status_code == 200
        assert (tmp_tree / "root" / "empty_dir" / "file2.py").exists()
        assert not (tmp_tree / "root" / "file2.py").exists()

    @pytest.mark.asyncio
    async def test_check_conflicts(self, client, tmp_tree):
        # Create a conflict
        (tmp_tree / "root" / "empty_dir" / "file1.txt").write_text("existing")
        response = await client.post(
            "/api/files/check-conflicts",
            json={"sources": ["/file1.txt"], "destination": "/empty_dir"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "/file1.txt" in data["conflicts"]


# ─── Upload endpoint ─────────────────────────────────────────────────────────


class TestUploadEndpoint:
    @pytest.mark.asyncio
    async def test_upload_file(self, client, tmp_tree):
        response = await client.post(
            "/api/upload",
            files={"files": ("test_upload.txt", b"upload content", "text/plain")},
            data={"path": "/"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == 1
        assert (tmp_tree / "root" / "test_upload.txt").exists()

    @pytest.mark.asyncio
    async def test_upload_path_traversal_filename(self, client, tmp_tree):
        """Upload with path traversal in filename should be sanitized."""
        response = await client.post(
            "/api/upload",
            files={"files": ("../../../etc/passwd", b"evil", "text/plain")},
            data={"path": "/"},
        )
        assert response.status_code == 200
        # File should NOT end up outside root
        assert not (tmp_tree / "etc" / "passwd").exists()

    @pytest.mark.asyncio
    async def test_upload_path_traversal_relative_path(self, client, tmp_tree):
        """Upload with path traversal in relative_paths should be rejected."""
        response = await client.post(
            "/api/upload",
            files={"files": ("evil.txt", b"evil", "text/plain")},
            data={"path": "/", "relative_paths": "../../etc/evil.txt"},
        )
        assert response.status_code == 400
        # File should NOT end up outside root
        assert not (tmp_tree / "etc" / "evil.txt").exists()

    @pytest.mark.asyncio
    async def test_upload_to_nonexistent_dir(self, client):
        response = await client.post(
            "/api/upload",
            files={"files": ("test.txt", b"data", "text/plain")},
            data={"path": "/nonexistent_dir"},
        )
        assert response.status_code == 404


# ─── Trash endpoints ──────────────────────────────────────────────────────────


class TestTrashEndpoints:
    @pytest.mark.asyncio
    async def test_move_to_trash_and_restore(self, client, tmp_tree):
        response = await client.post(
            "/api/trash/move-to-trash",
            json={"paths": ["/file1.txt"]},
        )
        assert response.status_code == 200
        assert not (tmp_tree / "root" / "file1.txt").exists()

        listing = await client.get("/api/trash/list")
        assert listing.status_code == 200
        items = listing.json()["items"]
        assert len(items) == 1

        restore = await client.post(
            "/api/trash/restore",
            json={"paths": [items[0]["name"]]},
        )
        assert restore.status_code == 200
        assert (tmp_tree / "root" / "file1.txt").exists()

    @pytest.mark.asyncio
    async def test_move_mount_file_to_trash_and_restore(self, client, tmp_tree):
        mount_file = (tmp_tree / "mount_a" / "mount_file.txt").resolve()
        response = await client.post(
            "/api/trash/move-to-trash",
            json={"paths": [str(mount_file)]},
        )
        assert response.status_code == 200
        assert not mount_file.exists()

        listing = await client.get("/api/trash/list")
        items = listing.json()["items"]
        mount_item = next(item for item in items if item["original_name"] == "mount_file.txt")

        restore = await client.post(
            "/api/trash/restore",
            json={"paths": [mount_item["name"]]},
        )
        assert restore.status_code == 200
        assert mount_file.exists()


# ─── Agent endpoints ─────────────────────────────────────────────────────────


class TestAgentEndpoints:
    @pytest.mark.asyncio
    async def test_create_text_artifact_metadata_and_search(self, client, tmp_tree):
        response = await client.post(
            "/api/agent/artifacts/text",
            headers={
                "X-FilaMama-Actor-Id": "hermes",
                "X-FilaMama-Actor-Type": "agent",
                "X-FilaMama-Actor-Name": "Hermes",
            },
            json={
                "path": "/agent-report.md",
                "content": "# Agent report\n",
                "metadata": {
                    "title": "Hermes report",
                    "description": "Generated research artifact",
                    "source_type": "generated_text",
                    "provider": "Hermes",
                    "model": "hermes-v1",
                    "prompt_summary": "Summarize the workspace",
                    "labels": ["agent", "report"],
                },
            },
        )
        assert response.status_code == 200
        assert (tmp_tree / "root" / "agent-report.md").exists()

        artifact = await client.get("/api/agent/artifacts", params={"path": "/agent-report.md"})
        assert artifact.status_code == 200
        data = artifact.json()["artifact"]
        assert data["provider"] == "Hermes"
        assert data["labels"] == ["agent", "report"]

        search = await client.get(
            "/api/files/search",
            params={"query": "workspace", "path": "/"},
        )
        assert search.status_code == 200
        results = search.json()["results"]
        hit = next(item for item in results if item["path"] == "/agent-report.md")
        assert hit["match_reason"] == "metadata"

        activity = await client.get("/api/agent/activity", params={"path": "/agent-report.md"})
        assert activity.status_code == 200
        assert activity.json()["items"][0]["actor"]["id"] == "hermes"

    @pytest.mark.asyncio
    async def test_agent_create_existing_file_conflicts(self, client):
        response = await client.post(
            "/api/agent/artifacts/text",
            json={
                "path": "/file1.txt",
                "content": "replacement",
                "metadata": {"title": "Should conflict"},
            },
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_agent_create_text_artifact_rejects_private_dir(self, client, tmp_tree):
        response = await client.post(
            "/api/agent/artifacts/text",
            json={
                "path": "/.filamama/private.md",
                "content": "should not write",
                "metadata": {"title": "Private"},
            },
        )
        assert response.status_code == 403
        assert not (tmp_tree / "root" / ".filamama" / "private.md").exists()

    @pytest.mark.asyncio
    async def test_filamama_private_dir_is_protected(self, client):
        # Initialize the agent DB, then verify normal file APIs cannot enter it.
        response = await client.post(
            "/api/agent/artifacts/text",
            json={"path": "/created.txt", "content": "ok", "metadata": {}},
        )
        assert response.status_code == 200

        listing = await client.get("/api/files/list", params={"path": "/.filamama"})
        assert listing.status_code == 403

        info = await client.get("/api/files/info", params={"path": "/.filamama/filamama.db"})
        assert info.status_code == 403

        upload = await client.post(
            "/api/upload",
            files={"files": ("x.txt", b"x", "text/plain")},
            data={"path": "/.filamama"},
        )
        assert upload.status_code == 403

    @pytest.mark.asyncio
    async def test_proposal_does_not_mutate_until_approved(self, client, tmp_tree):
        proposal = await client.post(
            "/api/agent/proposals",
            headers={"X-FilaMama-Actor-Id": "hermes", "X-FilaMama-Actor-Type": "agent"},
            json={
                "operation": "rename",
                "paths": ["/file1.txt"],
                "params": {"new_name": "approved.txt"},
                "summary": "Rename file1 after review",
            },
        )
        assert proposal.status_code == 200
        proposal_id = proposal.json()["proposal"]["id"]
        assert (tmp_tree / "root" / "file1.txt").exists()
        assert not (tmp_tree / "root" / "approved.txt").exists()

        same_agent = await client.post(
            f"/api/agent/proposals/{proposal_id}/approve",
            headers={"X-FilaMama-Actor-Id": "hermes", "X-FilaMama-Actor-Type": "agent"},
        )
        assert same_agent.status_code == 403
        assert (tmp_tree / "root" / "file1.txt").exists()
        assert not (tmp_tree / "root" / "approved.txt").exists()

        approved = await client.post(f"/api/agent/proposals/{proposal_id}/approve")
        assert approved.status_code == 200
        assert (tmp_tree / "root" / "approved.txt").exists()

    @pytest.mark.asyncio
    async def test_agent_path_filters_match_exact_json_path(self, client):
        foo = await client.post(
            "/api/agent/artifacts/text",
            json={"path": "/foo.txt", "content": "foo", "metadata": {"title": "Foo"}},
        )
        assert foo.status_code == 200
        foobar = await client.post(
            "/api/agent/artifacts/text",
            json={"path": "/foo-bar.txt", "content": "foo bar", "metadata": {"title": "Foo bar"}},
        )
        assert foobar.status_code == 200

        activity = await client.get("/api/agent/activity", params={"path": "/foo.txt"})
        assert activity.status_code == 200
        paths = [event["paths"][0] for event in activity.json()["items"]]
        assert "/foo.txt" in paths
        assert "/foo-bar.txt" not in paths


# ─── Stream / Download endpoints ─────────────────────────────────────────────


class TestStreamEndpoint:
    @pytest.mark.asyncio
    async def test_stream_full_file(self, client):
        response = await client.get(
            "/api/files/stream", params={"path": "/file1.txt"}
        )
        assert response.status_code == 200
        assert response.headers.get("accept-ranges") == "bytes"

    @pytest.mark.asyncio
    async def test_stream_range_request(self, client):
        response = await client.get(
            "/api/files/stream",
            params={"path": "/file1.txt"},
            headers={"Range": "bytes=0-4"},
        )
        assert response.status_code == 206
        assert response.headers.get("content-range").startswith("bytes 0-4/")
        assert response.text == "Hello"

    @pytest.mark.asyncio
    async def test_stream_not_found(self, client):
        response = await client.get(
            "/api/files/stream", params={"path": "/nonexistent.txt"}
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_download(self, client):
        response = await client.get(
            "/api/files/download", params={"path": "/file1.txt"}
        )
        assert response.status_code == 200


# ─── Health / Config ─────────────────────────────────────────────────────────


class TestHealthConfig:
    @pytest.mark.asyncio
    async def test_health(self, client):
        response = await client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
