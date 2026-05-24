import json
import threading
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.models import RuntimeSettings, UpdateRuntimeSettingsRequest


class SettingsService:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self.path = self._artifacts_root() / "runtime-settings.json"
        self._settings = self._load()

    def get(self) -> RuntimeSettings:
        with self._lock:
            return self._settings.model_copy()

    def update(self, payload: UpdateRuntimeSettingsRequest) -> RuntimeSettings:
        updates = payload.model_dump(exclude_none=True)
        with self._lock:
            merged = self._settings.model_dump()
            merged.update({key: value for key, value in updates.items() if value is not None})
            self._settings = RuntimeSettings(**merged)
            self._save(self._settings)
            return self._settings.model_copy()

    def _load(self) -> RuntimeSettings:
        defaults = RuntimeSettings(
            llm_provider=self._coerce("llm_provider", settings.llm_provider),
            openai_api_key=settings.openai_api_key,
            openai_base_url=settings.openai_base_url,
            openai_model=settings.openai_model,
            openai_timeout_seconds=settings.openai_timeout_seconds,
            ollama_base_url=settings.ollama_base_url,
            ollama_model=settings.ollama_model,
            asr_provider=self._coerce("asr_provider", settings.asr_provider),
            whisper_model=settings.whisper_model,
            whisper_language=settings.whisper_language,
            tts_provider=self._coerce("tts_provider", settings.tts_provider),
            edge_tts_voice=settings.edge_tts_voice,
            fishspeech_base_url=settings.fishspeech_base_url,
            fishspeech_api_key=settings.fishspeech_api_key,
            fishspeech_voice=settings.fishspeech_voice,
            fishspeech_reference_audio_path=settings.fishspeech_reference_audio_path,
            fishspeech_reference_text=settings.fishspeech_reference_text,
            fishspeech_reference_text_path=settings.fishspeech_reference_text_path,
            fishspeech_use_memory_cache=self._coerce("fishspeech_use_memory_cache", settings.fishspeech_use_memory_cache),
            fishspeech_timeout_seconds=settings.fishspeech_timeout_seconds,
        )

        if not self.path.exists():
            return defaults

        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            merged = defaults.model_dump()
            merged.update(data)
            return RuntimeSettings(**merged)
        except Exception:
            return defaults

    def _save(self, runtime_settings: RuntimeSettings) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps(runtime_settings.model_dump(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _coerce(self, key: str, value: str) -> Any:
        try:
            return RuntimeSettings(**{key: value}).model_dump()[key]
        except Exception:
            return RuntimeSettings().model_dump()[key]

    def _artifacts_root(self) -> Path:
        artifacts_dir = Path(settings.artifacts_dir)
        if not artifacts_dir.is_absolute():
            api_root = Path(__file__).resolve().parents[2]
            artifacts_dir = api_root / artifacts_dir
        return artifacts_dir.parent.resolve()


settings_service = SettingsService()
