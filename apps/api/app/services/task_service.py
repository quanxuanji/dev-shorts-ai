import asyncio
import json
import math
import re
import struct
import threading
import traceback
import uuid
import wave
from datetime import datetime
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.models import CreateTaskRequest, Task, TaskLog, WorkflowStep
from app.services.asr_service import ASRService
from app.services.audio_extractor import AudioExtractor
from app.services.llm_service import LLMService
from app.services.remotion_render_service import RemotionRenderService
from app.services.subtitle_service import SubtitleService
from app.services.tts_service import TTSService
from app.services.video_downloader import VideoDownloader
from app.services.video_render_service import VideoRenderService


VOICE_TASK_STEP_DEFINITIONS = [
    ("reference", "Source Reference"),
    ("voiceoverScript", "Voiceover Script"),
    ("voice", "Voice Audio"),
    ("finalVideo", "Final Video"),
]


class TaskService:
    def __init__(self) -> None:
        self.tasks: dict[str, Task] = {}
        self._lock = threading.RLock()
        self.video_downloader = VideoDownloader()
        self.audio_extractor = AudioExtractor()
        self.asr_service = ASRService()
        self.llm_service = LLMService()
        self.tts_service = TTSService()
        self.subtitle_service = SubtitleService()
        self.remotion_render_service = RemotionRenderService()
        self.video_render_service = VideoRenderService()

    def create_task(self, payload: CreateTaskRequest) -> Task:
        now = datetime.utcnow()
        task_id = str(uuid.uuid4())
        task = Task(
            id=task_id,
            title=payload.title or payload.topic or "DevShorts AI Voice Script",
            source_url=payload.source_url,
            local_file_path=payload.local_file_path,
            topic=payload.topic,
            target_style=payload.target_style,
            speaking_style=payload.speaking_style,
            reference_text=payload.reference_text,
            script_prompt=payload.script_prompt,
            mode=payload.mode,
            status="queued",
            created_at=now,
            updated_at=now,
            steps=[WorkflowStep(id=step_id, label=label) for step_id, label in VOICE_TASK_STEP_DEFINITIONS],
            logs=[
                TaskLog(
                    timestamp=now,
                    level="info",
                    message="Task created. Voice script and TTS worker queued.",
                )
            ],
            artifacts={},
        )

        with self._lock:
            self.tasks[task_id] = task

        worker = threading.Thread(target=self._run_voice_task, args=(task_id, payload), daemon=True)
        worker.start()

        return task

    def get_task(self, task_id: str) -> Task | None:
        with self._lock:
            return self.tasks.get(task_id)

    def recent_tasks(self) -> list[Task]:
        with self._lock:
            memory_tasks = list(self.tasks.values())
            memory_ids = {task.id for task in memory_tasks}
        disk_tasks = self._recent_artifact_tasks(exclude_ids=memory_ids)
        return sorted([*memory_tasks, *disk_tasks], key=self._task_sort_timestamp, reverse=True)[:8]

    def _task_sort_timestamp(self, task: Task) -> float:
        final_path_value = task.artifacts.get("finalVideoPath")
        if isinstance(final_path_value, str):
            final_path = Path(final_path_value)
            if final_path.exists():
                return final_path.stat().st_mtime
        output_dir_value = task.artifacts.get("outputDir")
        if isinstance(output_dir_value, str):
            final_path = Path(output_dir_value) / "final.mp4"
            if final_path.exists():
                return final_path.stat().st_mtime
        return task.updated_at.timestamp()

    def queue_depth(self) -> int:
        with self._lock:
            return len([task for task in self.tasks.values() if task.status in ["queued", "running"]])

    def _recent_artifact_tasks(self, exclude_ids: set[str]) -> list[Task]:
        output_root = Path(settings.artifacts_dir)
        if not output_root.exists():
            return []

        artifact_tasks: list[Task] = []
        for output_dir in output_root.iterdir():
            if not output_dir.is_dir() or output_dir.name in exclude_ids:
                continue
            final_path = output_dir / "final.mp4"
            if not final_path.exists() or final_path.stat().st_size <= 0:
                continue
            artifact_tasks.append(self._task_from_artifact_dir(output_dir, final_path))
        return artifact_tasks

    def _task_from_artifact_dir(self, output_dir: Path, final_path: Path) -> Task:
        updated_at = datetime.fromtimestamp(final_path.stat().st_mtime)
        script_path = output_dir / "voiceover_script.txt"
        reference_path = output_dir / "reference.txt"
        audio_path = output_dir / "voice.wav"
        render_manifest_path = output_dir / "render_manifest.json"
        scene_plan_path = output_dir / "scene_plan.json"
        task_id = output_dir.name
        artifacts: dict[str, Any] = {
            "outputDir": str(output_dir),
            "finalVideoPath": str(final_path),
            "finalVideoUrl": f"/artifacts/outputs/{task_id}/final.mp4",
            "renderMode": "remotion" if render_manifest_path.exists() else "subtitled",
        }

        if audio_path.exists() and audio_path.stat().st_size > 0:
            artifacts["audioUrl"] = f"/artifacts/outputs/{task_id}/voice.wav"
            artifacts["voicePath"] = str(audio_path)
        if script_path.exists():
            artifacts["voiceoverScript"] = script_path.read_text(encoding="utf-8")
            artifacts["voiceoverScriptPath"] = str(script_path)
        if reference_path.exists():
            artifacts["reference"] = reference_path.read_text(encoding="utf-8")
        if render_manifest_path.exists():
            artifacts["renderManifestPath"] = str(render_manifest_path)
        if scene_plan_path.exists():
            artifacts["scenePlanPath"] = str(scene_plan_path)

        return Task(
            id=task_id,
            title=f"Generated Video {task_id[:8]}",
            status="success",
            current_step=None,
            progress=100,
            created_at=updated_at,
            updated_at=updated_at,
            steps=[WorkflowStep(id=step_id, label=label, status="success", progress=100) for step_id, label in VOICE_TASK_STEP_DEFINITIONS],
            logs=[
                TaskLog(
                    timestamp=updated_at,
                    level="info",
                    message=f"Loaded completed video from {final_path}.",
                )
            ],
            artifacts=artifacts,
        )

    def _run_voice_task(self, task_id: str, payload: CreateTaskRequest) -> None:
        active_step = "reference"
        try:
            output_dir = Path(settings.artifacts_dir) / task_id
            output_dir.mkdir(parents=True, exist_ok=True)
            self._set_task_running(task_id)
            self._set_artifact(task_id, "outputDir", str(output_dir))
            self._set_artifact(task_id, "fallbackWarnings", [])
            if payload.mode == "mock":
                self._append_fallback_warning(
                    task_id,
                    "Legacy mode 'mock' was requested; running the voice script flow with fallback-capable providers.",
                )

            active_step = "reference"
            self._start_step(task_id, active_step)
            reference_text, reference_artifact, reference_logs, reference_metadata = self._prepare_reference(
                payload,
                output_dir,
            )
            self._log_many(task_id, reference_logs)
            self._merge_artifact_metadata(task_id, reference_metadata)
            self._complete_step(task_id, active_step, reference_artifact)

            active_step = "voiceoverScript"
            self._start_step(task_id, active_step)
            edited_script = (payload.script or "").strip()
            if edited_script:
                voiceover_script = edited_script
                logs = ["[LLM] skipped; using edited voiceover script from request."]
            else:
                voiceover_script, logs = asyncio.run(
                    self.llm_service.generate_voiceover_script_with_logs(
                        reference_text,
                        payload.topic,
                        payload.target_style,
                        payload.speaking_style,
                        payload.script_prompt,
                    )
                )
            script_path = output_dir / "voiceover_script.txt"
            script_path.write_text(voiceover_script, encoding="utf-8")
            self._log_many(task_id, logs)
            if any("fallback" in log.lower() for log in logs):
                self._merge_artifact_metadata(
                    task_id,
                    {"fallbackWarnings": [log for log in logs if "fallback" in log.lower()]},
                )
            self._complete_step(
                task_id,
                active_step,
                {"path": str(script_path), "preview": voiceover_script},
            )
            scene_plan, scene_logs = asyncio.run(
                self.llm_service.generate_scene_plan_with_logs(
                    voiceover_script,
                    payload.topic,
                    payload.target_style,
                    payload.speaking_style,
                    payload.script_prompt,
                )
            )
            scene_plan_path = output_dir / "scene_plan.json"
            scene_plan = self._apply_ranked_project_metadata(scene_plan, reference_text)
            scene_plan_path.write_text(json.dumps({"scenes": scene_plan}, ensure_ascii=False, indent=2), encoding="utf-8")
            self._log_many(task_id, scene_logs)
            if any("fallback" in log.lower() for log in scene_logs):
                self._merge_artifact_metadata(
                    task_id,
                    {"fallbackWarnings": [log for log in scene_logs if "fallback" in log.lower()]},
                )
            self._merge_artifact_metadata(
                task_id,
                {
                    "scenePlanPath": str(scene_plan_path),
                    "scenePlan": scene_plan,
                },
            )
            speech_segments = self._build_speech_segments(scene_plan)
            speech_segments_path = output_dir / "speech_segments.json"
            speech_segments_path.write_text(
                json.dumps({"segments": speech_segments}, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            self._merge_artifact_metadata(
                task_id,
                {
                    "speechSegmentsPath": str(speech_segments_path),
                    "speechSegments": speech_segments,
                },
            )

            active_step = "voice"
            self._start_step(task_id, active_step)
            voice_path, logs, tts_metadata = self.tts_service.synthesize_speech_segments_to_file(
                speech_segments,
                voice="studio-default",
                output_dir=output_dir,
            )
            self._log_many(task_id, logs)
            self._merge_artifact_metadata(task_id, tts_metadata)
            self._complete_step(
                task_id,
                active_step,
                {
                    "path": str(voice_path),
                    "url": f"/artifacts/outputs/{task_id}/{voice_path.name}",
                },
            )

            active_step = "finalVideo"
            self._start_step(task_id, active_step)
            duration_seconds = tts_metadata.get("durationSeconds")
            subtitle_path, subtitle_logs = self.subtitle_service.create_subtitles(
                voiceover_script,
                output_dir,
                duration_seconds=duration_seconds if isinstance(duration_seconds, (int, float)) else None,
            )
            self._log_many(task_id, subtitle_logs)
            input_video_path = self._get_artifact(task_id, "inputVideoPath")
            timeline = tts_metadata.get("timeline")
            timeline_items = timeline if isinstance(timeline, list) else None
            if timeline_items:
                self._log_many(task_id, self._timeline_debug_logs(timeline_items, voice_path))
            scenes, segment_logs, segment_metadata = self._prepare_voice_segments(
                voiceover_script,
                scene_plan,
                voice_path,
                duration_seconds,
                output_dir,
            )
            self._log_many(task_id, segment_logs)
            self._merge_artifact_metadata(task_id, segment_metadata)
            final_path, render_logs, render_metadata = self.remotion_render_service.render_final(
                output_dir=output_dir,
                scenes=scenes,
                audio_path=voice_path,
                timeline=timeline_items,
            )
            render_metadata.setdefault("renderManifestPath", str(output_dir / "render_manifest.json"))
            self._log_many(task_id, render_logs)
            self._merge_artifact_metadata(task_id, render_metadata)
            if render_metadata.get("renderMode") != "remotion" or not final_path.exists() or final_path.stat().st_size <= 0:
                final_path, fallback_logs, fallback_metadata = self.video_render_service.render_final(
                    input_video=Path(str(input_video_path or output_dir / "source.mp4")),
                    voice_audio=voice_path,
                    subtitle_path=subtitle_path,
                    output_dir=output_dir,
                )
                self._log_many(task_id, fallback_logs)
                self._merge_artifact_metadata(
                    task_id,
                    {
                        **fallback_metadata,
                        "fallbackWarnings": [
                            *render_metadata.get("fallbackWarnings", []),
                            *fallback_metadata.get("fallbackWarnings", []),
                        ],
                    },
                )
            if not final_path.exists() or final_path.stat().st_size <= 0:
                raise RuntimeError("No usable final video was generated by Remotion or ffmpeg fallback.")
            self._complete_step(
                task_id,
                active_step,
                {
                    "path": str(final_path),
                    "url": f"/artifacts/outputs/{task_id}/{final_path.name}",
                },
            )

            self._mark_success(task_id)
        except Exception as exc:
            self._mark_error(task_id, active_step, exc)

    def _set_task_running(self, task_id: str) -> None:
        with self._lock:
            task = self.tasks[task_id]
            task.status = "running"
            self._log_once(task, "Voice script and TTS worker started.")
            self._touch(task)

    def _prepare_reference(
        self,
        payload: CreateTaskRequest,
        output_dir: Path,
    ) -> tuple[str, dict[str, Any], list[str], dict[str, Any]]:
        logs: list[str] = []
        metadata: dict[str, Any] = {"fallbackWarnings": []}
        provided_reference = (payload.reference_text or "").strip()

        if provided_reference:
            reference_path = output_dir / "reference.txt"
            reference_path.write_text(provided_reference, encoding="utf-8")
            logs.append("[Reference] manual reference text accepted.")
            return (
                provided_reference,
                {"path": str(reference_path), "preview": provided_reference[:240], "kind": "manual"},
                logs,
                metadata,
            )

        if payload.source_url or payload.local_file_path:
            input_video, source_logs = self.video_downloader.prepare_source(
                output_dir=output_dir,
                source_url=payload.source_url,
                local_file_path=payload.local_file_path,
            )
            logs.extend(source_logs)
            metadata["inputVideoPath"] = str(input_video)
            audio_path, audio_logs, audio_metadata = self.audio_extractor.extract_audio(input_video, output_dir)
            logs.extend(audio_logs)
            metadata.update({key: value for key, value in audio_metadata.items() if key != "fallbackWarnings"})
            metadata["fallbackWarnings"].extend(audio_metadata.get("fallbackWarnings", []))
            transcript, asr_logs = self.asr_service.transcribe(audio_path, output_dir)
            logs.extend(asr_logs)
            if any("mock transcript" in log.lower() or "fallback" in log.lower() for log in asr_logs):
                metadata["fallbackWarnings"].append(
                    "ASR fallback transcript was used; treat the reference as weak source context."
                )
            transcript_path = output_dir / "transcript.txt"
            return (
                transcript,
                {"path": str(transcript_path), "preview": transcript[:240], "kind": "transcript"},
                logs,
                metadata,
            )

        prompt_reference = (payload.script_prompt or payload.topic or "").strip()
        if not prompt_reference:
            prompt_reference = "请生成一段介绍 DevShorts AI 语音稿生产流程的中文开发者口播。"
            warning = "No source transcript or manual reference was provided; using a local fallback reference prompt."
            metadata["fallbackWarnings"].append(warning)
            logs.append(f"[Reference] fallback: {warning}")
        else:
            logs.append("[Reference] using script prompt/topic as source reference.")

        reference_path = output_dir / "reference.txt"
        reference_path.write_text(prompt_reference, encoding="utf-8")
        return (
            prompt_reference,
            {"path": str(reference_path), "preview": prompt_reference[:240], "kind": "prompt"},
            logs,
            metadata,
        )

    def _prepare_voice_segments(
        self,
        voiceover_script: str,
        scene_plan: list[dict[str, Any]] | None,
        voice_path: Path,
        duration_seconds: Any,
        output_dir: Path,
    ) -> tuple[list[dict[str, Any]], list[str], dict[str, Any]]:
        planned = scene_plan or [
            {
                "id": f"scene-{index:03d}",
                "title": f"Scene {index}",
                "caption": text,
                "narration": text,
            }
            for index, text in enumerate(self.tts_service._split_script(voiceover_script), start=1)
        ]
        duration = duration_seconds if isinstance(duration_seconds, (int, float)) else self._audio_duration_seconds(voice_path)
        duration = float(duration or 8.0)
        scene_durations = self._scene_durations_for_voice(planned, voice_path, duration)
        scenes = []
        for index, segment in enumerate(planned, start=1):
            narration = str(segment.get("narration") or segment.get("text") or segment.get("caption") or "").strip()
            if not narration:
                continue
            scene = {
                "id": str(segment.get("id") or f"scene-{index:03d}"),
                "title": str(segment.get("title") or f"Scene {index}"),
                "caption": str(segment.get("caption") or narration),
                "text": narration,
                "audioPath": "",
                "duration": scene_durations[len(scenes)] if len(scenes) < len(scene_durations) else max(1.0, duration / max(1, len(planned))),
            }
            for key in ["rank", "name", "description", "growth", "whyHot", "tags"]:
                if key in segment and segment[key] not in (None, ""):
                    scene[key] = segment[key]
            scenes.append(scene)
        return scenes, ["[TTS] using one full voice.wav; scene timings are visual only."], {
            "voiceSegmentCount": len(scenes),
            "visualSceneCount": len(scenes),
            "pageSwitchPauseSeconds": 0.5,
            "fallbackWarnings": [],
        }

    def _build_speech_segments(
        self,
        scene_plan: list[dict[str, Any]],
        *,
        repair_rank_ordinals: bool = False,
    ) -> list[dict[str, Any]]:
        segments: list[dict[str, Any]] = []
        for scene in scene_plan:
            speech_text = str(scene.get("narration") or scene.get("text") or scene.get("caption") or "").strip()
            if not speech_text:
                continue
            segment = {
                "sceneIndex": len(segments),
                "rank": scene.get("rank"),
                "title": str(scene.get("title") or f"Scene {len(segments) + 1}"),
                "speechText": speech_text,
            }
            if scene.get("name"):
                segment["name"] = str(scene.get("name"))
            segments.append(segment)

        if repair_rank_ordinals:
            segments = self._repair_rank_ordinals(segments)
        self._validate_speech_segments(segments)
        return segments

    def _repair_rank_ordinals(self, segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
        repaired = [dict(segment) for segment in segments]
        for index, segment in enumerate(repaired):
            rank = segment.get("rank")
            if not isinstance(rank, int):
                continue
            ordinal = self._rank_ordinal(rank)
            text = str(segment.get("speechText") or "").strip()
            ordinal_match = re.search(rf"{re.escape(ordinal)}\s*[，,、:：]?", text)
            if ordinal_match and ordinal_match.start() > 0:
                text = text[ordinal_match.start() :].strip()
            if not self._starts_with_ordinal(text, ordinal):
                name = str(segment.get("name") or self._clean_rank_title(str(segment.get("title") or ""))).strip()
                if name and text.lower().startswith(name.lower()):
                    text = f"{ordinal}，{text}"
                else:
                    text = f"{ordinal}，{name}，{text}" if name else f"{ordinal}，{text}"
            segment["speechText"] = text

            next_rank = rank + 1
            next_ordinal = self._rank_ordinal(next_rank)
            segment["speechText"] = re.sub(
                rf"\s*{re.escape(next_ordinal)}\s*[，,、:：]?\s*$",
                "",
                str(segment["speechText"]).strip(),
            ).strip()
        return repaired

    def _validate_speech_segments(self, segments: list[dict[str, Any]]) -> None:
        for index, segment in enumerate(segments):
            rank = segment.get("rank")
            text = str(segment.get("speechText") or "").strip()
            if isinstance(rank, int):
                ordinal = self._rank_ordinal(rank)
                if not self._starts_with_ordinal(text, ordinal):
                    raise ValueError(f"speechText must start with {ordinal}: sceneIndex={index}")
        for index, segment in enumerate(segments):
            text = str(segment.get("speechText") or "").strip()
            next_segment = segments[index + 1] if index + 1 < len(segments) else None
            next_rank = next_segment.get("rank") if next_segment else None
            if isinstance(next_rank, int):
                next_ordinal = self._rank_ordinal(next_rank)
                if re.search(rf"{re.escape(next_ordinal)}\s*[，,、:：]?\s*$", text):
                    raise ValueError(f"previous speechText must not end with {next_ordinal}: sceneIndex={index}")

    def _starts_with_ordinal(self, text: str, ordinal: str) -> bool:
        return bool(re.match(rf"^\s*{re.escape(ordinal)}\s*(?:[，,、:：]|\b)", text))

    def _rank_ordinal(self, rank: int) -> str:
        return {
            1: "第一",
            2: "第二",
            3: "第三",
            4: "第四",
            5: "第五",
            6: "第六",
            7: "第七",
            8: "第八",
            9: "第九",
            10: "第十",
        }.get(rank, f"第{rank}")

    def _clean_rank_title(self, title: str) -> str:
        return re.sub(r"^\s*(?:TOP\s*)?\d+\s*[:：.-]?\s*", "", title, flags=re.IGNORECASE).strip()

    def _voice_script_from_segments(self, speech_segments: list[dict[str, Any]]) -> str:
        texts = [str(segment.get("speechText") or "").strip() for segment in speech_segments]
        return "\n\n".join(text for text in texts if text)

    def _voice_script_for_tts(self, voiceover_script: str, scene_plan: list[dict[str, Any]] | None) -> str:
        if not scene_plan:
            return voiceover_script
        narrations = [
            str(scene.get("narration") or scene.get("text") or scene.get("caption") or "").strip()
            for scene in scene_plan
        ]
        narrations = [narration for narration in narrations if narration]
        return "\n\n".join(narrations) if narrations else voiceover_script

    def _enforce_page_switch_pauses(
        self,
        voice_path: Path,
        speech_segments: list[dict[str, Any]],
        duration_seconds: float,
        output_dir: Path,
    ) -> tuple[Path, list[str], dict[str, Any]]:
        scene_count = len([segment for segment in speech_segments if self._segment_speech_text(segment)])
        if scene_count < 2:
            return voice_path, [], {"durationSeconds": round(duration_seconds, 3)}

        speech_durations = self._speech_durations_for_segments(speech_segments, voice_path, duration_seconds)
        boundaries: list[float] = []
        cursor = 0.0
        for speech_duration in speech_durations[:-1]:
            cursor += speech_duration
            boundaries.append(cursor)

        source_path = output_dir / "voice.raw-single.wav"
        if voice_path.exists():
            source_path.write_bytes(voice_path.read_bytes())
        self._insert_silence_after_boundaries(source_path, voice_path, boundaries, 0.5)
        new_duration = self._audio_duration_seconds(voice_path)
        timeline = self._build_page_timeline(
            speech_segments,
            speech_durations=speech_durations,
            pause_seconds=0.5,
            total_duration_seconds=float(new_duration or duration_seconds + 0.5 * len(boundaries)),
            fps=30,
        )
        timeline_path = (output_dir / "timeline.json").resolve()
        total_frames = sum(item["durationInFrames"] for item in timeline)
        timeline_path.write_text(
            json.dumps(
                {
                    "fps": 30,
                    "totalFrames": total_frames,
                    "totalDurationMs": int(round((new_duration or duration_seconds + 0.5 * len(boundaries)) * 1000)),
                    "items": timeline,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        return (
            voice_path,
            [
                f"[TTS] inserted 0.5s page-switch silence after {len(boundaries)} voiceover segments.",
                f"[Timeline] wrote {timeline_path}",
            ],
            {
                "durationSeconds": round(new_duration or duration_seconds + 0.5 * len(boundaries), 3),
                "pageSwitchPauseSeconds": 0.5,
                "timeline": timeline,
                "timelinePath": str(timeline_path),
                "totalFrames": total_frames,
            },
        )

    def _build_page_timeline(
        self,
        speech_segments: list[dict[str, Any]],
        *,
        speech_durations: list[float],
        pause_seconds: float,
        total_duration_seconds: float,
        fps: int = 30,
    ) -> list[dict[str, Any]]:
        planned = [
            segment
            for segment in speech_segments
            if self._segment_speech_text(segment)
        ]
        if not planned:
            return []

        normalized_speech = [max(0.0, float(duration)) for duration in speech_durations[: len(planned)]]
        if len(normalized_speech) < len(planned):
            remaining = max(0.0, total_duration_seconds - pause_seconds * max(0, len(planned) - 1) - sum(normalized_speech))
            filler = remaining / max(1, len(planned) - len(normalized_speech))
            normalized_speech.extend([filler] * (len(planned) - len(normalized_speech)))

        speech_windows: list[dict[str, float]] = []
        cursor_ms = 0.0
        pause_ms = max(0.0, pause_seconds * 1000.0)
        for index, speech_duration in enumerate(normalized_speech):
            speech_start_ms = cursor_ms
            speech_end_ms = speech_start_ms + speech_duration * 1000.0
            silence_start_ms = speech_end_ms
            silence_end_ms = speech_end_ms + (pause_ms if index < len(normalized_speech) - 1 else 0.0)
            speech_windows.append(
                {
                    "speechStartMs": speech_start_ms,
                    "speechEndMs": speech_end_ms,
                    "silenceStartMs": silence_start_ms,
                    "silenceEndMs": silence_end_ms,
                }
            )
            cursor_ms = silence_end_ms

        total_ms = max(cursor_ms, total_duration_seconds * 1000.0)
        visual_starts: list[float] = []
        for index, window in enumerate(speech_windows):
            if index == 0:
                visual_starts.append(0.0)
            else:
                visual_start = max(0.0, window["speechStartMs"] - 300.0)
                previous = speech_windows[index - 1]
                visual_start = min(max(visual_start, previous["silenceStartMs"]), previous["silenceEndMs"])
                visual_starts.append(visual_start)

        from_frames = [int(round(start_ms / 1000.0 * fps)) for start_ms in visual_starts]
        total_frames = max(from_frames[-1] + 1, int(round(total_ms / 1000.0 * fps)))
        timeline: list[dict[str, Any]] = []
        for index, (scene, window) in enumerate(zip(planned, speech_windows, strict=False)):
            next_from_frame = from_frames[index + 1] if index + 1 < len(from_frames) else total_frames
            from_frame = from_frames[index]
            visual_end_ms = visual_starts[index + 1] if index + 1 < len(visual_starts) else total_ms
            timeline.append(
                {
                    "sceneIndex": index,
                    "rank": scene.get("rank"),
                    "title": str(scene.get("title") or f"Scene {index + 1}"),
                    "speechStartMs": int(round(window["speechStartMs"])),
                    "speechEndMs": int(round(window["speechEndMs"])),
                    "silenceStartMs": int(round(window["silenceStartMs"])),
                    "silenceEndMs": int(round(window["silenceEndMs"])),
                    "visualStartMs": int(round(visual_starts[index])),
                    "visualEndMs": int(round(visual_end_ms)),
                    "fromFrame": from_frame,
                    "durationInFrames": max(1, next_from_frame - from_frame),
                }
            )
        return timeline

    def _timeline_debug_logs(self, timeline: list[dict[str, Any]], voice_path: Path) -> list[str]:
        voice_duration = self._audio_duration_seconds(voice_path)
        total_frames = sum(int(item.get("durationInFrames") or 0) for item in timeline)
        logs = [
            f"[Timeline] voice.wav duration={voice_duration:.3f}s",
            f"[Timeline] totalFrames={total_frames}",
        ]
        for item in timeline:
            logs.append(
                "[Timeline] "
                f"sceneIndex={item.get('sceneIndex')} "
                f"rank={item.get('rank')} "
                f"title={item.get('title')} "
                f"visualStartMs={item.get('visualStartMs')} "
                f"speechStartMs={item.get('speechStartMs')} "
                f"silenceStartMs={item.get('silenceStartMs')} "
                f"fromFrame={item.get('fromFrame')}"
            )
        return logs

    def _speech_durations_for_voice(
        self,
        scene_plan: list[dict[str, Any]],
        voice_path: Path,
        duration_seconds: float,
    ) -> list[float]:
        weights = [
            max(1, len(str(scene.get("narration") or scene.get("text") or scene.get("caption") or "")))
            for scene in scene_plan
            if str(scene.get("narration") or scene.get("text") or scene.get("caption") or "").strip()
        ]
        scene_count = max(1, len(weights))
        total_weight = sum(weights) or scene_count
        estimated_boundaries = []
        cursor = 0.0
        for weight in weights[:-1]:
            cursor += duration_seconds * weight / total_weight
            estimated_boundaries.append(cursor)

        silence_midpoints = self._audio_silence_midpoints(voice_path)
        snapped_boundaries: list[float] = []
        previous = 0.0
        for estimate in estimated_boundaries:
            window = max(0.45, duration_seconds * 0.035)
            candidates = [
                midpoint
                for midpoint in silence_midpoints
                if previous + 0.8 <= midpoint <= duration_seconds - 0.8 and abs(midpoint - estimate) <= window
            ]
            boundary = min(candidates, key=lambda value: abs(value - estimate)) if candidates else estimate
            boundary = min(max(boundary, previous + 0.8), duration_seconds - 0.8)
            snapped_boundaries.append(boundary)
            previous = boundary

        boundaries = [0.0, *snapped_boundaries, duration_seconds]
        return [
            max(0.8, boundaries[index + 1] - boundaries[index])
            for index in range(scene_count)
        ]

    def _speech_durations_for_segments(
        self,
        speech_segments: list[dict[str, Any]],
        voice_path: Path,
        duration_seconds: float,
    ) -> list[float]:
        weights = [
            max(1, len(self._segment_speech_text(segment)))
            for segment in speech_segments
            if self._segment_speech_text(segment)
        ]
        synthetic_scene_plan = [{"narration": "x" * weight} for weight in weights]
        return self._speech_durations_for_voice(synthetic_scene_plan, voice_path, duration_seconds)

    def _segment_speech_text(self, segment: dict[str, Any]) -> str:
        return str(segment.get("speechText") or segment.get("narration") or segment.get("text") or segment.get("caption") or "").strip()

    def _insert_silence_after_boundaries(
        self,
        source_path: Path,
        output_path: Path,
        boundaries: list[float],
        pause_seconds: float,
    ) -> None:
        with wave.open(str(source_path), "rb") as source:
            channels = source.getnchannels()
            sample_width = source.getsampwidth()
            frame_rate = source.getframerate()
            frame_count = source.getnframes()
            audio = source.readframes(frame_count)

        silence = b"\x00" * int(frame_rate * pause_seconds) * channels * sample_width
        previous_frame = 0
        with wave.open(str(output_path), "wb") as target:
            target.setnchannels(channels)
            target.setsampwidth(sample_width)
            target.setframerate(frame_rate)
            for boundary in boundaries:
                boundary_frame = min(frame_count, max(previous_frame, int(boundary * frame_rate)))
                start = previous_frame * channels * sample_width
                end = boundary_frame * channels * sample_width
                target.writeframes(audio[start:end])
                target.writeframes(silence)
                previous_frame = boundary_frame
            start = previous_frame * channels * sample_width
            target.writeframes(audio[start:])

    def _scene_durations_for_voice(
        self,
        scene_plan: list[dict[str, Any]],
        voice_path: Path,
        duration_seconds: float,
    ) -> list[float]:
        speech_durations = self._speech_durations_for_voice(scene_plan, voice_path, duration_seconds - 0.5 * max(0, len(scene_plan) - 1))
        scene_count = max(1, len(speech_durations))
        page_switch_pause_seconds = 0.5
        durations: list[float] = []
        for index, speech_duration in enumerate(speech_durations):
            pause_duration = page_switch_pause_seconds if index < scene_count - 1 else 0.0
            durations.append(round(max(0.8, speech_duration + pause_duration), 3))
        drift = round(duration_seconds - sum(durations), 3)
        durations[-1] = round(max(0.8, durations[-1] + drift), 3)
        return durations

    def _audio_silence_midpoints(self, voice_path: Path) -> list[float]:
        if not voice_path.exists() or voice_path.suffix.lower() != ".wav":
            return []
        try:
            with wave.open(str(voice_path), "rb") as audio:
                frame_rate = audio.getframerate()
                channels = audio.getnchannels()
                sample_width = audio.getsampwidth()
                frame_count = audio.getnframes()
                if frame_rate <= 0 or channels <= 0 or sample_width != 2:
                    return []
                data = audio.readframes(frame_count)
        except (wave.Error, OSError):
            return []

        window_frames = max(1, int(frame_rate * 0.05))
        rms_values: list[float] = []
        for frame_start in range(0, max(0, frame_count - window_frames), window_frames):
            offset = frame_start * channels * sample_width
            chunk = data[offset : offset + window_frames * channels * sample_width]
            if not chunk:
                continue
            samples = struct.unpack("<" + "h" * (len(chunk) // sample_width), chunk)
            energy = 0.0
            count = 0
            for sample_index in range(0, len(samples), channels):
                sample = sum(samples[sample_index : sample_index + channels]) / channels / 32768.0
                energy += sample * sample
                count += 1
            rms_values.append(math.sqrt(energy / max(1, count)))
        if not rms_values:
            return []

        ordered = sorted(rms_values)
        percentile_18 = ordered[min(len(ordered) - 1, int(len(ordered) * 0.18))]
        threshold = max(0.006, percentile_18 * 1.2)
        midpoints: list[float] = []
        start: float | None = None
        for index, value in enumerate(rms_values):
            timestamp = index * 0.05
            if value < threshold:
                if start is None:
                    start = timestamp
            elif start is not None:
                if timestamp - start >= 0.12:
                    midpoints.append((start + timestamp) / 2)
                start = None
        if start is not None:
            end = len(rms_values) * 0.05
            if end - start >= 0.12:
                midpoints.append((start + end) / 2)
        return midpoints

    def _audio_duration_seconds(self, voice_path: Path) -> float:
        try:
            with wave.open(str(voice_path), "rb") as audio:
                frame_rate = audio.getframerate()
                return audio.getnframes() / frame_rate if frame_rate > 0 else 0.0
        except (wave.Error, OSError):
            return 0.0

    def _apply_ranked_project_metadata(self, scenes: list[dict[str, Any]], reference_text: str) -> list[dict[str, Any]]:
        items = self._extract_ranked_project_items(reference_text)
        if not items:
            return scenes

        by_rank = {int(item["rank"]): item for item in items if isinstance(item.get("rank"), int)}
        by_name = {str(item["name"]).lower(): item for item in items if item.get("name")}
        enriched: list[dict[str, Any]] = []
        for scene in scenes:
            title = str(scene.get("title") or "")
            text = " ".join([title, str(scene.get("caption") or ""), str(scene.get("narration") or scene.get("text") or "")]).lower()
            matched = None
            rank_match = re.search(r"(?:top|第)\s*([0-9一二三四五六七八九十]+)", title, flags=re.IGNORECASE)
            if rank_match:
                rank = self._rank_value(rank_match.group(1))
                matched = by_rank.get(rank)
            if matched is None:
                matched = next((item for name, item in by_name.items() if name in text), None)
            enriched.append({**scene, **matched} if matched else scene)
        return enriched

    def _extract_ranked_project_items(self, reference_text: str) -> list[dict[str, Any]]:
        start = reference_text.find("[")
        end = reference_text.rfind("]")
        if start == -1 or end == -1 or end <= start:
            return []
        try:
            data = json.loads(reference_text[start : end + 1])
        except json.JSONDecodeError:
            return []
        if not isinstance(data, list):
            return []
        items: list[dict[str, Any]] = []
        for item in data:
            if not isinstance(item, dict):
                continue
            rank = item.get("rank")
            name = item.get("name")
            if not isinstance(rank, int) or not isinstance(name, str):
                continue
            items.append(
                {
                    "rank": rank,
                    "name": name,
                    "description": str(item.get("description") or ""),
                    "growth": str(item.get("growth") or ""),
                    "whyHot": str(item.get("whyHot") or ""),
                    "tags": [str(tag) for tag in item.get("tags", []) if isinstance(tag, str)],
                }
            )
        return items

    def _rank_value(self, value: str) -> int:
        if value.isdigit():
            return int(value)
        return {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10}.get(value, 0)

    def _start_step(self, task_id: str, step_id: str) -> None:
        with self._lock:
            task = self.tasks[task_id]
            task.status = "running"
            task.current_step = step_id
            step = self._find_step(task, step_id)
            step.status = "running"
            step.progress = max(step.progress, 5)
            self._log_once(task, f"{step.label} started.")
            self._recompute_progress(task)
            self._touch(task)

    def _complete_step(self, task_id: str, step_id: str, artifact: dict[str, Any]) -> None:
        with self._lock:
            task = self.tasks[task_id]
            step = self._find_step(task, step_id)
            step.status = "success"
            step.progress = 100
            step.output = artifact.get("path") or artifact.get("preview") or "completed"
            if step_id == "reference":
                task.artifacts["reference"] = artifact.get("preview", "")
                task.artifacts["referencePath"] = artifact.get("path", "")
                task.artifacts["referenceKind"] = artifact.get("kind", "reference")
                if artifact.get("kind") == "transcript":
                    task.artifacts["transcript"] = artifact.get("preview", "")
                    task.artifacts["transcriptPath"] = artifact.get("path", "")
                segments_path = Path(str(artifact.get("path", ""))).with_name("transcript_segments.json")
                if segments_path.exists():
                    task.artifacts["transcriptSegments"] = str(segments_path)
            elif step_id == "voiceoverScript":
                task.artifacts["voiceoverScript"] = artifact.get("preview", "")
                task.artifacts["voiceoverScriptPath"] = artifact.get("path", "")
                task.artifacts["rewrittenScript"] = artifact.get("preview", "")
                task.artifacts["rewrittenScriptPath"] = artifact.get("path", "")
            elif step_id == "voice":
                task.artifacts["voice"] = artifact.get("path", "")
                task.artifacts["voicePath"] = artifact.get("path", "")
                task.artifacts["voiceAudioUrl"] = artifact.get("url", "")
                task.artifacts["audioUrl"] = artifact.get("url", "")
            elif step_id == "finalVideo":
                task.artifacts["finalVideo"] = artifact.get("path", "")
                task.artifacts["finalVideoPath"] = artifact.get("path", "")
                task.artifacts["finalVideoUrl"] = artifact.get("url", "")
                task.artifacts["videoUrl"] = artifact.get("url", "")
            else:
                task.artifacts[step_id] = artifact.get("path") or artifact.get("preview") or artifact
            self._log_once(task, f"{step.label} completed.")
            self._recompute_progress(task)
            self._touch(task)

    def _set_artifact(self, task_id: str, key: str, value: Any) -> None:
        with self._lock:
            task = self.tasks[task_id]
            task.artifacts[key] = value
            self._touch(task)

    def _get_artifact(self, task_id: str, key: str) -> Any:
        with self._lock:
            return self.tasks[task_id].artifacts.get(key)

    def _append_fallback_warning(self, task_id: str, warning: str) -> None:
        self._merge_artifact_metadata(task_id, {"fallbackWarnings": [warning]})

    def _merge_artifact_metadata(self, task_id: str, metadata: dict[str, Any]) -> None:
        with self._lock:
            task = self.tasks[task_id]
            fallback_warnings = metadata.get("fallbackWarnings")
            for key, value in metadata.items():
                if key == "fallbackWarnings":
                    continue
                task.artifacts[key] = value
            if isinstance(fallback_warnings, list) and fallback_warnings:
                existing = task.artifacts.get("fallbackWarnings")
                if not isinstance(existing, list):
                    existing = []
                task.artifacts["fallbackWarnings"] = [*existing, *fallback_warnings]
            self._touch(task)

    def _mark_success(self, task_id: str) -> None:
        with self._lock:
            task = self.tasks[task_id]
            task.status = "success"
            task.current_step = None
            task.progress = 100
            self._log_once(task, "Voice script, TTS artifact, and final video completed.")
            self._touch(task)

    def _mark_error(self, task_id: str, step_id: str, exc: Exception) -> None:
        with self._lock:
            task = self.tasks.get(task_id)
            if task is None:
                return
            task.status = "error"
            task.current_step = step_id
            try:
                step = self._find_step(task, step_id)
                step.status = "error"
                step.progress = max(step.progress, 1)
                step.output = str(exc)
            except ValueError:
                pass
            task.logs.append(TaskLog(timestamp=datetime.utcnow(), level="error", message=f"{step_id} failed: {exc}"))
            task.logs.append(
                TaskLog(
                    timestamp=datetime.utcnow(),
                    level="error",
                    message=traceback.format_exc(limit=6),
                )
            )
            self._touch(task)

    def _find_step(self, task: Task, step_id: str) -> WorkflowStep:
        for step in task.steps:
            if step.id == step_id:
                return step
        raise ValueError(f"Unknown task step: {step_id}")

    def _log_many(self, task_id: str, messages: list[str]) -> None:
        for message in messages:
            self._log(task_id, "info", message)

    def _log(self, task_id: str, level: str, message: str) -> None:
        with self._lock:
            task = self.tasks.get(task_id)
            if task is None:
                return
            task.logs.append(TaskLog(timestamp=datetime.utcnow(), level=level, message=message))
            self._touch(task)

    def _log_once(self, task: Task, message: str) -> None:
        if not any(log.message == message for log in task.logs):
            task.logs.append(TaskLog(timestamp=datetime.utcnow(), level="info", message=message))

    def _recompute_progress(self, task: Task) -> None:
        if not task.steps:
            task.progress = 0
            return
        task.progress = round(sum(step.progress for step in task.steps) / len(task.steps))

    def _touch(self, task: Task) -> None:
        task.updated_at = datetime.utcnow()

task_service = TaskService()
