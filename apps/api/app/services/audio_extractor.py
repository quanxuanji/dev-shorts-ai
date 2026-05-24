import shutil
import subprocess
import wave
from pathlib import Path
from typing import Any


class AudioExtractor:
    def extract_audio(self, input_video: Path, output_dir: Path) -> tuple[Path, list[str], dict[str, Any]]:
        logs: list[str] = []
        metadata: dict[str, Any] = {"audioMode": "extracted", "fallbackWarnings": []}
        audio_path = output_dir / "audio.wav"
        ffmpeg_path = shutil.which("ffmpeg")
        input_exists = input_video.exists()
        input_has_bytes = input_exists and input_video.stat().st_size > 0

        if ffmpeg_path and input_has_bytes:
            command = [
                ffmpeg_path,
                "-y",
                "-i",
                str(input_video),
                "-vn",
                "-acodec",
                "pcm_s16le",
                "-ar",
                "16000",
                "-ac",
                "1",
                str(audio_path),
            ]
            result = subprocess.run(command, capture_output=True, text=True, timeout=180)
            if result.returncode == 0 and audio_path.exists():
                logs.append(f"[FFmpeg] extracted audio to {audio_path}")
                return audio_path, logs, metadata
            warning = f"audio extraction failed; generated silent fallback audio: {result.stderr[-300:]}"
            metadata["audioMode"] = "fallback_silence"
            metadata["fallbackWarnings"].append(warning)
            logs.append(f"[FFmpeg] {warning}")
        else:
            metadata["audioMode"] = "fallback_silence"
            if not ffmpeg_path:
                warning = "ffmpeg is not installed; generated silent fallback audio."
                logs.append("[FFmpeg] ffmpeg is not installed; generating silent audio.")
            elif not input_exists:
                warning = f"input video does not exist ({input_video}); generated silent fallback audio."
                logs.append(f"[Input] video does not exist at {input_video}; generating silent audio.")
            else:
                warning = f"input video is empty ({input_video}); generated silent fallback audio."
                logs.append(f"[Input] video is empty at {input_video}; generating silent audio.")
            metadata["fallbackWarnings"].append(warning)

        self._write_silence(audio_path, seconds=12)
        logs.append(f"[Audio] generated fallback silent audio at {audio_path}")
        return audio_path, logs, metadata

    def _write_silence(self, path: Path, seconds: int) -> None:
        sample_rate = 16000
        with wave.open(str(path), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(b"\x00\x00" * sample_rate * seconds)
