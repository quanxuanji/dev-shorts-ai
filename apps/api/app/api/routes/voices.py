from fastapi import APIRouter, HTTPException

from app.models import CreateVoiceRequest, VoiceLibraryResponse, VoiceProfile
from app.services.voice_library_service import voice_library_service

router = APIRouter()


@router.get("", response_model=VoiceLibraryResponse)
async def list_voices() -> VoiceLibraryResponse:
    return voice_library_service.list_voices()


@router.post("", response_model=VoiceProfile)
async def create_voice(payload: CreateVoiceRequest) -> VoiceProfile:
    try:
        return voice_library_service.create_voice(payload)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/{voice_id}/default", response_model=VoiceLibraryResponse)
async def set_default_voice(voice_id: str) -> VoiceLibraryResponse:
    try:
        return voice_library_service.set_default_voice(voice_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
