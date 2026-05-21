from fastapi import APIRouter, HTTPException

from app.models import CreateTaskRequest, Task
from app.services.task_service import task_service

router = APIRouter()


@router.post("/create", response_model=Task)
async def create_task(payload: CreateTaskRequest) -> Task:
    return task_service.create_task(payload)


@router.get("/recent", response_model=list[Task])
async def recent_tasks() -> list[Task]:
    return task_service.recent_tasks()


@router.get("/{task_id}", response_model=Task)
async def get_task(task_id: str) -> Task:
    task = task_service.get_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task
