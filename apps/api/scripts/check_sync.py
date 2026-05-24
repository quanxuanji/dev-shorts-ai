#!/usr/bin/env python3
"""Check timeline/audio/video sync gates for a rendered output directory."""

from __future__ import annotations

import argparse
import json
import math
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


DEFAULT_FPS = 30.0
DEFAULT_SILENCE_NOISE = "-35dB"
DEFAULT_SILENCE_DURATION = 0.1
FRAME_GRACE_MS = 100


@dataclass
class SceneTiming:
    index: int
    scene_id: str
    silence_end_ms: float | None
    visual_start_ms: float | None
    from_frame: int | None
    raw: dict[str, Any]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Validate timeline.json scene handoff timing against rendered audio/video. "
            "Writes sync-report.json and sync_frames/ under the output directory."
        )
    )
    parser.add_argument(
        "output_dir",
        type=Path,
        help="Directory containing timeline.json, voice.wav, and final.mp4.",
    )
    parser.add_argument(
        "--ffmpeg",
        default="ffmpeg",
        help="ffmpeg executable to use. Defaults to ffmpeg on PATH.",
    )
    parser.add_argument(
        "--silence-noise",
        default=DEFAULT_SILENCE_NOISE,
        help="silencedetect noise threshold. Defaults to -35dB.",
    )
    parser.add_argument(
        "--silence-duration",
        type=float,
        default=DEFAULT_SILENCE_DURATION,
        help="silencedetect minimum silence duration in seconds. Defaults to 0.1.",
    )
    return parser.parse_args()


def load_timeline(timeline_path: Path) -> dict[str, Any]:
    with timeline_path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise ValueError("timeline.json must contain a JSON object")
    return data


def find_scenes(data: dict[str, Any]) -> list[dict[str, Any]]:
    candidates: list[Any] = [
        data.get("items"),
        data.get("scenes"),
        data.get("timeline", {}).get("scenes") if isinstance(data.get("timeline"), dict) else None,
        data.get("timeline", {}).get("items") if isinstance(data.get("timeline"), dict) else None,
        data.get("manifest", {}).get("scenes") if isinstance(data.get("manifest"), dict) else None,
        data.get("manifest", {}).get("timeline") if isinstance(data.get("manifest"), dict) else None,
    ]
    for candidate in candidates:
        if isinstance(candidate, list) and all(isinstance(item, dict) for item in candidate):
            return candidate
    raise ValueError("timeline.json must include an items, timeline, or scenes array")


def find_fps(data: dict[str, Any]) -> float:
    candidates = [
        data.get("fps"),
        data.get("frameRate"),
        data.get("timeline", {}).get("fps") if isinstance(data.get("timeline"), dict) else None,
        data.get("manifest", {}).get("fps") if isinstance(data.get("manifest"), dict) else None,
    ]
    for candidate in candidates:
        number = as_float(candidate)
        if number and number > 0:
            return number
    return DEFAULT_FPS


def as_float(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def as_int(value: Any) -> int | None:
    number = as_float(value)
    if number is None:
        return None
    return int(number)


def first_number(scene: dict[str, Any], keys: tuple[str, ...]) -> float | None:
    for key in keys:
        value = as_float(scene.get(key))
        if value is not None:
            return value
    return None


def first_int(scene: dict[str, Any], keys: tuple[str, ...]) -> int | None:
    for key in keys:
        value = as_int(scene.get(key))
        if value is not None:
            return value
    return None


def normalize_scenes(raw_scenes: list[dict[str, Any]], fps: float) -> list[SceneTiming]:
    scenes: list[SceneTiming] = []
    for index, scene in enumerate(raw_scenes):
        scene_id = str(scene.get("id") or scene.get("sceneId") or f"scene-{index + 1:03d}")
        visual_start_ms = first_number(scene, ("visualStartMs", "startMs", "startTimeMs"))
        from_frame = first_int(scene, ("fromFrame", "startFrame", "frame"))
        if visual_start_ms is None and from_frame is not None:
            visual_start_ms = from_frame / fps * 1000.0
        if from_frame is None and visual_start_ms is not None:
            from_frame = math.floor(visual_start_ms / 1000.0 * fps)

        scenes.append(
            SceneTiming(
                index=index,
                scene_id=scene_id,
                silence_end_ms=first_number(scene, ("silenceEndMs", "audioSilenceEndMs")),
                visual_start_ms=visual_start_ms,
                from_frame=from_frame,
                raw=scene,
            )
        )
    return scenes


def safe_name(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip("-")
    return cleaned[:80] or "scene"


def run_silencedetect(
    ffmpeg: str,
    media_path: Path,
    noise: str,
    duration: float,
) -> tuple[list[dict[str, float]], dict[str, Any] | None]:
    command = [
        ffmpeg,
        "-hide_banner",
        "-nostats",
        "-i",
        str(media_path),
        "-af",
        f"silencedetect=noise={noise}:d={duration}",
        "-f",
        "null",
        "-",
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    intervals = parse_silencedetect(result.stderr)
    if result.returncode != 0:
        return intervals, {
            "command": command,
            "returnCode": result.returncode,
            "stderrTail": result.stderr[-1200:],
        }
    return intervals, None


def parse_silencedetect(stderr: str) -> list[dict[str, float]]:
    intervals: list[dict[str, float]] = []
    current_start: float | None = None
    start_re = re.compile(r"silence_start:\s*([0-9.]+)")
    end_re = re.compile(r"silence_end:\s*([0-9.]+)\s*\|\s*silence_duration:\s*([0-9.]+)")
    for line in stderr.splitlines():
        start_match = start_re.search(line)
        if start_match:
            current_start = float(start_match.group(1))
            continue
        end_match = end_re.search(line)
        if end_match:
            end = float(end_match.group(1))
            detected_duration = float(end_match.group(2))
            start = current_start if current_start is not None else max(0.0, end - detected_duration)
            intervals.append(
                {
                    "startMs": round(start * 1000.0, 3),
                    "endMs": round(end * 1000.0, 3),
                    "durationMs": round(detected_duration * 1000.0, 3),
                }
            )
            current_start = None
    return intervals


def capture_frame(ffmpeg: str, final_video: Path, target_ms: float, output_path: Path) -> dict[str, Any]:
    command = [
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-ss",
        f"{target_ms / 1000.0:.3f}",
        "-i",
        str(final_video),
        "-frames:v",
        "1",
        "-q:v",
        "2",
        str(output_path),
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    return {
        "path": str(output_path),
        "ok": result.returncode == 0 and output_path.exists(),
        "command": command,
        "returnCode": result.returncode,
        "stderrTail": result.stderr[-800:],
    }


def build_report(args: argparse.Namespace) -> tuple[dict[str, Any], int]:
    output_dir = args.output_dir.resolve()
    timeline_path = output_dir / "timeline.json"
    voice_path = output_dir / "voice.wav"
    final_video_path = output_dir / "final.mp4"
    sync_frames_dir = output_dir / "sync_frames"

    report: dict[str, Any] = {
        "outputDir": str(output_dir),
        "visualCheck": "timeline-frame-gate",
        "status": "pending",
        "errors": [],
        "inputs": {
            "timeline": str(timeline_path),
            "voice": str(voice_path),
            "finalVideo": str(final_video_path),
        },
        "silenceDetect": {},
        "checks": [],
    }
    exit_code = 0

    for required_path in (timeline_path, voice_path, final_video_path):
        if not required_path.exists():
            report["errors"].append(f"missing required file: {required_path}")
            exit_code = 1

    if shutil.which(args.ffmpeg) is None and not Path(args.ffmpeg).exists():
        report["errors"].append(f"ffmpeg executable not found: {args.ffmpeg}")
        exit_code = 1

    if exit_code:
        report["status"] = "error"
        return report, exit_code

    try:
        timeline = load_timeline(timeline_path)
        fps = find_fps(timeline)
        scenes = normalize_scenes(find_scenes(timeline), fps)
        report["timeline"] = {"fps": fps, "sceneCount": len(scenes)}
    except Exception as exc:
        report["errors"].append(f"failed to read timeline.json: {exc}")
        report["status"] = "error"
        return report, 1

    for label, media_path in (("voice", voice_path), ("finalVideo", final_video_path)):
        intervals, error = run_silencedetect(
            args.ffmpeg,
            media_path,
            args.silence_noise,
            args.silence_duration,
        )
        report["silenceDetect"][label] = {
            "path": str(media_path),
            "noise": args.silence_noise,
            "durationSeconds": args.silence_duration,
            "intervals": intervals,
        }
        if error:
            report["silenceDetect"][label]["error"] = error
            report["errors"].append(f"ffmpeg silencedetect failed for {label}")
            exit_code = 1

    sync_frames_dir.mkdir(parents=True, exist_ok=True)
    for scene, next_scene in zip(scenes, scenes[1:]):
        check: dict[str, Any] = {
            "sceneIndex": scene.index,
            "sceneId": scene.scene_id,
            "nextSceneId": next_scene.scene_id,
            "silenceEndMs": scene.silence_end_ms,
            "visualCheck": "timeline-frame-gate",
        }
        if scene.silence_end_ms is None:
            check["ok"] = False
            check["errors"] = ["current scene is missing silenceEndMs"]
            report["checks"].append(check)
            exit_code = 1
            continue

        check_ms = scene.silence_end_ms + FRAME_GRACE_MS
        check_frame = math.floor(check_ms / 1000.0 * fps)
        frame_path = sync_frames_dir / (
            f"{scene.index + 1:03d}_{safe_name(scene.scene_id)}_to_"
            f"{safe_name(next_scene.scene_id)}_{int(round(check_ms))}ms.jpg"
        )
        check.update(
            {
                "checkMs": round(check_ms, 3),
                "checkFrame": check_frame,
                "nextFromFrame": next_scene.from_frame,
                "nextVisualStartMs": next_scene.visual_start_ms,
                "screenshot": capture_frame(args.ffmpeg, final_video_path, check_ms, frame_path),
                "errors": [],
            }
        )

        if next_scene.from_frame is None:
            check["errors"].append("next scene is missing fromFrame/startFrame or visualStartMs")
        elif next_scene.from_frame > check_frame:
            check["errors"].append(
                f"next scene fromFrame {next_scene.from_frame} is later than checkFrame {check_frame}"
            )

        if next_scene.visual_start_ms is None:
            check["errors"].append("next scene is missing visualStartMs or equivalent")
        elif next_scene.visual_start_ms > check_ms:
            check["errors"].append(
                f"next scene visualStartMs {next_scene.visual_start_ms:.3f}ms is later than checkMs {check_ms:.3f}ms"
            )

        if not check["screenshot"]["ok"]:
            check["errors"].append("failed to capture final.mp4 sync screenshot")

        check["ok"] = not check["errors"]
        if not check["ok"]:
            exit_code = 1
        report["checks"].append(check)

    report["status"] = "pass" if exit_code == 0 else "fail"
    return report, exit_code


def main() -> int:
    args = parse_args()
    output_dir = args.output_dir.resolve()
    report_path = output_dir / "sync-report.json"
    report, exit_code = build_report(args)
    if output_dir.exists():
        with report_path.open("w", encoding="utf-8") as handle:
            json.dump(report, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
    else:
        print(json.dumps(report, ensure_ascii=False, indent=2), file=sys.stderr)
    print(f"sync report: {report_path}")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
