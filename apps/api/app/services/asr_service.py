import json
import os
import shutil
import subprocess
from pathlib import Path

from app.services.settings_service import settings_service


MOCK_TRANSCRIPT = (
    "DevShorts AI turns a source video into a short-form developer demo. "
    "The pipeline extracts audio, transcribes the content, rewrites it into a punchy script, "
    "generates voiceover, creates subtitles, and renders a vertical preview video."
)


class ASRService:
    async def extract_script(self, source_url: str) -> str:
        return MOCK_TRANSCRIPT

    def transcribe(self, audio_path: Path, output_dir: Path) -> tuple[str, list[str]]:
        logs: list[str] = []
        runtime_settings = settings_service.get()
        provider = runtime_settings.asr_provider.lower()
        transcript_path = output_dir / "transcript.txt"

        if provider == "whisper_cli":
            if shutil.which("whisper"):
                command = [
                    "whisper",
                    str(audio_path),
                    "--model",
                    runtime_settings.whisper_model or "base",
                    "--output_format",
                    "json",
                    "--output_dir",
                    str(output_dir),
                ]
                if runtime_settings.whisper_language and runtime_settings.whisper_language != "auto":
                    command.extend(["--language", runtime_settings.whisper_language])
                env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
                result = subprocess.run(command, capture_output=True, text=True, timeout=600, env=env)
                candidate = output_dir / f"{audio_path.stem}.json"
                if result.returncode == 0 and candidate.exists():
                    data = json.loads(candidate.read_text(encoding="utf-8", errors="ignore"))
                    transcript = str(data.get("text", "")).strip()
                    transcript_path.write_text(transcript, encoding="utf-8")
                    self._write_segments(data.get("segments", []), output_dir)
                    logs.append(
                        f"[Whisper] CLI transcript completed with model={runtime_settings.whisper_model} at {transcript_path}"
                    )
                    return transcript, logs
                logs.append(f"[Whisper] CLI failed, falling back to mock transcript: {result.stderr[-300:]}")
            else:
                logs.append("[Whisper] CLI provider selected but `whisper` is not installed; falling back to mock transcript.")
        elif provider == "faster_whisper":
            transcript = self._faster_whisper(audio_path, transcript_path, runtime_settings.whisper_model, logs)
            if transcript:
                return transcript, logs
        else:
            logs.append("[ASR] mock provider active.")

        transcript_path.write_text(MOCK_TRANSCRIPT, encoding="utf-8")
        logs.append(f"[ASR] wrote mock transcript to {transcript_path}")
        return MOCK_TRANSCRIPT, logs

    def _faster_whisper(self, audio_path: Path, transcript_path: Path, model_name: str, logs: list[str]) -> str:
        try:
            from faster_whisper import WhisperModel
        except Exception as exc:
            logs.append(f"[ASR] faster_whisper is not installed; falling back to mock transcript: {exc}")
            return ""

        try:
            model = WhisperModel(model_name or "base", device="auto", compute_type="auto")
            segments, info = model.transcribe(str(audio_path), beam_size=5)
            segment_list = [
                {"start": float(segment.start), "end": float(segment.end), "text": segment.text.strip()}
                for segment in segments
                if segment.text.strip()
            ]
            transcript = " ".join(segment["text"] for segment in segment_list).strip()
            if transcript:
                transcript_path.write_text(transcript, encoding="utf-8")
                self._write_segments(segment_list, transcript_path.parent)
                logs.append(
                    f"[faster-whisper] transcript completed language={info.language} probability={info.language_probability:.2f}"
                )
                return transcript
            logs.append("[faster-whisper] completed without transcript text; falling back to mock transcript.")
        except Exception as exc:
            logs.append(f"[faster-whisper] failed, falling back to mock transcript: {exc}")
        return ""

    def _write_segments(self, segments: list[dict], output_dir: Path) -> None:
        normalized = [
            {
                "start": float(segment.get("start", 0)),
                "end": float(segment.get("end", 0)),
                "text": str(segment.get("text", "")).strip(),
            }
            for segment in segments
            if str(segment.get("text", "")).strip()
        ]
        if normalized:
            (output_dir / "transcript_segments.json").write_text(
                json.dumps(normalized, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
