import asyncio
import importlib.util
import json
import shutil
import subprocess
import urllib.error
import urllib.request
import wave
from pathlib import Path

from app.providers.mock_provider import MockProvider
from app.services.settings_service import settings_service


class TTSService:
    def __init__(self) -> None:
        self.provider = MockProvider()

    async def synthesize(self, script: str, voice: str) -> dict[str, str]:
        audio_url = await self.provider.synthesize(script, voice)
        return {
            "audio_url": audio_url,
            "duration": "00:00:38",
            "voice": voice,
        }

    def synthesize_to_file(self, script: str, voice: str, output_dir: Path) -> tuple[Path, list[str]]:
        logs: list[str] = []
        runtime_settings = settings_service.get()
        provider = runtime_settings.tts_provider.lower()

        if provider == "edge_tts" and importlib.util.find_spec("edge_tts"):
            mp3_path = output_dir / "voice.mp3"
            output_path = output_dir / "voice.wav"
            try:
                asyncio.run(self._edge_tts(script, runtime_settings.edge_tts_voice or voice, mp3_path))
                if mp3_path.exists() and mp3_path.stat().st_size > 0:
                    logs.append(f"[TTS] edge_tts generated mp3 voice audio at {mp3_path}")
                    if shutil.which("ffmpeg"):
                        result = subprocess.run(
                            [
                                "ffmpeg",
                                "-y",
                                "-i",
                                str(mp3_path),
                                "-ar",
                                "44100",
                                "-ac",
                                "2",
                                str(output_path),
                            ],
                            capture_output=True,
                            text=True,
                            timeout=180,
                        )
                        if result.returncode == 0 and output_path.exists() and output_path.stat().st_size > 0:
                            logs.append(f"[TTS] converted edge_tts audio to wav at {output_path}")
                            return output_path, logs
                        logs.append(f"[TTS] ffmpeg conversion failed, using mp3 directly: {result.stderr[-300:]}")
                    return mp3_path, logs
                logs.append("[TTS] edge_tts finished without a usable audio file; using silent wav.")
            except Exception as exc:
                logs.append(f"[TTS] edge_tts failed, using silent wav: {exc}")
        elif provider == "fishspeech":
            output_path = output_dir / "voice.wav"
            try:
                self._fishspeech(script, runtime_settings.fishspeech_voice or voice, output_path, runtime_settings)
                if output_path.exists() and output_path.stat().st_size > 44:
                    logs.append(f"[TTS] FishSpeech generated wav voice audio at {output_path}")
                    return output_path, logs
                logs.append("[TTS] FishSpeech returned no usable audio; generating silent wav.")
            except Exception as exc:
                logs.append(f"[TTS] FishSpeech adapter failed, using silent wav: {exc}")
        elif provider == "edge_tts":
            logs.append("[TTS] edge_tts package is not installed; generating silent wav.")
        else:
            logs.append("[TTS] mock provider active; generating silent wav.")

        output_path = output_dir / "voice.wav"
        seconds = max(5, min(30, len(script.split()) // 3 or 8))
        self._write_silence(output_path, seconds=seconds)
        logs.append(f"[TTS] generated fallback silent wav at {output_path}")
        return output_path, logs

    async def _edge_tts(self, script: str, voice: str, output_path: Path) -> None:
        import edge_tts

        communicate = edge_tts.Communicate(script, voice or "en-US-AriaNeural")
        await communicate.save(str(output_path))

    def _fishspeech(self, script: str, voice: str, output_path: Path, runtime_settings) -> None:
        payload = {
            "input": script,
            "voice": voice or "default",
            "response_format": "wav",
        }
        body = json.dumps(payload).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "Accept": "audio/wav,audio/*;q=0.9,application/octet-stream;q=0.8",
        }
        if runtime_settings.fishspeech_api_key:
            headers["Authorization"] = f"Bearer {runtime_settings.fishspeech_api_key}"

        request = urllib.request.Request(
            runtime_settings.fishspeech_base_url,
            data=body,
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=runtime_settings.fishspeech_timeout_seconds) as response:
                audio_bytes = response.read()
        except urllib.error.HTTPError as exc:
            message = exc.read().decode("utf-8", errors="ignore")[:300]
            raise RuntimeError(f"HTTP {exc.code}: {message}") from exc

        output_path.write_bytes(audio_bytes)

    def _write_silence(self, path: Path, seconds: int) -> None:
        sample_rate = 16000
        with wave.open(str(path), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(b"\x00\x00" * sample_rate * seconds)
