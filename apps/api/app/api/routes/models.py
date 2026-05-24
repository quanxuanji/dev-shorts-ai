from random import randint

from fastapi import APIRouter

from app.models import ModelStatus, ServiceStatus
from app.services.settings_service import settings_service

router = APIRouter()


@router.get("/status", response_model=ServiceStatus)
async def get_model_status() -> ServiceStatus:
    runtime_settings = settings_service.get()
    tts_provider = runtime_settings.tts_provider
    tts_state = "online" if tts_provider in {"edge_tts", "fishspeech"} else "mock"
    tts_note = "FishSpeech HTTP adapter" if tts_provider == "fishspeech" else "edge-tts / FishSpeech switchable"
    asr_state = "online" if runtime_settings.asr_provider in {"whisper_cli", "faster_whisper"} else "mock"
    llm_state = "online" if runtime_settings.llm_provider in {"openai", "openai_compatible", "ollama"} else "mock"
    return ServiceStatus(
        services=[
            ModelStatus(name="Whisper ASR", kind="ASR", state=asr_state, latency_ms=randint(86, 160), provider=runtime_settings.asr_provider, note=f"model={runtime_settings.whisper_model}", tokens_per_second=randint(24, 48), queue=randint(0, 3), gpu_percent=randint(12, 26)),
            ModelStatus(name="Qwen LLM", kind="LLM", state=llm_state, latency_ms=randint(118, 260), provider=runtime_settings.llm_provider, note="OpenAI-compatible / Ollama / mock", tokens_per_second=randint(78, 168), queue=randint(1, 5), gpu_percent=randint(34, 72)),
            ModelStatus(name="FishSpeech TTS", kind="TTS", state=tts_state, latency_ms=randint(164, 310), provider=tts_provider, note=tts_note, tokens_per_second=randint(16, 34), queue=randint(0, 4), gpu_percent=randint(22, 46)),
            ModelStatus(name="LatentSync", kind="Digital Human", state="standby", latency_ms=randint(240, 520), provider="Placeholder", note="Wav2Lip reserved", tokens_per_second=0, queue=randint(0, 2), gpu_percent=randint(18, 55)),
            ModelStatus(name="FFmpeg Renderer", kind="Render", state="mock", latency_ms=randint(96, 220), provider="MockRender", note="ffmpeg adapter reserved", tokens_per_second=0, queue=randint(0, 3), gpu_percent=randint(8, 24)),
        ]
    )
