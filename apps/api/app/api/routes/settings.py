from fastapi import APIRouter

from app.models import RuntimeSettings, UpdateRuntimeSettingsRequest
from app.services.settings_service import settings_service

router = APIRouter()


@router.get("", response_model=RuntimeSettings)
async def get_runtime_settings() -> RuntimeSettings:
    return settings_service.get()


@router.put("", response_model=RuntimeSettings)
async def update_runtime_settings(payload: UpdateRuntimeSettingsRequest) -> RuntimeSettings:
    return settings_service.update(payload)
