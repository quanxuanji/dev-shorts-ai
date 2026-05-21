from fastapi import APIRouter
from random import randint

from app.models import SystemStatus
from app.services.task_service import task_service

router = APIRouter()


@router.get("/status", response_model=SystemStatus)
async def get_system_status() -> SystemStatus:
    return SystemStatus(
        cpu_percent=randint(34, 68),
        ram_percent=randint(48, 74),
        gpu_percent=randint(42, 88),
        gpu_memory_percent=randint(52, 86),
        inference_latency_ms=randint(118, 360),
        tokens_per_second=randint(72, 168),
        active_models=5,
        queue_depth=task_service.queue_depth(),
        active_tasks=task_service.queue_depth(),
        uptime="02:14:32",
    )
