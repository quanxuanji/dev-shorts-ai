import shutil
import subprocess
import wave
from pathlib import Path
from typing import Any

from app.services.settings_service import settings_service


PREFERRED_FFMPEG_PATHS = [
    "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg",
    "/usr/local/opt/ffmpeg-full/bin/ffmpeg",
]


class VideoRenderService:
    async def render(self, task_id: str | None = None) -> dict[str, str]:
        return {
            "render_url": "mock://video/devshorts-final.mp4",
            "subtitle_url": "mock://subtitle/devshorts.srt",
            "broll_manifest": "mock://manifest/broll.json",
            "task_id": task_id or "adhoc",
        }

    def render_final(
        self,
        *,
        input_video: Path,
        voice_audio: Path,
        subtitle_path: Path,
        output_dir: Path,
    ) -> tuple[Path, list[str], dict[str, Any]]:
        logs: list[str] = []
        metadata: dict[str, Any] = {
            "renderMode": "subtitled",
            "renderSourceMode": "input",
            "fallbackWarnings": [],
        }
        final_path = output_dir / "final.mp4"
        ffmpeg_path = self._ffmpeg_path()

        if not ffmpeg_path:
            final_path.write_bytes(b"")
            warning = "ffmpeg is not installed; wrote empty final.mp4 placeholder."
            metadata["renderMode"] = "placeholder"
            metadata["fallbackWarnings"].append(warning)
            return final_path, [f"[FFmpeg] {warning}"], metadata

        voice_duration_seconds = self._media_duration_seconds(voice_audio)
        video_source = self._valid_video_or_placeholder(
            input_video,
            output_dir,
            logs,
            metadata,
            ffmpeg_path,
            fallback_duration_seconds=max(1.0, voice_duration_seconds or 12.0),
        )
        runtime_settings = settings_service.get()
        subtitle_filter = (
            "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,"
            f"subtitles=filename='{self._subtitle_filter_path(subtitle_path, output_dir)}'"
            f":force_style='{self._escape_filter_value(runtime_settings.subtitle_style)}'"
        )
        command = self._render_command(ffmpeg_path, video_source, voice_audio, final_path, subtitle_filter)
        result = subprocess.run(command, capture_output=True, text=True, timeout=300, cwd=output_dir)

        if result.returncode == 0 and final_path.exists() and final_path.stat().st_size > 0:
            logs.append(f"[FFmpeg] rendered final video with burned subtitles at {final_path}")
            return final_path, logs, metadata

        warning = f"subtitle burn failed; rendered final video without burned subtitles: {result.stderr[-300:]}"
        metadata["renderMode"] = "no_subtitles"
        metadata["fallbackWarnings"].append(warning)
        logs.append(f"[FFmpeg] {warning}")
        scale_filter = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"
        result = subprocess.run(
            self._render_command(ffmpeg_path, video_source, voice_audio, final_path, scale_filter),
            capture_output=True,
            text=True,
            timeout=300,
            cwd=output_dir,
        )
        if result.returncode == 0 and final_path.exists() and final_path.stat().st_size > 0:
            logs.append(f"[FFmpeg] rendered final video without subtitle burn at {final_path}")
            return final_path, logs, metadata

        warning = f"final render failed; wrote empty final.mp4 placeholder: {result.stderr[-300:]}"
        metadata["renderMode"] = "placeholder"
        metadata["fallbackWarnings"].append(warning)
        logs.append(f"[FFmpeg] {warning}")
        final_path.write_bytes(b"")
        return final_path, logs, metadata

    def _render_command(
        self,
        ffmpeg_path: str,
        video_source: Path,
        voice_audio: Path,
        final_path: Path,
        vf: str,
    ) -> list[str]:
        return [
            ffmpeg_path,
            "-y",
            "-i",
            str(video_source.resolve()),
            "-i",
            str(voice_audio.resolve()),
            "-vf",
            vf,
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-shortest",
            "-c:v",
            "libx264",
            "-c:a",
            "aac",
            "-pix_fmt",
            "yuv420p",
            str(final_path.resolve()),
        ]

    def _ffmpeg_path(self) -> str | None:
        for candidate in PREFERRED_FFMPEG_PATHS:
            if Path(candidate).exists() and self._supports_filter(candidate, "subtitles"):
                return candidate
        return shutil.which("ffmpeg")

    def _supports_filter(self, ffmpeg_path: str, filter_name: str) -> bool:
        result = subprocess.run(
            [ffmpeg_path, "-hide_banner", "-filters"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return result.returncode == 0 and f" {filter_name} " in result.stdout

    def _valid_video_or_placeholder(
        self,
        input_video: Path,
        output_dir: Path,
        logs: list[str],
        metadata: dict[str, Any],
        ffmpeg_path: str,
        fallback_duration_seconds: float,
    ) -> Path:
        if input_video.exists() and input_video.stat().st_size > 0:
            return input_video

        metadata["renderSourceMode"] = "fallback_source"
        placeholder = output_dir / "render_source.mp4"
        duration = f"{fallback_duration_seconds:.3f}"
        command = [
            ffmpeg_path,
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"color=c=0b1020:s=1080x1920:d={duration}",
            "-pix_fmt",
            "yuv420p",
            str(placeholder),
        ]
        subprocess.run(command, capture_output=True, text=True, timeout=120)
        if placeholder.exists() and placeholder.stat().st_size > 0:
            if not input_video.exists():
                warning = f"input video does not exist ({input_video}); generated render fallback source."
            else:
                warning = f"input video is empty ({input_video}); generated render fallback source."
            metadata["fallbackWarnings"].append(warning)
            logs.append(f"[FFmpeg] generated render fallback source at {placeholder}")
            return placeholder

        warning = "could not generate render fallback source; attempted render with original input."
        metadata["fallbackWarnings"].append(warning)
        logs.append(f"[FFmpeg] {warning}")
        return input_video

    def _media_duration_seconds(self, media_path: Path) -> float:
        if not media_path.exists() or media_path.stat().st_size <= 0:
            return 0.0
        try:
            with wave.open(str(media_path), "rb") as wav:
                frame_rate = wav.getframerate()
                if frame_rate > 0:
                    return wav.getnframes() / frame_rate
        except wave.Error:
            pass

        ffprobe_path = shutil.which("ffprobe")
        if not ffprobe_path:
            return 0.0
        result = subprocess.run(
            [
                ffprobe_path,
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(media_path.resolve()),
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            return 0.0
        try:
            return float(result.stdout.strip())
        except ValueError:
            return 0.0

    def _subtitle_filter_path(self, subtitle_path: Path, output_dir: Path) -> str:
        try:
            filter_path = subtitle_path.resolve().relative_to(output_dir.resolve())
        except ValueError:
            filter_path = subtitle_path.resolve()
        return self._escape_filter_value(str(filter_path))

    def _escape_filter_value(self, value: str) -> str:
        return value.replace("\\", "\\\\").replace("'", "\\'")
