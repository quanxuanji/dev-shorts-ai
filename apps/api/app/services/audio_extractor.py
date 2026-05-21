import shutil
import subprocess
import wave
from pathlib import Path


class AudioExtractor:
    def extract_audio(self, input_video: Path, output_dir: Path) -> tuple[Path, list[str]]:
        logs: list[str] = []
        audio_path = output_dir / "audio.wav"

        if shutil.which("ffmpeg") and input_video.exists() and input_video.stat().st_size > 0:
            command = [
                "ffmpeg",
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
                return audio_path, logs
            logs.append(f"[FFmpeg] audio extraction failed, generating silent audio: {result.stderr[-300:]}")
        else:
            logs.append("[FFmpeg] not available or input video invalid, generating silent audio.")

        self._write_silence(audio_path, seconds=12)
        logs.append(f"[Audio] generated fallback silent audio at {audio_path}")
        return audio_path, logs

    def _write_silence(self, path: Path, seconds: int) -> None:
        sample_rate = 16000
        with wave.open(str(path), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(b"\x00\x00" * sample_rate * seconds)
