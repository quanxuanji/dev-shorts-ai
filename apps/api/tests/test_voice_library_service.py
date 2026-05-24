import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.models import CreateVoiceRequest
from app.services.voice_library_service import VoiceLibraryService


class VoiceLibraryServiceTest(unittest.TestCase):
    def test_create_voice_copies_audio_and_syncs_fishspeech_reference(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source_audio = root / "liked.wav"
            source_audio.write_bytes(b"RIFF-liked-voice")
            fishspeech_root = root / "fishspeech"
            service = VoiceLibraryService(artifacts_root=root / "artifacts", fishspeech_root=fishspeech_root)

            voice = service.create_voice(
                CreateVoiceRequest(
                    voice_id="weekly-host",
                    name="Weekly Host",
                    reference_audio_path=str(source_audio),
                    reference_text="这是一段我喜欢的随机音色。",
                    source_task_id="task-001",
                    make_default=True,
                )
            )

            reference_audio = root / "artifacts" / "voices" / "weekly-host" / "reference.wav"
            reference_text = root / "artifacts" / "voices" / "weekly-host" / "reference.txt"
            fishspeech_audio = fishspeech_root / "references" / "weekly-host" / "reference.wav"
            fishspeech_text = fishspeech_root / "references" / "weekly-host" / "reference.lab"

            self.assertEqual("weekly-host", voice.id)
            self.assertTrue(voice.is_default)
            self.assertEqual(b"RIFF-liked-voice", reference_audio.read_bytes())
            self.assertEqual("这是一段我喜欢的随机音色。", reference_text.read_text(encoding="utf-8"))
            self.assertEqual(b"RIFF-liked-voice", fishspeech_audio.read_bytes())
            self.assertEqual("这是一段我喜欢的随机音色。", fishspeech_text.read_text(encoding="utf-8"))

            saved = json.loads((root / "artifacts" / "voice-library.json").read_text(encoding="utf-8"))
            self.assertEqual("weekly-host", saved["default_voice_id"])

    def test_set_default_voice_updates_runtime_settings_reference_id(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source_audio = root / "liked.wav"
            source_audio.write_bytes(b"RIFF-liked-voice")
            service = VoiceLibraryService(artifacts_root=root / "artifacts", fishspeech_root=root / "fishspeech")
            service.create_voice(
                CreateVoiceRequest(
                    voice_id="tech-male-01",
                    name="Tech Male",
                    reference_audio_path=str(source_audio),
                    reference_text="用于测试的技术男声音色。",
                    make_default=False,
                )
            )

            with patch("app.services.voice_library_service.settings_service.update") as update:
                response = service.set_default_voice("tech-male-01")

            self.assertEqual("tech-male-01", response.default_voice_id)
            payload = update.call_args.args[0]
            self.assertEqual("fishspeech", payload.tts_provider)
            self.assertEqual("tech-male-01", payload.fishspeech_voice)
            self.assertEqual("", payload.fishspeech_reference_audio_path)


if __name__ == "__main__":
    unittest.main()
