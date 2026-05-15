import asyncio
import json
import logging
import shutil
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

from ..models.schemas import Actor, ArtifactMetadataInput, FileInfo, SearchResult
from ..utils.paths import generate_unique_path

logger = logging.getLogger(__name__)

AGENT_DIR_NAME = ".filamama"
DB_NAME = "filamama.db"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _json_loads(value: Optional[str], fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return fallback


class AgentService:
    """SQLite-backed collaboration and artifact layer for agents."""

    def __init__(self, filesystem_service, trash_service=None):
        self.fs = filesystem_service
        self.trash = trash_service
        self.root_path = filesystem_service.root_path
        self.agent_dir = self.root_path / AGENT_DIR_NAME
        self.db_path = self.agent_dir / DB_NAME
        self._init_lock = asyncio.Lock()
        self._write_lock = asyncio.Lock()
        self._initialized = False
        self._fts_enabled = True

    async def ensure_initialized(self) -> None:
        if self._initialized:
            return
        async with self._init_lock:
            if self._initialized:
                return
            await asyncio.to_thread(self._init_db)
            self._initialized = True

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout = 5000")
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_db(self) -> None:
        self.agent_dir.mkdir(mode=0o700, exist_ok=True)
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS activity_events (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    actor_id TEXT NOT NULL,
                    actor_type TEXT NOT NULL,
                    actor_name TEXT NOT NULL,
                    action TEXT NOT NULL,
                    paths_json TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    metadata_json TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_events(timestamp DESC);

                CREATE TABLE IF NOT EXISTS artifact_metadata (
                    path TEXT PRIMARY KEY,
                    title TEXT,
                    description TEXT,
                    source_type TEXT,
                    source_url TEXT,
                    provider TEXT,
                    model TEXT,
                    prompt_summary TEXT,
                    labels_json TEXT NOT NULL DEFAULT '[]',
                    task_id TEXT,
                    metadata_json TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    created_by TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    path TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    actor_id TEXT NOT NULL,
                    actor_type TEXT NOT NULL,
                    actor_name TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
                CREATE INDEX IF NOT EXISTS idx_tasks_path ON tasks(path);

                CREATE TABLE IF NOT EXISTS notes (
                    id TEXT PRIMARY KEY,
                    path TEXT NOT NULL,
                    body TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    actor_id TEXT NOT NULL,
                    actor_type TEXT NOT NULL,
                    actor_name TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_notes_path ON notes(path);

                CREATE TABLE IF NOT EXISTS leases (
                    id TEXT PRIMARY KEY,
                    path TEXT NOT NULL,
                    purpose TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    actor_id TEXT NOT NULL,
                    actor_type TEXT NOT NULL,
                    actor_name TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_leases_path ON leases(path);
                CREATE INDEX IF NOT EXISTS idx_leases_expires ON leases(expires_at);

                CREATE TABLE IF NOT EXISTS proposals (
                    id TEXT PRIMARY KEY,
                    operation TEXT NOT NULL,
                    status TEXT NOT NULL,
                    paths_json TEXT NOT NULL,
                    params_json TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    reason TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    actor_id TEXT NOT NULL,
                    actor_type TEXT NOT NULL,
                    actor_name TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
                """
            )
            try:
                conn.execute(
                    """
                    CREATE VIRTUAL TABLE IF NOT EXISTS artifact_fts USING fts5(
                        path UNINDEXED,
                        title,
                        description,
                        source_type,
                        source_url,
                        provider,
                        model,
                        prompt_summary,
                        labels,
                        notes
                    )
                    """
                )
                self._fts_enabled = True
            except sqlite3.OperationalError:
                self._fts_enabled = False
                logger.warning("SQLite FTS5 unavailable; artifact metadata search will use LIKE fallback")

    def _actor_columns(self, actor: Actor) -> tuple[str, str, str]:
        return actor.id, actor.type.value if hasattr(actor.type, "value") else str(actor.type), actor.name

    def _resolve_existing_path(self, path: str) -> Path:
        file_path = self.fs.get_absolute_path(path)
        if not file_path.exists():
            raise FileNotFoundError(f"Path not found: {path}")
        return file_path

    def _resolve_new_path(self, path: str) -> Path:
        file_path = self.fs.get_absolute_path(path)
        if file_path.exists():
            raise FileExistsError(f"Path already exists: {path}")
        if not file_path.name or file_path.name in (".", ".."):
            raise ValueError(f"Invalid path: {path}")
        if not file_path.parent.exists():
            raise FileNotFoundError(f"Parent directory not found: {path}")
        if not file_path.parent.is_dir():
            raise NotADirectoryError(f"Parent is not a directory: {path}")
        return file_path

    def _public_path(self, path: Path) -> str:
        return self.fs.get_relative_path(path)

    def _row_to_activity(self, row: sqlite3.Row) -> dict:
        return {
            "id": row["id"],
            "timestamp": row["timestamp"],
            "actor": {
                "id": row["actor_id"],
                "type": row["actor_type"],
                "name": row["actor_name"],
            },
            "action": row["action"],
            "paths": _json_loads(row["paths_json"], []),
            "summary": row["summary"],
            "metadata": _json_loads(row["metadata_json"], {}),
        }

    def _row_to_artifact(self, row: sqlite3.Row) -> dict:
        return {
            "path": row["path"],
            "title": row["title"],
            "description": row["description"],
            "source_type": row["source_type"],
            "source_url": row["source_url"],
            "provider": row["provider"],
            "model": row["model"],
            "prompt_summary": row["prompt_summary"],
            "labels": _json_loads(row["labels_json"], []),
            "task_id": row["task_id"],
            "metadata": _json_loads(row["metadata_json"], {}),
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "created_by": row["created_by"],
        }

    def _row_to_task(self, row: sqlite3.Row) -> dict:
        return {
            "id": row["id"],
            "path": row["path"],
            "title": row["title"],
            "description": row["description"],
            "status": row["status"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "actor": {"id": row["actor_id"], "type": row["actor_type"], "name": row["actor_name"]},
        }

    def _row_to_note(self, row: sqlite3.Row) -> dict:
        return {
            "id": row["id"],
            "path": row["path"],
            "body": row["body"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "actor": {"id": row["actor_id"], "type": row["actor_type"], "name": row["actor_name"]},
        }

    def _row_to_lease(self, row: sqlite3.Row) -> dict:
        return {
            "id": row["id"],
            "path": row["path"],
            "purpose": row["purpose"],
            "expires_at": row["expires_at"],
            "created_at": row["created_at"],
            "actor": {"id": row["actor_id"], "type": row["actor_type"], "name": row["actor_name"]},
        }

    def _row_to_proposal(self, row: sqlite3.Row) -> dict:
        return {
            "id": row["id"],
            "operation": row["operation"],
            "status": row["status"],
            "paths": _json_loads(row["paths_json"], []),
            "params": _json_loads(row["params_json"], {}),
            "summary": row["summary"],
            "reason": row["reason"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "actor": {"id": row["actor_id"], "type": row["actor_type"], "name": row["actor_name"]},
        }

    def _upsert_artifact_sync(
        self,
        conn: sqlite3.Connection,
        path: str,
        metadata: ArtifactMetadataInput,
        actor: Actor,
    ) -> dict:
        now = _now()
        existing = conn.execute(
            "SELECT created_at, created_by FROM artifact_metadata WHERE path = ?", (path,)
        ).fetchone()
        created_at = existing["created_at"] if existing else now
        created_by = existing["created_by"] if existing else actor.id
        conn.execute(
            """
            INSERT INTO artifact_metadata (
                path, title, description, source_type, source_url, provider, model,
                prompt_summary, labels_json, task_id, metadata_json,
                created_at, updated_at, created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(path) DO UPDATE SET
                title = excluded.title,
                description = excluded.description,
                source_type = excluded.source_type,
                source_url = excluded.source_url,
                provider = excluded.provider,
                model = excluded.model,
                prompt_summary = excluded.prompt_summary,
                labels_json = excluded.labels_json,
                task_id = excluded.task_id,
                metadata_json = excluded.metadata_json,
                updated_at = excluded.updated_at
            """,
            (
                path,
                metadata.title,
                metadata.description,
                metadata.source_type,
                metadata.source_url,
                metadata.provider,
                metadata.model,
                metadata.prompt_summary,
                _json_dumps(metadata.labels),
                metadata.task_id,
                _json_dumps(metadata.metadata),
                created_at,
                now,
                created_by,
            ),
        )
        self._refresh_fts_sync(conn, path)
        row = conn.execute("SELECT * FROM artifact_metadata WHERE path = ?", (path,)).fetchone()
        return self._row_to_artifact(row)

    def _refresh_fts_sync(self, conn: sqlite3.Connection, path: str) -> None:
        if not self._fts_enabled:
            return
        artifact = conn.execute("SELECT * FROM artifact_metadata WHERE path = ?", (path,)).fetchone()
        notes = conn.execute("SELECT body FROM notes WHERE path = ?", (path,)).fetchall()
        try:
            conn.execute("DELETE FROM artifact_fts WHERE path = ?", (path,))
            if artifact or notes:
                conn.execute(
                    """
                    INSERT INTO artifact_fts (
                        path, title, description, source_type, source_url,
                        provider, model, prompt_summary, labels, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        path,
                        artifact["title"] or "" if artifact else "",
                        artifact["description"] or "" if artifact else "",
                        artifact["source_type"] or "" if artifact else "",
                        artifact["source_url"] or "" if artifact else "",
                        artifact["provider"] or "" if artifact else "",
                        artifact["model"] or "" if artifact else "",
                        artifact["prompt_summary"] or "" if artifact else "",
                        " ".join(_json_loads(artifact["labels_json"], [])) if artifact else "",
                        "\n".join(row["body"] for row in notes),
                    ),
                )
        except sqlite3.OperationalError:
            self._fts_enabled = False

    def _record_activity_sync(
        self,
        conn: sqlite3.Connection,
        actor: Actor,
        action: str,
        paths: list[str],
        summary: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict:
        event_id = str(uuid.uuid4())
        actor_id, actor_type, actor_name = self._actor_columns(actor)
        conn.execute(
            """
            INSERT INTO activity_events (
                id, timestamp, actor_id, actor_type, actor_name,
                action, paths_json, summary, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event_id,
                _now(),
                actor_id,
                actor_type,
                actor_name,
                action,
                _json_dumps(paths),
                summary,
                _json_dumps(metadata or {}),
            ),
        )
        row = conn.execute("SELECT * FROM activity_events WHERE id = ?", (event_id,)).fetchone()
        return self._row_to_activity(row)

    async def record_activity(
        self,
        actor: Actor,
        action: str,
        paths: list[str],
        summary: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict:
        await self.ensure_initialized()

        def _sync():
            with self._connect() as conn:
                return self._record_activity_sync(conn, actor, action, paths, summary, metadata)

        async with self._write_lock:
            return await asyncio.to_thread(_sync)

    async def create_text_artifact(
        self,
        path: str,
        content: str,
        metadata: ArtifactMetadataInput,
        actor: Actor,
    ) -> dict:
        await self.ensure_initialized()
        target = self._resolve_new_path(path)
        target.write_text(content, encoding="utf-8")
        public_path = self._public_path(target)

        def _sync():
            with self._connect() as conn:
                artifact = self._upsert_artifact_sync(conn, public_path, metadata, actor)
                self._record_activity_sync(
                    conn,
                    actor,
                    "agent.artifact.create_text",
                    [public_path],
                    f"Created text artifact {target.name}",
                    {"size": target.stat().st_size},
                )
                return artifact

        async with self._write_lock:
            return await asyncio.to_thread(_sync)

    async def create_uploaded_artifact(
        self,
        path: str,
        source_path: Path,
        metadata: ArtifactMetadataInput,
        actor: Actor,
    ) -> dict:
        await self.ensure_initialized()
        target = self._resolve_new_path(path)
        shutil.move(str(source_path), str(target))
        public_path = self._public_path(target)

        def _sync():
            with self._connect() as conn:
                artifact = self._upsert_artifact_sync(conn, public_path, metadata, actor)
                self._record_activity_sync(
                    conn,
                    actor,
                    "agent.artifact.upload",
                    [public_path],
                    f"Uploaded artifact {target.name}",
                    {"size": target.stat().st_size},
                )
                return artifact

        async with self._write_lock:
            return await asyncio.to_thread(_sync)

    async def create_folder(self, path: str, metadata: ArtifactMetadataInput, actor: Actor) -> dict:
        await self.ensure_initialized()
        target = self._resolve_new_path(path)
        target.mkdir()
        public_path = self._public_path(target)

        def _sync():
            with self._connect() as conn:
                artifact = self._upsert_artifact_sync(conn, public_path, metadata, actor)
                self._record_activity_sync(
                    conn,
                    actor,
                    "agent.folder.create",
                    [public_path],
                    f"Created folder {target.name}",
                )
                return artifact

        async with self._write_lock:
            return await asyncio.to_thread(_sync)

    async def get_artifact(self, path: str) -> Optional[dict]:
        await self.ensure_initialized()
        file_path = self._resolve_existing_path(path)
        public_path = self._public_path(file_path)

        def _sync():
            with self._connect() as conn:
                row = conn.execute("SELECT * FROM artifact_metadata WHERE path = ?", (public_path,)).fetchone()
                return self._row_to_artifact(row) if row else None

        return await asyncio.to_thread(_sync)

    async def update_artifact(self, path: str, metadata: ArtifactMetadataInput, actor: Actor) -> dict:
        await self.ensure_initialized()
        file_path = self._resolve_existing_path(path)
        public_path = self._public_path(file_path)

        def _sync():
            with self._connect() as conn:
                artifact = self._upsert_artifact_sync(conn, public_path, metadata, actor)
                self._record_activity_sync(
                    conn,
                    actor,
                    "agent.artifact.metadata.update",
                    [public_path],
                    f"Updated context for {file_path.name}",
                )
                return artifact

        async with self._write_lock:
            return await asyncio.to_thread(_sync)

    async def list_recent_artifacts(self, limit: int = 20) -> list[dict]:
        await self.ensure_initialized()

        def _sync():
            with self._connect() as conn:
                rows = conn.execute(
                    "SELECT * FROM artifact_metadata ORDER BY updated_at DESC LIMIT ?",
                    (limit,),
                ).fetchall()
                return [self._row_to_artifact(row) for row in rows]

        return await asyncio.to_thread(_sync)

    async def get_activity(self, path: Optional[str] = None, limit: int = 50, cursor: Optional[str] = None) -> dict:
        await self.ensure_initialized()
        public_path = None
        if path:
            public_path = self._public_path(self.fs.get_absolute_path(path))

        def _sync():
            with self._connect() as conn:
                clauses = []
                params: list[Any] = []
                if cursor:
                    clauses.append("timestamp < ?")
                    params.append(cursor)
                if public_path:
                    clauses.append("paths_json LIKE ?")
                    params.append(f"%{public_path}%")
                where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
                rows = conn.execute(
                    f"SELECT * FROM activity_events {where} ORDER BY timestamp DESC LIMIT ?",
                    (*params, limit + 1),
                ).fetchall()
                has_more = len(rows) > limit
                rows = rows[:limit]
                items = [self._row_to_activity(row) for row in rows]
                next_cursor = items[-1]["timestamp"] if has_more and items else None
                return {"items": items, "has_more": has_more, "next_cursor": next_cursor}

        return await asyncio.to_thread(_sync)

    async def create_task(self, path: str, title: str, description: Optional[str], status: str, actor: Actor) -> dict:
        await self.ensure_initialized()
        public_path = self._public_path(self.fs.get_absolute_path(path))
        task_id = str(uuid.uuid4())
        now = _now()
        actor_id, actor_type, actor_name = self._actor_columns(actor)

        def _sync():
            with self._connect() as conn:
                conn.execute(
                    """
                    INSERT INTO tasks (
                        id, path, title, description, status, created_at, updated_at,
                        actor_id, actor_type, actor_name
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (task_id, public_path, title, description, status, now, now, actor_id, actor_type, actor_name),
                )
                self._record_activity_sync(conn, actor, "agent.task.create", [public_path], f"Created task: {title}")
                return self._row_to_task(conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone())

        async with self._write_lock:
            return await asyncio.to_thread(_sync)

    async def list_tasks(self, path: Optional[str] = None, status: Optional[str] = None) -> list[dict]:
        await self.ensure_initialized()
        public_path = self._public_path(self.fs.get_absolute_path(path)) if path else None

        def _sync():
            with self._connect() as conn:
                clauses = []
                params = []
                if public_path:
                    clauses.append("path = ?")
                    params.append(public_path)
                if status:
                    clauses.append("status = ?")
                    params.append(status)
                where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
                rows = conn.execute(
                    f"SELECT * FROM tasks {where} ORDER BY updated_at DESC",
                    params,
                ).fetchall()
                return [self._row_to_task(row) for row in rows]

        return await asyncio.to_thread(_sync)

    async def update_task(self, task_id: str, updates: dict[str, Any], actor: Actor) -> dict:
        await self.ensure_initialized()

        def _sync():
            with self._connect() as conn:
                row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
                if not row:
                    raise FileNotFoundError(f"Task not found: {task_id}")
                fields = []
                params: list[Any] = []
                for key in ("title", "description", "status", "path"):
                    if key in updates and updates[key] is not None:
                        value = updates[key]
                        if key == "path":
                            value = self._public_path(self.fs.get_absolute_path(value))
                        fields.append(f"{key} = ?")
                        params.append(value)
                fields.append("updated_at = ?")
                params.append(_now())
                params.append(task_id)
                conn.execute(f"UPDATE tasks SET {', '.join(fields)} WHERE id = ?", params)
                updated = self._row_to_task(conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone())
                self._record_activity_sync(
                    conn,
                    actor,
                    "agent.task.update",
                    [updated["path"]],
                    f"Updated task: {updated['title']}",
                    {"task_id": task_id},
                )
                return updated

        async with self._write_lock:
            return await asyncio.to_thread(_sync)

    async def create_note(self, path: str, body: str, actor: Actor) -> dict:
        await self.ensure_initialized()
        public_path = self._public_path(self.fs.get_absolute_path(path))
        note_id = str(uuid.uuid4())
        now = _now()
        actor_id, actor_type, actor_name = self._actor_columns(actor)

        def _sync():
            with self._connect() as conn:
                conn.execute(
                    """
                    INSERT INTO notes (
                        id, path, body, created_at, updated_at,
                        actor_id, actor_type, actor_name
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (note_id, public_path, body, now, now, actor_id, actor_type, actor_name),
                )
                self._refresh_fts_sync(conn, public_path)
                self._record_activity_sync(conn, actor, "agent.note.create", [public_path], "Added note")
                return self._row_to_note(conn.execute("SELECT * FROM notes WHERE id = ?", (note_id,)).fetchone())

        async with self._write_lock:
            return await asyncio.to_thread(_sync)

    async def list_notes(self, path: Optional[str] = None) -> list[dict]:
        await self.ensure_initialized()
        public_path = self._public_path(self.fs.get_absolute_path(path)) if path else None

        def _sync():
            with self._connect() as conn:
                if public_path:
                    rows = conn.execute(
                        "SELECT * FROM notes WHERE path = ? ORDER BY created_at DESC",
                        (public_path,),
                    ).fetchall()
                else:
                    rows = conn.execute("SELECT * FROM notes ORDER BY created_at DESC").fetchall()
                return [self._row_to_note(row) for row in rows]

        return await asyncio.to_thread(_sync)

    async def delete_note(self, note_id: str, actor: Actor) -> dict:
        await self.ensure_initialized()

        def _sync():
            with self._connect() as conn:
                row = conn.execute("SELECT * FROM notes WHERE id = ?", (note_id,)).fetchone()
                if not row:
                    raise FileNotFoundError(f"Note not found: {note_id}")
                note = self._row_to_note(row)
                conn.execute("DELETE FROM notes WHERE id = ?", (note_id,))
                self._refresh_fts_sync(conn, note["path"])
                self._record_activity_sync(conn, actor, "agent.note.delete", [note["path"]], "Deleted note")
                return note

        async with self._write_lock:
            return await asyncio.to_thread(_sync)

    async def create_lease(self, path: str, purpose: str, expires_at: Optional[datetime], actor: Actor) -> dict:
        await self.ensure_initialized()
        public_path = self._public_path(self.fs.get_absolute_path(path))
        lease_id = str(uuid.uuid4())
        created_at = _now()
        expires = (expires_at or (datetime.now(timezone.utc) + timedelta(hours=1))).isoformat()
        actor_id, actor_type, actor_name = self._actor_columns(actor)

        def _sync():
            with self._connect() as conn:
                conn.execute(
                    """
                    INSERT INTO leases (
                        id, path, purpose, expires_at, created_at,
                        actor_id, actor_type, actor_name
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (lease_id, public_path, purpose, expires, created_at, actor_id, actor_type, actor_name),
                )
                self._record_activity_sync(conn, actor, "agent.lease.create", [public_path], purpose)
                return self._row_to_lease(conn.execute("SELECT * FROM leases WHERE id = ?", (lease_id,)).fetchone())

        async with self._write_lock:
            return await asyncio.to_thread(_sync)

    async def list_leases(self, path: Optional[str] = None) -> list[dict]:
        await self.ensure_initialized()
        public_path = self._public_path(self.fs.get_absolute_path(path)) if path else None

        def _sync():
            with self._connect() as conn:
                conn.execute("DELETE FROM leases WHERE expires_at <= ?", (_now(),))
                if public_path:
                    rows = conn.execute(
                        "SELECT * FROM leases WHERE path = ? ORDER BY expires_at ASC",
                        (public_path,),
                    ).fetchall()
                else:
                    rows = conn.execute("SELECT * FROM leases ORDER BY expires_at ASC").fetchall()
                return [self._row_to_lease(row) for row in rows]

        async with self._write_lock:
            return await asyncio.to_thread(_sync)

    async def delete_lease(self, lease_id: str, actor: Actor) -> dict:
        await self.ensure_initialized()

        def _sync():
            with self._connect() as conn:
                row = conn.execute("SELECT * FROM leases WHERE id = ?", (lease_id,)).fetchone()
                if not row:
                    raise FileNotFoundError(f"Lease not found: {lease_id}")
                lease = self._row_to_lease(row)
                conn.execute("DELETE FROM leases WHERE id = ?", (lease_id,))
                self._record_activity_sync(conn, actor, "agent.lease.delete", [lease["path"]], "Released lease")
                return lease

        async with self._write_lock:
            return await asyncio.to_thread(_sync)

    async def create_proposal(
        self,
        operation: str,
        paths: list[str],
        params: dict[str, Any],
        summary: Optional[str],
        actor: Actor,
    ) -> dict:
        await self.ensure_initialized()
        public_paths = [self._public_path(self.fs.get_absolute_path(path)) for path in paths]
        proposal_id = str(uuid.uuid4())
        now = _now()
        actor_id, actor_type, actor_name = self._actor_columns(actor)
        proposal_summary = summary or f"Proposed {operation}"

        def _sync():
            with self._connect() as conn:
                conn.execute(
                    """
                    INSERT INTO proposals (
                        id, operation, status, paths_json, params_json, summary,
                        created_at, updated_at, actor_id, actor_type, actor_name
                    ) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        proposal_id,
                        operation,
                        _json_dumps(public_paths),
                        _json_dumps(params),
                        proposal_summary,
                        now,
                        now,
                        actor_id,
                        actor_type,
                        actor_name,
                    ),
                )
                self._record_activity_sync(
                    conn,
                    actor,
                    "agent.proposal.create",
                    public_paths,
                    proposal_summary,
                    {"proposal_id": proposal_id, "operation": operation},
                )
                return self._row_to_proposal(conn.execute("SELECT * FROM proposals WHERE id = ?", (proposal_id,)).fetchone())

        async with self._write_lock:
            return await asyncio.to_thread(_sync)

    async def list_proposals(self, status: Optional[str] = None, path: Optional[str] = None) -> list[dict]:
        await self.ensure_initialized()
        public_path = self._public_path(self.fs.get_absolute_path(path)) if path else None

        def _sync():
            with self._connect() as conn:
                clauses = []
                params = []
                if status:
                    clauses.append("status = ?")
                    params.append(status)
                if public_path:
                    clauses.append("paths_json LIKE ?")
                    params.append(f"%{public_path}%")
                where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
                rows = conn.execute(
                    f"SELECT * FROM proposals {where} ORDER BY updated_at DESC",
                    params,
                ).fetchall()
                return [self._row_to_proposal(row) for row in rows]

        return await asyncio.to_thread(_sync)

    async def approve_proposal(self, proposal_id: str, actor: Actor) -> dict:
        await self.ensure_initialized()

        async with self._write_lock:
            proposal = await asyncio.to_thread(self._load_pending_proposal_sync, proposal_id)
            try:
                result = await self._execute_proposal(proposal)
            except Exception as exc:
                await asyncio.to_thread(self._mark_proposal_sync, proposal_id, "failed", actor, str(exc), {"error": str(exc)})
                raise
            return await asyncio.to_thread(self._mark_proposal_sync, proposal_id, "approved", actor, None, {"result": result})

    async def reject_proposal(self, proposal_id: str, reason: Optional[str], actor: Actor) -> dict:
        await self.ensure_initialized()
        async with self._write_lock:
            return await asyncio.to_thread(self._mark_proposal_sync, proposal_id, "rejected", actor, reason, {})

    def _load_pending_proposal_sync(self, proposal_id: str) -> dict:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM proposals WHERE id = ?", (proposal_id,)).fetchone()
            if not row:
                raise FileNotFoundError(f"Proposal not found: {proposal_id}")
            proposal = self._row_to_proposal(row)
            if proposal["status"] != "pending":
                raise ValueError(f"Proposal is not pending: {proposal_id}")
            return proposal

    def _mark_proposal_sync(
        self,
        proposal_id: str,
        status: str,
        actor: Actor,
        reason: Optional[str],
        metadata: dict[str, Any],
    ) -> dict:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM proposals WHERE id = ?", (proposal_id,)).fetchone()
            if not row:
                raise FileNotFoundError(f"Proposal not found: {proposal_id}")
            proposal = self._row_to_proposal(row)
            conn.execute(
                "UPDATE proposals SET status = ?, reason = ?, updated_at = ? WHERE id = ?",
                (status, reason, _now(), proposal_id),
            )
            self._record_activity_sync(
                conn,
                actor,
                f"agent.proposal.{status}",
                proposal["paths"],
                f"{status.title()} proposal: {proposal['summary']}",
                {"proposal_id": proposal_id, **metadata},
            )
            updated = conn.execute("SELECT * FROM proposals WHERE id = ?", (proposal_id,)).fetchone()
            return self._row_to_proposal(updated)

    async def _execute_proposal(self, proposal: dict) -> dict:
        operation = proposal["operation"]
        paths = proposal["paths"]
        params = proposal["params"]
        if operation == "create_folder":
            target = self._resolve_new_path(paths[0])
            target.mkdir()
            return {"path": self._public_path(target)}
        if operation == "write_text":
            content = params.get("content", "")
            target = self.fs.get_absolute_path(paths[0])
            if not target.parent.exists():
                raise FileNotFoundError(f"Parent directory not found: {paths[0]}")
            target.write_text(content, encoding="utf-8")
            return {"path": self._public_path(target), "size": target.stat().st_size}
        if operation == "rename":
            info = await self.fs.rename(paths[0], params["new_name"])
            return info.model_dump()
        if operation == "move":
            info = await self.fs.move(paths[0], params["destination"], bool(params.get("overwrite", False)))
            return info.model_dump()
        if operation == "copy":
            info = await self.fs.copy(paths[0], params["destination"], bool(params.get("overwrite", False)))
            return info.model_dump()
        if operation == "trash":
            if self.trash is None:
                raise RuntimeError("Trash service is not available")
            moved = await self.trash.move_to_trash(paths)
            return {"moved": moved}
        raise ValueError(f"Unsupported proposal operation: {operation}")

    async def get_context(self, path: str) -> dict:
        await self.ensure_initialized()
        file_info = await self.fs.get_file_info(path)
        public_path = file_info.path

        def _sync():
            with self._connect() as conn:
                artifact = conn.execute("SELECT * FROM artifact_metadata WHERE path = ?", (public_path,)).fetchone()
                notes = conn.execute("SELECT * FROM notes WHERE path = ? ORDER BY created_at DESC", (public_path,)).fetchall()
                tasks = conn.execute(
                    "SELECT * FROM tasks WHERE path = ? AND status NOT IN ('done', 'cancelled') ORDER BY updated_at DESC",
                    (public_path,),
                ).fetchall()
                leases = conn.execute(
                    "SELECT * FROM leases WHERE path = ? AND expires_at > ? ORDER BY expires_at ASC",
                    (public_path, _now()),
                ).fetchall()
                proposals = conn.execute(
                    "SELECT * FROM proposals WHERE status = 'pending' AND paths_json LIKE ? ORDER BY updated_at DESC",
                    (f"%{public_path}%",),
                ).fetchall()
                activity = conn.execute(
                    "SELECT * FROM activity_events WHERE paths_json LIKE ? ORDER BY timestamp DESC LIMIT 20",
                    (f"%{public_path}%",),
                ).fetchall()
                return {
                    "file": file_info.model_dump(mode="json"),
                    "artifact": self._row_to_artifact(artifact) if artifact else None,
                    "notes": [self._row_to_note(row) for row in notes],
                    "tasks": [self._row_to_task(row) for row in tasks],
                    "leases": [self._row_to_lease(row) for row in leases],
                    "proposals": [self._row_to_proposal(row) for row in proposals],
                    "activity": [self._row_to_activity(row) for row in activity],
                }

        return await asyncio.to_thread(_sync)

    async def get_inbox(self) -> dict:
        await self.ensure_initialized()

        def _sync():
            with self._connect() as conn:
                return {
                    "proposals": [
                        self._row_to_proposal(row)
                        for row in conn.execute(
                            "SELECT * FROM proposals WHERE status = 'pending' ORDER BY created_at DESC LIMIT 50"
                        ).fetchall()
                    ],
                    "tasks": [
                        self._row_to_task(row)
                        for row in conn.execute(
                            "SELECT * FROM tasks WHERE status IN ('open', 'in_progress', 'blocked') ORDER BY updated_at DESC LIMIT 50"
                        ).fetchall()
                    ],
                    "leases": [
                        self._row_to_lease(row)
                        for row in conn.execute(
                            "SELECT * FROM leases WHERE expires_at > ? ORDER BY expires_at ASC LIMIT 50",
                            (_now(),),
                        ).fetchall()
                    ],
                    "artifacts": [
                        self._row_to_artifact(row)
                        for row in conn.execute(
                            "SELECT * FROM artifact_metadata ORDER BY updated_at DESC LIMIT 50"
                        ).fetchall()
                    ],
                    "activity": [
                        self._row_to_activity(row)
                        for row in conn.execute(
                            "SELECT * FROM activity_events ORDER BY timestamp DESC LIMIT 50"
                        ).fetchall()
                    ],
                }

        return await asyncio.to_thread(_sync)

    async def search_artifacts(self, query: str, path: str = "/", limit: int = 100) -> list[SearchResult]:
        await self.ensure_initialized()
        base = self.fs.get_absolute_path(path)
        if not base.exists():
            raise FileNotFoundError(f"Path not found: {path}")
        base_public = self.fs.get_relative_path(base)

        def _within_base(public_path: str) -> bool:
            if base_public == "/":
                return True
            return public_path == base_public or public_path.startswith(base_public.rstrip("/") + "/")

        def _to_search_result(public_path: str, reason: str) -> Optional[SearchResult]:
            try:
                info: FileInfo = self.fs._get_file_info(self.fs.get_absolute_path(public_path))
            except Exception:
                return None
            return SearchResult(
                path=info.path,
                name=info.name,
                type=info.type,
                size=info.size,
                modified=info.modified,
                match_reason=reason,
            )

        def _sync():
            with self._connect() as conn:
                if query:
                    if self._fts_enabled:
                        try:
                            fts_terms = [term.replace('"', '""') for term in query.split() if term]
                            fts_query = " OR ".join(f'"{term}"' for term in fts_terms) or query
                            rows = conn.execute(
                                """
                                SELECT path, 'metadata' AS reason
                                FROM artifact_fts
                                WHERE artifact_fts MATCH ?
                                LIMIT ?
                                """,
                                (fts_query, limit),
                            ).fetchall()
                        except sqlite3.OperationalError:
                            self._fts_enabled = False
                            rows = []
                    else:
                        rows = []
                    if not rows:
                        like = f"%{query.lower()}%"
                        rows = conn.execute(
                            """
                            SELECT path, 'metadata' AS reason
                            FROM artifact_metadata
                            WHERE lower(coalesce(title, '') || ' ' || coalesce(description, '') || ' ' ||
                                        coalesce(source_type, '') || ' ' || coalesce(source_url, '') || ' ' ||
                                        coalesce(provider, '') || ' ' || coalesce(model, '') || ' ' ||
                                        coalesce(prompt_summary, '') || ' ' || labels_json || ' ' || metadata_json)
                                  LIKE ?
                            LIMIT ?
                            """,
                            (like, limit),
                        ).fetchall()
                else:
                    rows = conn.execute(
                        "SELECT path, 'metadata' AS reason FROM artifact_metadata ORDER BY updated_at DESC LIMIT ?",
                        (limit,),
                    ).fetchall()

                results: list[SearchResult] = []
                seen = set()
                for row in rows:
                    public_path = row["path"]
                    if public_path in seen or not _within_base(public_path):
                        continue
                    item = _to_search_result(public_path, row["reason"])
                    if item:
                        results.append(item)
                        seen.add(public_path)
                return results

        return await asyncio.to_thread(_sync)
