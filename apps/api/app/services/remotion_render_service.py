import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any


class RemotionRenderService:
    def __init__(self, project_root: Path | None = None) -> None:
        self.project_root = project_root or Path(__file__).resolve().parents[4]
        self.render_app_dir = self.project_root / "apps" / "render"

    def render_final(
        self,
        *,
        output_dir: Path,
        scenes: list[dict[str, Any]],
        audio_path: Path | None = None,
        timeline: list[dict[str, Any]] | None = None,
    ) -> tuple[Path, list[str], dict[str, Any]]:
        output_dir = output_dir.resolve()
        logs: list[str] = []
        final_path = output_dir / "final.mp4"
        manifest_path = output_dir / "render_manifest.json"
        timeline_path = output_dir / "timeline.json"
        metadata: dict[str, Any] = {
            "renderProvider": "remotion",
            "renderMode": "remotion",
            "renderManifestPath": str(manifest_path),
            "fallbackWarnings": [],
        }

        if timeline:
            self._validate_timeline(timeline)
        manifest = self._build_manifest(scenes, output_dir, audio_path=audio_path, timeline=timeline)
        if timeline:
            total_frames = sum(int(item.get("durationInFrames") or 0) for item in timeline)
            timeline_path.write_text(
                json.dumps(
                    {
                        "fps": manifest["manifest"].get("fps", 30),
                        "totalFrames": total_frames,
                        "source": "segmented_tts_audio_duration",
                        "items": timeline,
                    },
                    ensure_ascii=False,
                    indent=2,
                ),
                encoding="utf-8",
            )
            metadata["timelinePath"] = str(timeline_path)
            metadata["totalFrames"] = total_frames
            logs.extend(self._timeline_debug_logs(timeline, audio_path, total_frames))
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

        npm_command = "npm.cmd" if os.name == "nt" else "npm"
        command = [
            npm_command,
            "--workspace",
            "apps/render",
            "exec",
            "--",
            "remotion",
            "render",
            "DevShortsPortrait",
            str(final_path.resolve()),
            f"--props={manifest_path.resolve()}",
            f"--public-dir={output_dir.resolve()}",
        ]

        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=600,
                cwd=self.project_root,
            )
        except Exception as exc:
            warning = f"Remotion render command failed to start: {exc}"
            logs.append(f"[Remotion] failed: {warning}")
            metadata["renderMode"] = "remotion_failed"
            metadata["fallbackWarnings"].append(warning)
            return final_path, logs, metadata

        if final_path.exists() and final_path.stat().st_size > 0:
            if result.returncode != 0:
                warning = f"Remotion CLI returned {result.returncode} after writing final.mp4: {(result.stderr or result.stdout)[-300:]}"
                metadata["fallbackWarnings"].append(warning)
                logs.append(f"[Remotion] warning: {warning}")
            logs.append(f"[Remotion] rendered final video at {final_path}")
            final_duration = self._media_duration_seconds(final_path)
            if final_duration > 0:
                logs.append(f"[Timeline] final.mp4 duration={final_duration:.3f}s")
                metadata["finalVideoDurationSeconds"] = round(final_duration, 3)
                if timeline:
                    sync_logs, sync_ok, sync_metadata = self._run_sync_check(output_dir)
                    logs.extend(sync_logs)
                    metadata.update(sync_metadata)
                    if not sync_ok:
                        metadata["renderMode"] = "remotion_sync_failed"
                        metadata["fallbackWarnings"].append("Remotion sync check failed.")
                        return final_path, logs, metadata
            return final_path, logs, metadata

        warning = f"Remotion render failed: {(result.stderr or result.stdout)[-500:]}"
        logs.append(f"[Remotion] failed: {warning}")
        metadata["renderMode"] = "remotion_failed"
        metadata["fallbackWarnings"].append(warning)
        return final_path, logs, metadata

    def _build_manifest(
        self,
        scenes: list[dict[str, Any]],
        output_dir: Path,
        audio_path: Path | None = None,
        timeline: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        safe_scenes = []
        for index, scene in enumerate(scenes, start=1):
            text = str(scene.get("text") or scene.get("caption") or "").strip()
            safe_scene = {
                "id": scene.get("id") or f"scene-{index:03d}",
                "title": str(scene.get("title") or f"Scene {index}"),
                "caption": str(scene.get("caption") or text),
                "text": text,
                "audioPath": self._public_audio_path(scene.get("audioPath"), output_dir, index),
                "duration": max(1.0, float(scene.get("duration") or 3.0)),
            }
            for key in ["rank", "name", "description", "growth", "whyHot", "tags"]:
                if key in scene and scene[key] not in (None, ""):
                    safe_scene[key] = scene[key]
            safe_scenes.append(safe_scene)

        is_ranked_project = any(self._looks_like_ranked_project_scene(scene) for scene in safe_scenes)
        if is_ranked_project:
            safe_scenes = [self._normalize_ranked_project_scene(scene) for scene in safe_scenes]
        manifest = {
            "template": "github-weekly-top8" if is_ranked_project else "creator-short",
            "title": "GitHub 本周最火 AI 项目 TOP8" if is_ranked_project else "DevShorts AI",
            "subtitle": "程序员一定要知道的 AI 工具" if is_ranked_project else "AI Voice Video Studio",
            "fps": 30,
            "width": 1080,
            "height": 1920,
            "scenes": safe_scenes,
        }
        if audio_path:
            manifest["audioPath"] = self._public_audio_path(str(audio_path), output_dir, 0)
        if timeline:
            manifest["timeline"] = timeline
            manifest["totalFrames"] = sum(int(item.get("durationInFrames") or 0) for item in timeline)
        return {"manifest": manifest}

    def _looks_like_ranked_project_scene(self, scene: dict[str, Any]) -> bool:
        title = str(scene.get("title") or "")
        return bool(scene.get("rank") or scene.get("name") or scene.get("growth") or re.search(r"\bTOP\s*\d+\b", title, re.IGNORECASE))

    def _normalize_ranked_project_scene(self, scene: dict[str, Any]) -> dict[str, Any]:
        title = str(scene.get("title") or "")
        is_project_scene = bool(scene.get("rank") or scene.get("name") or scene.get("growth") or re.search(r"\bTOP\s*\d+\b", title, re.IGNORECASE))
        if not is_project_scene:
            return scene
        if scene.get("rank") in (None, ""):
            raise ValueError(f"ranked project scene is missing rank: {title}")
        normalized = dict(scene)
        normalized["title"] = self._clean_project_title(str(scene.get("name") or title))
        normalized["name"] = self._clean_project_title(str(scene.get("name") or title))
        return normalized

    def _clean_project_title(self, title: str) -> str:
        cleaned = re.sub(r"^\s*(?:TOP\s*)?\d+\s*[:：.-]?\s*", "", title, flags=re.IGNORECASE)
        cleaned = re.sub(r"^\s*TOP\s*\d+\s*[:：.-]?\s*", "", cleaned, flags=re.IGNORECASE)
        return cleaned.strip() or title

    def _timeline_debug_logs(
        self,
        timeline: list[dict[str, Any]],
        audio_path: Path | None,
        total_frames: int,
    ) -> list[str]:
        logs = [f"[Timeline] totalFrames={total_frames}"]
        if audio_path:
            voice_duration = self._media_duration_seconds(audio_path)
            if voice_duration > 0:
                logs.insert(0, f"[Timeline] voice.wav duration={voice_duration:.3f}s")
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

    def _validate_timeline(self, timeline: list[dict[str, Any]]) -> None:
        for item in timeline:
            if item.get("durationSource") != "generated_audio_duration":
                raise ValueError("timeline must be generated from real segment audio durations")
            visual_start = item.get("visualStartMs")
            speech_start = item.get("speechStartMs")
            if isinstance(visual_start, (int, float)) and isinstance(speech_start, (int, float)):
                if visual_start > speech_start:
                    raise ValueError("visualStartMs must not be later than speechStartMs")

    def _media_duration_seconds(self, path: Path) -> float:
        if not path.exists():
            return 0.0
        command = [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ]
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=30)
        except Exception:
            return 0.0
        if result.returncode != 0:
            return 0.0
        try:
            return float((result.stdout or "").strip())
        except ValueError:
            return 0.0

    def _run_sync_check(self, output_dir: Path) -> tuple[list[str], bool, dict[str, Any]]:
        script_path = self.project_root / "apps" / "api" / "scripts" / "check_sync.py"
        report_path = output_dir / "sync-report.json"
        if not script_path.exists():
            return [f"[SyncCheck] skipped; script missing at {script_path}"], True, {}
        command = [sys.executable, str(script_path), str(output_dir)]
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=180, cwd=self.project_root)
        except Exception as exc:
            return [f"[SyncCheck] failed to start: {exc}"], False, {"syncReportPath": str(report_path)}

        logs = [f"[SyncCheck] report={report_path}"]
        if result.stdout.strip():
            logs.append(f"[SyncCheck] stdout: {result.stdout.strip()[-500:]}")
        if result.stderr.strip():
            logs.append(f"[SyncCheck] stderr: {result.stderr.strip()[-500:]}")
        if result.returncode == 0:
            logs.append("[SyncCheck] passed.")
            return logs, True, {"syncReportPath": str(report_path), "syncCheckStatus": "pass"}
        logs.append(f"[SyncCheck] failed with exit code {result.returncode}.")
        return logs, False, {"syncReportPath": str(report_path), "syncCheckStatus": "fail"}

    def _public_audio_path(self, audio_path_value: Any, output_dir: Path, index: int) -> str:
        if not audio_path_value:
            return ""
        audio_path = Path(str(audio_path_value))
        if not audio_path.is_absolute():
            candidates = [
                (Path.cwd() / audio_path).resolve(),
                (self.project_root / audio_path).resolve(),
                (output_dir / audio_path).resolve(),
            ]
            for candidate in candidates:
                try:
                    return candidate.relative_to(output_dir.resolve()).as_posix()
                except ValueError:
                    continue
            return audio_path.as_posix()
        try:
            return audio_path.resolve().relative_to(output_dir.resolve()).as_posix()
        except ValueError:
            asset_dir = output_dir / "remotion_assets"
            asset_dir.mkdir(parents=True, exist_ok=True)
            suffix = audio_path.suffix or ".wav"
            copied_path = asset_dir / f"scene_{index:03d}{suffix}"
            if audio_path.exists() and audio_path.resolve() != copied_path.resolve():
                shutil.copy2(audio_path, copied_path)
            return copied_path.relative_to(output_dir).as_posix()
