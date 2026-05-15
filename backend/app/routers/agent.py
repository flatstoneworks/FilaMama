import json
import tempfile
from pathlib import Path
from typing import Optional

import aiofiles
from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile

from ..models.schemas import (
    Actor,
    ActorType,
    AgentFolderRequest,
    AgentTextArtifactRequest,
    ArtifactMetadataInput,
    LeaseCreateRequest,
    NoteCreateRequest,
    ProposalCreateRequest,
    ProposalRejectRequest,
    TaskCreateRequest,
    TaskPatchRequest,
)
from ..services.agent import AgentService
from ..utils.error_handlers import handle_fs_errors

router = APIRouter(prefix="/api/agent", tags=["agent"])

agent_service: AgentService | None = None
max_upload_bytes: int = 0


def init_services(agent: AgentService, max_size_mb: int = 10240) -> None:
    global agent_service, max_upload_bytes
    agent_service = agent
    max_upload_bytes = max_size_mb * 1024 * 1024


def _require_agent() -> AgentService:
    if agent_service is None:
        raise HTTPException(status_code=503, detail="Agent service not initialized")
    return agent_service


def get_actor(
    x_filamama_actor_id: Optional[str] = Header(default=None),
    x_filamama_actor_type: Optional[str] = Header(default=None),
    x_filamama_actor_name: Optional[str] = Header(default=None),
) -> Actor:
    actor_type = ActorType.HUMAN
    if x_filamama_actor_type:
        try:
            actor_type = ActorType(x_filamama_actor_type)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid X-FilaMama-Actor-Type")
    return Actor(
        id=x_filamama_actor_id or "local-user",
        type=actor_type,
        name=x_filamama_actor_name or ("Local user" if actor_type == ActorType.HUMAN else "Agent"),
    )


def _metadata_from_form(
    title: Optional[str],
    description: Optional[str],
    source_type: Optional[str],
    source_url: Optional[str],
    provider: Optional[str],
    model: Optional[str],
    prompt_summary: Optional[str],
    labels_json: Optional[str],
    task_id: Optional[str],
    metadata_json: Optional[str],
) -> ArtifactMetadataInput:
    labels = []
    metadata = {}
    if labels_json:
        try:
            parsed = json.loads(labels_json)
            if not isinstance(parsed, list):
                raise ValueError
            labels = [str(item) for item in parsed]
        except ValueError:
            raise HTTPException(status_code=400, detail="labels_json must be a JSON array")
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="labels_json must be valid JSON")
    if metadata_json:
        try:
            parsed = json.loads(metadata_json)
            if not isinstance(parsed, dict):
                raise ValueError
            metadata = parsed
        except ValueError:
            raise HTTPException(status_code=400, detail="metadata_json must be a JSON object")
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="metadata_json must be valid JSON")
    return ArtifactMetadataInput(
        title=title,
        description=description,
        source_type=source_type,
        source_url=source_url,
        provider=provider,
        model=model,
        prompt_summary=prompt_summary,
        labels=labels,
        task_id=task_id,
        metadata=metadata,
    )


@router.post("/artifacts/upload")
@handle_fs_errors
async def upload_artifact(
    file: UploadFile = File(...),
    path: str = Form(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    source_type: Optional[str] = Form(None),
    source_url: Optional[str] = Form(None),
    provider: Optional[str] = Form(None),
    model: Optional[str] = Form(None),
    prompt_summary: Optional[str] = Form(None),
    labels_json: Optional[str] = Form(None),
    task_id: Optional[str] = Form(None),
    metadata_json: Optional[str] = Form(None),
    x_filamama_actor_id: Optional[str] = Header(default=None),
    x_filamama_actor_type: Optional[str] = Header(default=None),
    x_filamama_actor_name: Optional[str] = Header(default=None),
):
    metadata = _metadata_from_form(
        title, description, source_type, source_url, provider, model,
        prompt_summary, labels_json, task_id, metadata_json,
    )
    actor = get_actor(x_filamama_actor_id, x_filamama_actor_type, x_filamama_actor_name)
    svc = _require_agent()

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(prefix="filamama-agent-", delete=False) as tmp:
            temp_path = Path(tmp.name)
        async with aiofiles.open(temp_path, "wb") as out:
            bytes_written = 0
            while chunk := await file.read(1024 * 1024):
                bytes_written += len(chunk)
                if max_upload_bytes and bytes_written > max_upload_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File exceeds maximum upload size ({max_upload_bytes // (1024 * 1024)}MB)",
                    )
                await out.write(chunk)
        artifact = await svc.create_uploaded_artifact(path, temp_path, metadata, actor)
        temp_path = None
        return {"artifact": artifact}
    finally:
        if temp_path and temp_path.exists():
            temp_path.unlink(missing_ok=True)


@router.post("/artifacts/text")
@handle_fs_errors
async def create_text_artifact(
    request: AgentTextArtifactRequest,
    x_filamama_actor_id: Optional[str] = Header(default=None),
    x_filamama_actor_type: Optional[str] = Header(default=None),
    x_filamama_actor_name: Optional[str] = Header(default=None),
):
    actor = get_actor(x_filamama_actor_id, x_filamama_actor_type, x_filamama_actor_name)
    artifact = await _require_agent().create_text_artifact(
        request.path, request.content, request.metadata, actor
    )
    return {"artifact": artifact}


@router.post("/folders")
@handle_fs_errors
async def create_folder(
    request: AgentFolderRequest,
    x_filamama_actor_id: Optional[str] = Header(default=None),
    x_filamama_actor_type: Optional[str] = Header(default=None),
    x_filamama_actor_name: Optional[str] = Header(default=None),
):
    actor = get_actor(x_filamama_actor_id, x_filamama_actor_type, x_filamama_actor_name)
    artifact = await _require_agent().create_folder(request.path, request.metadata, actor)
    return {"artifact": artifact}


@router.get("/artifacts")
@handle_fs_errors
async def get_artifact(path: str):
    return {"artifact": await _require_agent().get_artifact(path)}


@router.patch("/artifacts")
@handle_fs_errors
async def update_artifact(
    path: str,
    metadata: ArtifactMetadataInput,
    x_filamama_actor_id: Optional[str] = Header(default=None),
    x_filamama_actor_type: Optional[str] = Header(default=None),
    x_filamama_actor_name: Optional[str] = Header(default=None),
):
    actor = get_actor(x_filamama_actor_id, x_filamama_actor_type, x_filamama_actor_name)
    return {"artifact": await _require_agent().update_artifact(path, metadata, actor)}


@router.get("/context")
@handle_fs_errors
async def get_context(path: str):
    return await _require_agent().get_context(path)


@router.get("/inbox")
@handle_fs_errors
async def get_inbox():
    return await _require_agent().get_inbox()


@router.get("/activity")
@handle_fs_errors
async def get_activity(path: Optional[str] = None, limit: int = 50, cursor: Optional[str] = None):
    bounded_limit = min(max(limit, 1), 200)
    return await _require_agent().get_activity(path, bounded_limit, cursor)


@router.get("/tasks")
@handle_fs_errors
async def list_tasks(path: Optional[str] = None, status: Optional[str] = None):
    return {"tasks": await _require_agent().list_tasks(path, status)}


@router.post("/tasks")
@handle_fs_errors
async def create_task(
    request: TaskCreateRequest,
    x_filamama_actor_id: Optional[str] = Header(default=None),
    x_filamama_actor_type: Optional[str] = Header(default=None),
    x_filamama_actor_name: Optional[str] = Header(default=None),
):
    actor = get_actor(x_filamama_actor_id, x_filamama_actor_type, x_filamama_actor_name)
    task = await _require_agent().create_task(
        request.path, request.title, request.description, request.status.value, actor
    )
    return {"task": task}


@router.patch("/tasks/{task_id}")
@handle_fs_errors
async def update_task(
    task_id: str,
    request: TaskPatchRequest,
    x_filamama_actor_id: Optional[str] = Header(default=None),
    x_filamama_actor_type: Optional[str] = Header(default=None),
    x_filamama_actor_name: Optional[str] = Header(default=None),
):
    actor = get_actor(x_filamama_actor_id, x_filamama_actor_type, x_filamama_actor_name)
    task = await _require_agent().update_task(
        task_id, request.model_dump(exclude_unset=True), actor
    )
    return {"task": task}


@router.get("/notes")
@handle_fs_errors
async def list_notes(path: Optional[str] = None):
    return {"notes": await _require_agent().list_notes(path)}


@router.post("/notes")
@handle_fs_errors
async def create_note(
    request: NoteCreateRequest,
    x_filamama_actor_id: Optional[str] = Header(default=None),
    x_filamama_actor_type: Optional[str] = Header(default=None),
    x_filamama_actor_name: Optional[str] = Header(default=None),
):
    actor = get_actor(x_filamama_actor_id, x_filamama_actor_type, x_filamama_actor_name)
    return {"note": await _require_agent().create_note(request.path, request.body, actor)}


@router.delete("/notes/{note_id}")
@handle_fs_errors
async def delete_note(
    note_id: str,
    x_filamama_actor_id: Optional[str] = Header(default=None),
    x_filamama_actor_type: Optional[str] = Header(default=None),
    x_filamama_actor_name: Optional[str] = Header(default=None),
):
    actor = get_actor(x_filamama_actor_id, x_filamama_actor_type, x_filamama_actor_name)
    return {"note": await _require_agent().delete_note(note_id, actor)}


@router.get("/leases")
@handle_fs_errors
async def list_leases(path: Optional[str] = None):
    return {"leases": await _require_agent().list_leases(path)}


@router.post("/leases")
@handle_fs_errors
async def create_lease(
    request: LeaseCreateRequest,
    x_filamama_actor_id: Optional[str] = Header(default=None),
    x_filamama_actor_type: Optional[str] = Header(default=None),
    x_filamama_actor_name: Optional[str] = Header(default=None),
):
    actor = get_actor(x_filamama_actor_id, x_filamama_actor_type, x_filamama_actor_name)
    return {"lease": await _require_agent().create_lease(request.path, request.purpose, request.expires_at, actor)}


@router.delete("/leases/{lease_id}")
@handle_fs_errors
async def delete_lease(
    lease_id: str,
    x_filamama_actor_id: Optional[str] = Header(default=None),
    x_filamama_actor_type: Optional[str] = Header(default=None),
    x_filamama_actor_name: Optional[str] = Header(default=None),
):
    actor = get_actor(x_filamama_actor_id, x_filamama_actor_type, x_filamama_actor_name)
    return {"lease": await _require_agent().delete_lease(lease_id, actor)}


@router.get("/proposals")
@handle_fs_errors
async def list_proposals(status: Optional[str] = None, path: Optional[str] = None):
    return {"proposals": await _require_agent().list_proposals(status, path)}


@router.post("/proposals")
@handle_fs_errors
async def create_proposal(
    request: ProposalCreateRequest,
    x_filamama_actor_id: Optional[str] = Header(default=None),
    x_filamama_actor_type: Optional[str] = Header(default=None),
    x_filamama_actor_name: Optional[str] = Header(default=None),
):
    actor = get_actor(x_filamama_actor_id, x_filamama_actor_type, x_filamama_actor_name)
    proposal = await _require_agent().create_proposal(
        request.operation.value, request.paths, request.params, request.summary, actor
    )
    return {"proposal": proposal}


@router.post("/proposals/{proposal_id}/approve")
@handle_fs_errors
async def approve_proposal(
    proposal_id: str,
    x_filamama_actor_id: Optional[str] = Header(default=None),
    x_filamama_actor_type: Optional[str] = Header(default=None),
    x_filamama_actor_name: Optional[str] = Header(default=None),
):
    actor = get_actor(x_filamama_actor_id, x_filamama_actor_type, x_filamama_actor_name)
    return {"proposal": await _require_agent().approve_proposal(proposal_id, actor)}


@router.post("/proposals/{proposal_id}/reject")
@handle_fs_errors
async def reject_proposal(
    proposal_id: str,
    request: ProposalRejectRequest,
    x_filamama_actor_id: Optional[str] = Header(default=None),
    x_filamama_actor_type: Optional[str] = Header(default=None),
    x_filamama_actor_name: Optional[str] = Header(default=None),
):
    actor = get_actor(x_filamama_actor_id, x_filamama_actor_type, x_filamama_actor_name)
    return {"proposal": await _require_agent().reject_proposal(proposal_id, request.reason, actor)}
