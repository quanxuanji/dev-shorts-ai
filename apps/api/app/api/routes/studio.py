from fastapi import APIRouter, HTTPException, Query

from app.models import StudioRuntimeData
from app.services.studio_runtime_service import studio_runtime_service

router = APIRouter()


@router.get("/runtime", response_model=StudioRuntimeData)
async def get_studio_runtime(
    task_id: str | None = None,
    demo: bool = Query(default=False),
) -> StudioRuntimeData:
    try:
        return studio_runtime_service.get_runtime(task_id=task_id, demo=demo)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
