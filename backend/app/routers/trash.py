from fastapi import APIRouter, HTTPException, Request

from ..models.schemas import Actor, ActorType, DeleteRequest
from ..services.agent import AgentService
from ..services.trash import TrashService
from ..utils.error_handlers import handle_fs_errors

router = APIRouter(prefix="/api/trash", tags=["trash"])

trash_service: TrashService = None
agent_service: AgentService = None


def _require_trash():
    if trash_service is None:
        raise HTTPException(status_code=503, detail="Trash service not initialized")
    return trash_service


def init_services(trash: TrashService, agent: AgentService = None):
    global trash_service, agent_service
    trash_service = trash
    agent_service = agent


def _actor_from_request(request: Request) -> Actor:
    actor_type_value = request.headers.get("X-FilaMama-Actor-Type", "human")
    try:
        actor_type = ActorType(actor_type_value)
    except ValueError:
        actor_type = ActorType.HUMAN
    return Actor(
        id=request.headers.get("X-FilaMama-Actor-Id", "local-user"),
        type=actor_type,
        name=request.headers.get(
            "X-FilaMama-Actor-Name",
            "Local user" if actor_type == ActorType.HUMAN else "Agent",
        ),
    )


async def _audit(request: Request, action: str, paths: list[str], summary: str, metadata: dict | None = None):
    if agent_service is None:
        return
    try:
        await agent_service.record_activity(_actor_from_request(request), action, paths, summary, metadata)
    except Exception:
        pass


@router.post("/move-to-trash")
@handle_fs_errors
async def move_to_trash(http_request: Request, request: DeleteRequest):
    svc = _require_trash()
    count = await svc.move_to_trash(request.paths)
    await _audit(http_request, "trash.move", request.paths, f"Moved {count} item(s) to Trash", {"count": count})
    return {"moved": count}


@router.get("/list")
@handle_fs_errors
async def list_trash():
    items = await _require_trash().list_trash()
    return {"items": items}


@router.post("/restore")
@handle_fs_errors
async def restore_from_trash(http_request: Request, request: DeleteRequest):
    count = await _require_trash().restore(request.paths)
    await _audit(http_request, "trash.restore", request.paths, f"Restored {count} item(s)", {"count": count})
    return {"restored": count}


@router.post("/delete-permanent")
@handle_fs_errors
async def delete_permanent(http_request: Request, request: DeleteRequest):
    count = await _require_trash().delete_permanent(request.paths)
    await _audit(http_request, "trash.delete_permanent", request.paths, f"Permanently deleted {count} item(s)", {"count": count})
    return {"deleted": count}


@router.post("/empty")
@handle_fs_errors
async def empty_trash(request: Request):
    count = await _require_trash().empty_trash()
    await _audit(request, "trash.empty", [], f"Emptied Trash ({count} item(s))", {"count": count})
    return {"deleted": count}


@router.get("/info")
@handle_fs_errors
async def get_trash_info():
    return await _require_trash().get_info()
