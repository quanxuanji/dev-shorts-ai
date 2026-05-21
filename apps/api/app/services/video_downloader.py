import shutil
import subprocess
from pathlib import Path


class VideoDownloader:
    def prepare_source(
        self,
        *,
        output_dir: Path,
        source_url: str = "",
        local_file_path: str | None = None,
    ) -> tuple[Path, list[str]]:
        logs: list[str] = []
        output_path = output_dir / "input.mp4"

        if local_file_path:
            source_path = Path(local_file_path).expanduser()
            if not source_path.exists():
                raise FileNotFoundError(f"Local video file not found: {source_path}")
            shutil.copyfile(source_path, output_path)
            logs.append(f"[Video] copied local file to {output_path}")
            return output_path, logs

        if not source_url:
            raise ValueError("Either source_url or local_file_path is required.")

        source_as_path = Path(source_url).expanduser()
        if source_as_path.exists() and source_as_path.is_file():
            shutil.copyfile(source_as_path, output_path)
            logs.append(f"[Video] detected local path in source_url and copied it to {output_path}")
            return output_path, logs

        if shutil.which("yt-dlp"):
            download_template = output_dir / "download.%(ext)s"
            command = [
                "yt-dlp",
                "-f",
                "mp4/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best",
                "--merge-output-format",
                "mp4",
                "-o",
                str(download_template),
                source_url,
            ]
            result = subprocess.run(command, capture_output=True, text=True, timeout=300)
            downloaded = output_dir / "download.mp4"
            if result.returncode == 0 and downloaded.exists():
                shutil.copyfile(downloaded, output_path)
                logs.append(f"[yt-dlp] downloaded source video to {output_path}")
                return output_path, logs
            logs.append(f"[yt-dlp] download failed, falling back to generated demo video: {result.stderr[-300:]}")
        else:
            logs.append("[yt-dlp] not installed, falling back to generated demo video.")

        self._generate_placeholder_video(output_path)
        logs.append(f"[Video] generated fallback input video at {output_path}")
        return output_path, logs

    def _generate_placeholder_video(self, output_path: Path) -> None:
        if shutil.which("ffmpeg"):
            command = [
                "ffmpeg",
                "-y",
                "-f",
                "lavfi",
                "-i",
                "color=c=0x0b1020:s=1080x1920:d=12",
                "-vf",
                "drawtext=text='DevShorts AI Semi-real MVP':fontcolor=white:fontsize=54:x=(w-text_w)/2:y=(h-text_h)/2",
                "-pix_fmt",
                "yuv420p",
                str(output_path),
            ]
            subprocess.run(command, capture_output=True, text=True, timeout=120)
            if output_path.exists():
                return
        output_path.write_bytes(b"")
