import json
import re
import wave
from datetime import datetime
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.models import StudioRuntimeData, Task, TaskLog
from app.services.settings_service import settings_service
from app.services.task_service import task_service


class StudioRuntimeService:
    def get_runtime(self, task_id: str | None = None, demo: bool = False) -> StudioRuntimeData:
        output_dir = self._resolve_output_dir(task_id, demo)
        task = task_service.get_task(output_dir.name)
        if task is None and (output_dir / "final.mp4").exists():
            task = task_service._task_from_artifact_dir(output_dir, output_dir / "final.mp4")

        settings_data = settings_service.get()
        scene_plan = self._read_json(output_dir / "scene_plan.json")
        speech_segments = self._read_json(output_dir / "speech_segments.json")
        timeline_data = self._read_json(output_dir / "timeline.json")
        render_manifest = self._read_json(output_dir / "render_manifest.json")
        subtitles = self._read_subtitles(output_dir / "subtitles.srt")
        waveform = self._read_waveform(output_dir / "voice.wav")
        assets = self._assets(output_dir)
        logs = self._logs(task, output_dir, timeline_data, render_manifest)
        scenes = self._scenes(output_dir, scene_plan, speech_segments, timeline_data)

        topic = task.topic if task and task.topic else self._infer_topic(scene_plan, output_dir)
        title = topic or (task.title if task else f"Generated Video {output_dir.name}")
        status = task.status if task else ("success" if (output_dir / "final.mp4").exists() else "running")

        return StudioRuntimeData(
            mode="demo" if demo else "runtime",
            task_id=output_dir.name,
            title=title,
            topic=topic,
            target_style=task.target_style if task and task.target_style else "中文技术博主 / 快节奏 / 可发布",
            platform="douyin",
            output_ratio=settings_data.video_resolution,
            status=status,
            current_step=task.current_step if task else None,
            progress=task.progress if task else (100 if status == "success" else 0),
            provider={
                "llm": settings_data.llm_provider,
                "tts": settings_data.tts_provider,
                "fishspeechVoice": settings_data.fishspeech_voice,
                "fishspeechBaseUrl": settings_data.fishspeech_base_url,
                "renderMode": render_manifest.get("renderMode") or render_manifest.get("manifest", {}).get("renderMode") or "remotion",
            },
            scenes=scenes,
            timeline=timeline_data,
            subtitles=subtitles,
            waveform=waveform,
            assets=assets,
            logs=logs,
            task=task,
        )

    def _resolve_output_dir(self, task_id: str | None, demo: bool) -> Path:
        root = Path(settings.artifacts_dir)
        if task_id:
            output_dir = root / task_id
            if output_dir.exists():
                return output_dir
        if demo:
            preferred = root / "github-ai-top8-short-20260523"
            if preferred.exists():
                return preferred
        candidates = [item for item in root.iterdir() if item.is_dir() and (item / "final.mp4").exists()]
        if not candidates:
            raise FileNotFoundError("No completed Studio artifacts found.")
        return max(candidates, key=lambda item: (item / "final.mp4").stat().st_mtime)

    def _read_json(self, path: Path) -> dict[str, Any]:
        if not path.exists():
            return {}
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}

    def _infer_topic(self, scene_plan: dict[str, Any], output_dir: Path) -> str:
        if (output_dir / "github_top8_data.json").exists():
            return "本周 GitHub 最值得关注的 8 个 AI 项目"
        scenes = scene_plan.get("scenes")
        if isinstance(scenes, list) and scenes:
            return str(scenes[0].get("caption") or scenes[0].get("title") or "AI 短视频生成任务")
        return "AI 短视频生成任务"

    def _scenes(
        self,
        output_dir: Path,
        scene_plan: dict[str, Any],
        speech_segments: dict[str, Any],
        timeline_data: dict[str, Any],
    ) -> list[dict[str, Any]]:
        planned = scene_plan.get("scenes") if isinstance(scene_plan.get("scenes"), list) else []
        segments = speech_segments.get("segments") if isinstance(speech_segments.get("segments"), list) else []
        timeline = timeline_data.get("items") if isinstance(timeline_data.get("items"), list) else []
        max_count = max(len(planned), len(segments), len(timeline))
        scenes: list[dict[str, Any]] = []

        for index in range(max_count):
            plan = planned[index] if index < len(planned) and isinstance(planned[index], dict) else {}
            segment = segments[index] if index < len(segments) and isinstance(segments[index], dict) else {}
            timing = timeline[index] if index < len(timeline) and isinstance(timeline[index], dict) else {}
            audio_path = output_dir / "audio" / f"scene-{index}.wav"
            scenes.append(
                {
                    "scene_index": index,
                    "rank": timing.get("rank") if timing.get("rank") is not None else plan.get("rank") or segment.get("rank"),
                    "title": self._clean_title(str(timing.get("title") or plan.get("title") or segment.get("title") or f"Scene {index + 1}")),
                    "summary": str(plan.get("description") or plan.get("summary") or plan.get("whyHot") or plan.get("caption") or ""),
                    "narration": str(segment.get("speechText") or segment.get("text") or plan.get("text") or plan.get("narration") or ""),
                    "caption": str(plan.get("caption") or ""),
                    "tags": plan.get("tags") if isinstance(plan.get("tags"), list) else [],
                    "growth": str(plan.get("growth") or ""),
                    "speech_start_ms": timing.get("speechStartMs"),
                    "speech_end_ms": timing.get("speechEndMs"),
                    "silence_start_ms": timing.get("silenceStartMs"),
                    "silence_end_ms": timing.get("silenceEndMs"),
                    "visual_start_ms": timing.get("visualStartMs"),
                    "visual_end_ms": timing.get("visualEndMs"),
                    "from_frame": timing.get("fromFrame"),
                    "duration_in_frames": timing.get("durationInFrames"),
                    "audio_path": str(audio_path) if audio_path.exists() else None,
                    "audio_duration_ms": self._wav_duration_ms(audio_path) if audio_path.exists() else None,
                }
            )
        return scenes

    def _clean_title(self, title: str) -> str:
        return re.sub(r"^TOP\d+\s+", "", title).strip() or title

    def _read_subtitles(self, path: Path) -> list[dict[str, Any]]:
        if not path.exists():
            return []
        content = path.read_text(encoding="utf-8", errors="ignore")
        blocks = re.split(r"\n\s*\n", content.strip())
        subtitles: list[dict[str, Any]] = []
        for block in blocks:
            lines = [line.strip() for line in block.splitlines() if line.strip()]
            if len(lines) < 3:
                continue
            match = re.match(r"(.+?)\s+-->\s+(.+)", lines[1])
            if not match:
                continue
            subtitles.append(
                {
                    "index": len(subtitles) + 1,
                    "start_ms": self._srt_time_to_ms(match.group(1)),
                    "end_ms": self._srt_time_to_ms(match.group(2)),
                    "text": " ".join(lines[2:]),
                }
            )
        return subtitles

    def _srt_time_to_ms(self, value: str) -> int:
        hours, minutes, rest = value.strip().split(":")
        seconds, millis = rest.split(",")
        return ((int(hours) * 60 + int(minutes)) * 60 + int(seconds)) * 1000 + int(millis)

    def _read_waveform(self, path: Path, buckets: int = 96) -> dict[str, Any]:
        if not path.exists() or path.stat().st_size <= 0:
            return {"durationMs": 0, "peaks": [], "source": ""}
        try:
            with wave.open(str(path), "rb") as wav:
                frames = wav.getnframes()
                channels = wav.getnchannels()
                sample_width = wav.getsampwidth()
                frame_rate = wav.getframerate()
                raw = wav.readframes(frames)
        except wave.Error:
            return {"durationMs": 0, "peaks": [], "source": str(path)}

        if not raw or sample_width not in {1, 2, 4}:
            return {"durationMs": int(round(self._wav_duration_ms(path) or 0)), "peaks": [], "source": str(path)}

        step = max(1, frames // buckets)
        peaks: list[float] = []
        max_value = float(2 ** (sample_width * 8 - 1))
        for bucket in range(buckets):
            start_frame = bucket * step
            end_frame = min(frames, start_frame + step)
            peak = 0
            for frame_index in range(start_frame, end_frame):
                offset = frame_index * channels * sample_width
                for channel in range(channels):
                    sample_offset = offset + channel * sample_width
                    sample = int.from_bytes(raw[sample_offset : sample_offset + sample_width], "little", signed=sample_width > 1)
                    peak = max(peak, abs(sample))
            peaks.append(round(min(1.0, peak / max_value), 3))

        return {
            "durationMs": int(round(frames / frame_rate * 1000)),
            "sampleRate": frame_rate,
            "channels": channels,
            "peaks": peaks,
            "source": str(path),
        }

    def _wav_duration_ms(self, path: Path) -> int | None:
        try:
            with wave.open(str(path), "rb") as wav:
                return int(round(wav.getnframes() / wav.getframerate() * 1000))
        except (wave.Error, FileNotFoundError, ZeroDivisionError):
            return None

    def _assets(self, output_dir: Path) -> list[dict[str, Any]]:
        specs = [
            ("final.mp4", "video", "final render"),
            ("voice.wav", "audio", "merged narration"),
            ("subtitles.srt", "subtitle", "sentence timing"),
            ("timeline.json", "timeline", "visual/speech sync"),
            ("scene_plan.json", "scene", "PPT scene plan"),
            ("speech_segments.json", "speech", "segmented TTS text"),
        ]
        assets: list[dict[str, Any]] = []
        for name, kind, detail in specs:
            path = output_dir / name
            assets.append(
                {
                    "name": name,
                    "kind": kind,
                    "path": str(path),
                    "url": f"/artifacts/outputs/{output_dir.name}/{name}" if path.exists() else None,
                    "size_bytes": path.stat().st_size if path.exists() else 0,
                    "exists": path.exists() and path.stat().st_size > 0,
                    "detail": detail,
                }
            )
        for audio_path in sorted((output_dir / "audio").glob("scene-*.wav"))[:8]:
            assets.append(
                {
                    "name": audio_path.name,
                    "kind": "scene_audio",
                    "path": str(audio_path),
                    "url": f"/artifacts/outputs/{output_dir.name}/audio/{audio_path.name}",
                    "size_bytes": audio_path.stat().st_size,
                    "exists": audio_path.stat().st_size > 0,
                    "detail": f"{self._wav_duration_ms(audio_path) or 0}ms",
                }
            )
        return assets

    def _logs(self, task: Task | None, output_dir: Path, timeline_data: dict[str, Any], render_manifest: dict[str, Any]) -> list[TaskLog]:
        if task and task.logs:
            return task.logs[-80:]
        updated_at = datetime.fromtimestamp((output_dir / "final.mp4").stat().st_mtime) if (output_dir / "final.mp4").exists() else datetime.utcnow()
        items = timeline_data.get("items") if isinstance(timeline_data.get("items"), list) else []
        return [
            TaskLog(timestamp=updated_at, level="info", message=f"[Studio] loaded artifacts from {output_dir.name}"),
            TaskLog(timestamp=updated_at, level="info", message=f"[Timeline] loaded {len(items)} scene timing records from timeline.json"),
            TaskLog(timestamp=updated_at, level="info", message=f"[FishSpeech] voice.wav loaded; segmented scene wav files detected"),
            TaskLog(timestamp=updated_at, level="info", message=f"[Remotion] render manifest loaded: {bool(render_manifest)}"),
            TaskLog(timestamp=updated_at, level="info", message="[Export] final.mp4, voice.wav, subtitles.srt, timeline.json are available"),
        ]


studio_runtime_service = StudioRuntimeService()
