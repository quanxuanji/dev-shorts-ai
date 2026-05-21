import asyncio
import threading
import traceback
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.models import CreateTaskRequest, Task, TaskLog, WorkflowStep
from app.services.asr_service import ASRService
from app.services.audio_extractor import AudioExtractor
from app.services.llm_service import LLMService
from app.services.publish_service import PublishService
from app.services.subtitle_service import SubtitleService
from app.services.title_cover_service import TitleCoverService
from app.services.tts_service import TTSService
from app.services.video_downloader import VideoDownloader
from app.services.video_render_service import VideoRenderService


MOCK_STEP_DEFINITIONS = [
    ("extract", "Extract Script"),
    ("rewrite", "Rewrite"),
    ("tts", "Voice"),
    ("digital-human", "Digital Human"),
    ("render", "Render"),
    ("cover", "Cover"),
    ("publish", "Publish"),
]

SEMI_REAL_STEP_DEFINITIONS = [
    ("inputVideo", "Input Video"),
    ("audio", "Audio"),
    ("transcript", "Transcript"),
    ("rewrittenScript", "Rewritten Script"),
    ("voice", "Voice"),
    ("subtitles", "Subtitles"),
    ("titleCover", "Title & Cover"),
    ("finalVideo", "Final Video"),
    ("publishDraft", "Publish Draft"),
]

MOCK_OUTPUTS: dict[str, Any] = {
    "extract": "Extracted a mock source transcript.",
    "rewrite": "Generated a 45 second mock short-video script.",
    "tts": "Generated a studio-default mock voiceover.",
    "digital-human": "Generated a placeholder lip-sync video.",
    "render": "Generated mock subtitles and B-roll manifest.",
    "cover": "Generated three mock title and cover prompts.",
    "publish": "Created a mock publishing task.",
}

STEP_SECONDS = 1.4


class TaskService:
    def __init__(self) -> None:
        self.tasks: dict[str, Task] = {}
        self._lock = threading.RLock()
        self.video_downloader = VideoDownloader()
        self.audio_extractor = AudioExtractor()
        self.asr_service = ASRService()
        self.llm_service = LLMService()
        self.publish_service = PublishService()
        self.subtitle_service = SubtitleService()
        self.title_cover_service = TitleCoverService()
        self.tts_service = TTSService()
        self.video_render_service = VideoRenderService()

    def create_task(self, payload: CreateTaskRequest) -> Task:
        now = datetime.utcnow()
        task_id = str(uuid.uuid4())
        step_definitions = SEMI_REAL_STEP_DEFINITIONS if payload.mode == "semi_real" else MOCK_STEP_DEFINITIONS
        task = Task(
            id=task_id,
            title=payload.title or "DevShorts AI Demo Pipeline",
            source_url=payload.source_url,
            local_file_path=payload.local_file_path,
            topic=payload.topic,
            target_style=payload.target_style,
            speaking_style=payload.speaking_style,
            mode=payload.mode,
            status="queued",
            created_at=now,
            updated_at=now,
            steps=[WorkflowStep(id=step_id, label=label) for step_id, label in step_definitions],
            logs=[
                TaskLog(
                    timestamp=now,
                    level="info",
                    message=(
                        "Task created. Waiting for local mock runner."
                        if payload.mode == "mock"
                        else "Task created. Semi-real worker queued."
                    ),
                )
            ],
            artifacts={},
        )

        with self._lock:
            self.tasks[task_id] = task

        if payload.mode == "semi_real":
            worker = threading.Thread(target=self._run_semi_real_task, args=(task_id, payload), daemon=True)
            worker.start()

        return task

    def get_task(self, task_id: str) -> Task | None:
        with self._lock:
            task = self.tasks.get(task_id)
            if task is not None and task.mode == "mock":
                self._advance_mock_task(task)
            return task

    def recent_tasks(self) -> list[Task]:
        with self._lock:
            for task in self.tasks.values():
                if task.mode == "mock":
                    self._advance_mock_task(task)
            return sorted(self.tasks.values(), key=lambda task: task.created_at, reverse=True)[:8]

    def queue_depth(self) -> int:
        with self._lock:
            return len([task for task in self.tasks.values() if task.status in ["queued", "running"]])

    def _run_semi_real_task(self, task_id: str, payload: CreateTaskRequest) -> None:
        active_step = "inputVideo"
        try:
            output_dir = Path(settings.artifacts_dir) / task_id
            output_dir.mkdir(parents=True, exist_ok=True)
            self._set_task_running(task_id)
            self._set_artifact(task_id, "outputDir", str(output_dir))

            active_step = "inputVideo"
            self._start_step(task_id, active_step)
            input_video, logs = self.video_downloader.prepare_source(
                output_dir=output_dir,
                source_url=payload.source_url,
                local_file_path=payload.local_file_path,
            )
            self._log_many(task_id, logs)
            self._complete_step(task_id, active_step, {"path": str(input_video)})

            active_step = "audio"
            self._start_step(task_id, active_step)
            audio_path, logs = self.audio_extractor.extract_audio(input_video, output_dir)
            self._log_many(task_id, logs)
            self._complete_step(task_id, active_step, {"path": str(audio_path)})

            active_step = "transcript"
            self._start_step(task_id, active_step)
            transcript, logs = self.asr_service.transcribe(audio_path, output_dir)
            self._log_many(task_id, logs)
            self._complete_step(
                task_id,
                active_step,
                {"path": str(output_dir / "transcript.txt"), "preview": transcript[:240]},
            )

            active_step = "rewrittenScript"
            self._start_step(task_id, active_step)
            rewritten_script, logs = asyncio.run(
                self.llm_service.rewrite_with_logs(
                    transcript,
                    payload.topic,
                    payload.target_style,
                    payload.speaking_style,
                )
            )
            script_path = output_dir / "rewritten_script.txt"
            script_path.write_text(rewritten_script, encoding="utf-8")
            self._log_many(task_id, logs)
            self._complete_step(
                task_id,
                active_step,
                {"path": str(script_path), "preview": rewritten_script[:240]},
            )

            active_step = "voice"
            self._start_step(task_id, active_step)
            voice_path, logs = self.tts_service.synthesize_to_file(
                rewritten_script,
                voice="studio-default",
                output_dir=output_dir,
            )
            self._log_many(task_id, logs)
            self._complete_step(task_id, active_step, {"path": str(voice_path)})

            active_step = "subtitles"
            self._start_step(task_id, active_step)
            voice_duration = self._probe_duration_seconds(voice_path)
            subtitle_path, logs = self.subtitle_service.create_subtitles(
                rewritten_script,
                output_dir,
                duration_seconds=voice_duration,
            )
            self._log_many(task_id, logs)
            self._complete_step(task_id, active_step, {"path": str(subtitle_path)})

            active_step = "titleCover"
            self._start_step(task_id, active_step)
            title_cover_path, logs, title_cover = self.title_cover_service.generate(
                script=rewritten_script,
                topic=payload.topic,
                target_style=payload.target_style,
                output_dir=output_dir,
            )
            self._log_many(task_id, logs)
            self._complete_step(
                task_id,
                active_step,
                {"path": str(title_cover_path), "preview": title_cover},
            )

            active_step = "finalVideo"
            self._start_step(task_id, active_step)
            final_path, logs = self.video_render_service.render_final(
                input_video=input_video,
                voice_audio=voice_path,
                subtitle_path=subtitle_path,
                output_dir=output_dir,
            )
            self._log_many(task_id, logs)
            self._complete_step(task_id, active_step, {"path": str(final_path)})

            active_step = "publishDraft"
            self._start_step(task_id, active_step)
            publish_draft_path, logs, publish_draft = self.publish_service.create_draft(
                output_dir=output_dir,
                final_video=final_path,
                title_cover_path=title_cover_path,
            )
            self._log_many(task_id, logs)
            self._complete_step(
                task_id,
                active_step,
                {"path": str(publish_draft_path), "preview": publish_draft},
            )

            self._log(task_id, "info", "Digital human step skipped for semi-real MVP.")
            self._mark_success(task_id)
        except Exception as exc:
            self._mark_error(task_id, active_step, exc)

    def _advance_mock_task(self, task: Task) -> None:
        if task.status in ["success", "error"]:
            return

        elapsed = max((datetime.utcnow() - task.created_at).total_seconds() - 0.4, 0)

        if elapsed > 0 and task.status == "queued":
            task.status = "running"
            self._log_once(task, "Mock pipeline runner started.")

        for index, step in enumerate(task.steps):
            start_at = index * STEP_SECONDS
            end_at = start_at + STEP_SECONDS

            if elapsed <= start_at:
                step.status = "pending"
                step.progress = 0
                continue

            if elapsed >= end_at:
                step.status = "success"
                step.progress = 100
                step.output = MOCK_OUTPUTS[step.id]
                task.artifacts[step.id] = MOCK_OUTPUTS[step.id]
                self._log_once(task, f"{step.label} completed: {MOCK_OUTPUTS[step.id]}")
                continue

            step.status = "running"
            step.progress = min(int(((elapsed - start_at) / STEP_SECONDS) * 100), 96)
            task.current_step = step.id
            self._log_once(task, f"{step.label} started.")

        if all(step.status == "success" for step in task.steps):
            task.status = "success"
            task.current_step = None
            self._log_once(task, "Pipeline completed. Final video mock artifact is ready.")

        self._recompute_progress(task)
        self._touch(task)

    def _set_task_running(self, task_id: str) -> None:
        with self._lock:
            task = self.tasks[task_id]
            task.status = "running"
            self._log_once(task, "Semi-real worker started.")
            self._touch(task)

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
            if step_id == "transcript":
                task.artifacts[step_id] = artifact.get("preview", "")
                task.artifacts["transcriptPath"] = artifact.get("path", "")
                segments_path = Path(str(artifact.get("path", ""))).with_name("transcript_segments.json")
                if segments_path.exists():
                    task.artifacts["transcriptSegments"] = str(segments_path)
            elif step_id == "rewrittenScript":
                task.artifacts[step_id] = artifact.get("preview", "")
                task.artifacts["rewrittenScriptPath"] = artifact.get("path", "")
            elif step_id == "titleCover":
                task.artifacts[step_id] = artifact.get("preview", {})
                task.artifacts["titleCoverPath"] = artifact.get("path", "")
            elif step_id == "publishDraft":
                task.artifacts[step_id] = artifact.get("preview", {})
                task.artifacts["publishDraftPath"] = artifact.get("path", "")
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

    def _mark_success(self, task_id: str) -> None:
        with self._lock:
            task = self.tasks[task_id]
            task.status = "success"
            task.current_step = None
            task.progress = 100
            self._log_once(task, "Semi-real pipeline completed. Final video artifact is ready.")
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

    def _probe_duration_seconds(self, media_path: Path) -> float | None:
        try:
            import subprocess

            result = subprocess.run(
                [
                    "ffprobe",
                    "-v",
                    "error",
                    "-show_entries",
                    "format=duration",
                    "-of",
                    "default=noprint_wrappers=1:nokey=1",
                    str(media_path),
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode == 0:
                duration = float(result.stdout.strip())
                return duration if duration > 0 else None
        except Exception:
            return None
        return None


task_service = TaskService()
