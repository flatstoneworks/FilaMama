from fastapi import APIRouter

from ..models.schemas import DeleteRequest
from ..services.trash import TrashService
from ..utils.error_handlers import handle_fs_errors

router = APIRouter(prefix="/api/trash", tags=["trash"])

trash_service: TrashService = None


def init_services(trash: TrashService):
    global trash_service
    trash_service = trash


@router.post("/move-to-trash")
@handle_fs_errors
async def move_to_trash(request: DeleteRequest):
    count = await trash_service.move_to_trash(request.paths)
    return {"moved": count}


@router.get("/list")
@handle_fs_errors
async def list_trash():
    items = await trash_service.list_trash()
    return {"items": items}


@router.post("/restore")
@handle_fs_errors
async def restore_from_trash(request: DeleteRequest):
    count = await trash_service.restore(request.paths)
    return {"restored": count}


@router.post("/delete-permanent")
@handle_fs_errors
async def delete_permanent(request: DeleteRequest):
    count = await trash_service.delete_permanent(request.paths)
    return {"deleted": count}


@router.post("/empty")
@handle_fs_errors
async def empty_trash():
    count = await trash_service.empty_trash()
    return {"deleted": count}


@router.get("/info")
@handle_fs_errors
async def get_trash_info():
    return await trash_service.get_info()
