import tempfile
import unittest
import wave
from pathlib import Path

from app.services.video_render_service import VideoRenderService


class VideoRenderServiceTest(unittest.TestCase):
    def test_fallback_source_matches_voice_duration(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir)
            voice_path = output_dir / "voice.wav"
            self._write_silence(voice_path, seconds=14)
            subtitle_path = output_dir / "subtitles.srt"
            subtitle_path.write_text("1\n00:00:00,000 --> 00:00:14,000\n测试字幕\n", encoding="utf-8")

            final_path, _logs, _metadata = VideoRenderService().render_final(
                input_video=output_dir / "missing.mp4",
                voice_audio=voice_path,
                subtitle_path=subtitle_path,
                output_dir=output_dir,
            )

            duration = self._duration_seconds(final_path)
            self.assertGreaterEqual(duration, 13.5)
            self.assertEqual("subtitled", _metadata["renderMode"])

    def _write_silence(self, path: Path, seconds: int) -> None:
        sample_rate = 16000
        with wave.open(str(path), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(b"\x00\x00" * sample_rate * seconds)

    def _duration_seconds(self, path: Path) -> float:
        import json
        import subprocess

        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "json",
                str(path),
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        return float(json.loads(result.stdout)["format"]["duration"])


if __name__ == "__main__":
    unittest.main()
