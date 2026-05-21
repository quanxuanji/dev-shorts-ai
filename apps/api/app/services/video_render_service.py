import shutil
import subprocess
from pathlib import Path

from app.services.settings_service import settings_service


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
    ) -> tuple[Path, list[str]]:
        logs: list[str] = []
        final_path = output_dir / "final.mp4"

        if not shutil.which("ffmpeg"):
            final_path.write_bytes(b"")
            return final_path, ["[FFmpeg] not installed; wrote empty final.mp4 placeholder."]

        video_source = self._valid_video_or_placeholder(input_video, output_dir, logs)
        runtime_settings = settings_service.get()
        subtitle_filter = (
            "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,"
            f"subtitles=subtitles.srt:force_style='{runtime_settings.subtitle_style}'"
        )
        command = self._render_command(video_source, voice_audio, final_path, subtitle_filter)
        result = subprocess.run(command, capture_output=True, text=True, timeout=300, cwd=output_dir)

        if result.returncode == 0 and final_path.exists() and final_path.stat().st_size > 0:
            logs.append(f"[FFmpeg] rendered final video with burned subtitles at {final_path}")
            return final_path, logs

        logs.append(f"[FFmpeg] subtitle burn failed, retrying without subtitles: {result.stderr[-300:]}")
        scale_filter = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"
        result = subprocess.run(
            self._render_command(video_source, voice_audio, final_path, scale_filter),
            capture_output=True,
            text=True,
            timeout=300,
            cwd=output_dir,
        )
        if result.returncode == 0 and final_path.exists() and final_path.stat().st_size > 0:
            logs.append(f"[FFmpeg] rendered final video without subtitle burn at {final_path}")
            return final_path, logs

        logs.append(f"[FFmpeg] final render failed; writing placeholder: {result.stderr[-300:]}")
        final_path.write_bytes(b"")
        return final_path, logs

    def _render_command(self, video_source: Path, voice_audio: Path, final_path: Path, vf: str) -> list[str]:
        return [
            "ffmpeg",
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

    def _valid_video_or_placeholder(self, input_video: Path, output_dir: Path, logs: list[str]) -> Path:
        if input_video.exists() and input_video.stat().st_size > 0:
            return input_video

        placeholder = output_dir / "render_source.mp4"
        command = [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=0b1020:s=1080x1920:d=12",
            "-pix_fmt",
            "yuv420p",
            str(placeholder),
        ]
        subprocess.run(command, capture_output=True, text=True, timeout=120)
        if placeholder.exists() and placeholder.stat().st_size > 0:
            logs.append(f"[FFmpeg] generated render fallback source at {placeholder}")
            return placeholder

        logs.append("[FFmpeg] could not generate render fallback source; using original input.")
        return input_video
