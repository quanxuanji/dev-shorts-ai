import json
import shutil
import threading
from datetime import UTC, datetime
from pathlib import Path

from app.core.config import settings
from app.models import CreateVoiceRequest, UpdateRuntimeSettingsRequest, VoiceLibraryResponse, VoiceProfile
from app.services.settings_service import settings_service


class VoiceLibraryService:
    def __init__(self, artifacts_root: Path | None = None, fishspeech_root: Path | None = None) -> None:
        self._lock = threading.RLock()
        self.artifacts_root = artifacts_root or self._default_artifacts_root()
        self.voices_dir = self.artifacts_root / "voices"
        self.path = self.artifacts_root / "voice-library.json"
        self.fishspeech_root = fishspeech_root or Path("/Users/quanxuanji/develop/projects/fish-speech-v1.5.1")

    def list_voices(self) -> VoiceLibraryResponse:
        with self._lock:
            data = self._load()
            return self._response_from_data(data)

    def create_voice(self, payload: CreateVoiceRequest) -> VoiceProfile:
        source_audio = Path(payload.reference_audio_path).expanduser()
        if not source_audio.exists() or not source_audio.is_file():
            raise FileNotFoundError(f"Reference audio not found: {source_audio}")
        reference_text = payload.reference_text.strip()
        if not reference_text:
            raise ValueError("Reference text is required.")

        now = datetime.now(UTC)
        voice_dir = self.voices_dir / payload.voice_id
        reference_audio = voice_dir / "reference.wav"
        reference_text_path = voice_dir / "reference.txt"
        metadata_path = voice_dir / "metadata.json"

        with self._lock:
            data = self._load()
            voice_dir.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source_audio, reference_audio)
            reference_text_path.write_text(reference_text, encoding="utf-8")
            existing = self._find_voice(data, payload.voice_id)
            created_at = existing.get("created_at") if existing else now.isoformat()
            item = {
                "id": payload.voice_id,
                "name": payload.name.strip() or payload.voice_id,
                "reference_audio_path": str(reference_audio),
                "reference_text_path": str(reference_text_path),
                "reference_text": reference_text,
                "preview_audio_path": str(reference_audio),
                "source_task_id": payload.source_task_id,
                "is_default": payload.make_default,
                "created_at": created_at,
                "updated_at": now.isoformat(),
            }
            data["voices"] = [voice for voice in data["voices"] if voice.get("id") != payload.voice_id]
            data["voices"].append(item)
            if payload.make_default:
                data["default_voice_id"] = payload.voice_id
                self._mark_default(data, payload.voice_id)
            self._save(data)
            metadata_path.write_text(json.dumps(item, ensure_ascii=False, indent=2), encoding="utf-8")
            self._sync_fishspeech_reference(payload.voice_id, reference_audio, reference_text)
            if payload.make_default:
                self._apply_runtime_voice(payload.voice_id)
            return VoiceProfile(**item)

    def set_default_voice(self, voice_id: str) -> VoiceLibraryResponse:
        with self._lock:
            data = self._load()
            if not self._find_voice(data, voice_id):
                raise KeyError(f"Voice not found: {voice_id}")
            data["default_voice_id"] = voice_id
            self._mark_default(data, voice_id)
            self._save(data)
            self._apply_runtime_voice(voice_id)
            return self._response_from_data(data)

    def _sync_fishspeech_reference(self, voice_id: str, reference_audio: Path, reference_text: str) -> None:
        reference_dir = self.fishspeech_root / "references" / voice_id
        reference_dir.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(reference_audio, reference_dir / "reference.wav")
        (reference_dir / "reference.lab").write_text(reference_text, encoding="utf-8")

    def _default_artifacts_root(self) -> Path:
        artifacts_dir = Path(settings.artifacts_dir)
        if not artifacts_dir.is_absolute():
            api_root = Path(__file__).resolve().parents[2]
            artifacts_dir = api_root / artifacts_dir
        return artifacts_dir.parent.resolve()

    def _apply_runtime_voice(self, voice_id: str) -> None:
        settings_service.update(
            UpdateRuntimeSettingsRequest(
                tts_provider="fishspeech",
                fishspeech_voice=voice_id,
                fishspeech_reference_audio_path="",
                fishspeech_reference_text="",
                fishspeech_reference_text_path="",
                fishspeech_use_memory_cache="auto",
            )
        )

    def _load(self) -> dict:
        if not self.path.exists():
            return {"default_voice_id": None, "voices": []}
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except Exception:
            return {"default_voice_id": None, "voices": []}
        voices = data.get("voices") if isinstance(data, dict) else []
        return {
            "default_voice_id": data.get("default_voice_id") if isinstance(data, dict) else None,
            "voices": voices if isinstance(voices, list) else [],
        }

    def _save(self, data: dict) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def _response_from_data(self, data: dict) -> VoiceLibraryResponse:
        default_voice_id = data.get("default_voice_id")
        voices = [VoiceProfile(**voice) for voice in data.get("voices", [])]
        return VoiceLibraryResponse(voices=voices, default_voice_id=default_voice_id)

    def _find_voice(self, data: dict, voice_id: str) -> dict | None:
        for voice in data.get("voices", []):
            if voice.get("id") == voice_id:
                return voice
        return None

    def _mark_default(self, data: dict, voice_id: str) -> None:
        for voice in data.get("voices", []):
            voice["is_default"] = voice.get("id") == voice_id


voice_library_service = VoiceLibraryService()
