import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.services.remotion_render_service import RemotionRenderService


class RemotionRenderServiceTest(unittest.TestCase):
    def test_writes_manifest_and_invokes_remotion_renderer(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir)
            audio_path = output_dir / "scene_001.wav"
            audio_path.write_bytes(b"RIFFfake-wave")

            service = RemotionRenderService(project_root=Path("/repo"))

            def fake_run(command, capture_output, text, timeout, cwd):
                final_path = output_dir / "final.mp4"
                final_path.write_bytes(b"fake-remotion-video")

                class Result:
                    returncode = 0
                    stdout = "rendered"
                    stderr = ""

                return Result()

            with patch("app.services.remotion_render_service.subprocess.run", side_effect=fake_run) as run:
                final_path, logs, metadata = service.render_final(
                    output_dir=output_dir,
                    scenes=[
                        {
                            "title": "第一幕",
                            "caption": "同步口播内容",
                            "audioPath": str(audio_path),
                            "duration": 3.4,
                        }
                    ],
                )

            manifest = json.loads((output_dir / "render_manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(final_path, (output_dir / "final.mp4").resolve())
            self.assertEqual("remotion", metadata["renderMode"])
            self.assertEqual("creator-short", manifest["manifest"]["template"])
            self.assertEqual(1, len(manifest["manifest"]["scenes"]))
            self.assertEqual("scene_001.wav", manifest["manifest"]["scenes"][0]["audioPath"])
            self.assertTrue(any("[Remotion] rendered final video" in log for log in logs))
            command = run.call_args_list[0].args[0]
            self.assertTrue(any(str((output_dir / "render_manifest.json").resolve()) in part for part in command))
            self.assertTrue(any("--public-dir=" in part for part in command))

    def test_writes_single_global_voice_audio_when_provided(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir)
            voice_path = output_dir / "voice.wav"
            voice_path.write_bytes(b"RIFFsingle-voice")

            service = RemotionRenderService(project_root=Path("/repo"))

            def fake_run(command, capture_output, text, timeout, cwd):
                (output_dir / "final.mp4").write_bytes(b"fake-remotion-video")

                class Result:
                    returncode = 0
                    stdout = "rendered"
                    stderr = ""

                return Result()

            with patch("app.services.remotion_render_service.subprocess.run", side_effect=fake_run):
                service.render_final(
                    output_dir=output_dir,
                    audio_path=voice_path,
                    scenes=[
                        {
                            "title": "第一幕",
                            "caption": "画面一",
                            "audioPath": str(output_dir / "voice_segments" / "scene_001.wav"),
                            "duration": 3.4,
                        },
                        {
                            "title": "第二幕",
                            "caption": "画面二",
                            "audioPath": str(output_dir / "voice_segments" / "scene_002.wav"),
                            "duration": 3.4,
                        },
                    ],
                )

            manifest = json.loads((output_dir / "render_manifest.json").read_text(encoding="utf-8"))
            self.assertEqual("voice.wav", manifest["manifest"]["audioPath"])

    def test_writes_timeline_json_and_manifest_timeline(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir)
            voice_path = output_dir / "voice.wav"
            voice_path.write_bytes(b"RIFFsingle-voice")
            timeline = [
                {
                    "sceneIndex": 0,
                    "title": "第一页",
                    "speechStartMs": 0,
                    "speechEndMs": 1000,
                    "silenceStartMs": 1000,
                    "silenceEndMs": 1500,
                    "visualStartMs": 0,
                    "visualEndMs": 1000,
                    "fromFrame": 0,
                    "durationInFrames": 30,
                    "durationSource": "generated_audio_duration",
                },
                {
                    "sceneIndex": 1,
                    "title": "第二页",
                    "speechStartMs": 1500,
                    "speechEndMs": 2500,
                    "silenceStartMs": 2500,
                    "silenceEndMs": 2500,
                    "visualStartMs": 1000,
                    "visualEndMs": 2500,
                    "fromFrame": 30,
                    "durationInFrames": 45,
                    "durationSource": "generated_audio_duration",
                },
            ]

            service = RemotionRenderService(project_root=Path("/repo"))

            def fake_run(command, capture_output, text, timeout, cwd):
                (output_dir / "final.mp4").write_bytes(b"fake-remotion-video")

                class Result:
                    returncode = 0
                    stdout = "rendered"
                    stderr = ""

                return Result()

            with patch("app.services.remotion_render_service.subprocess.run", side_effect=fake_run):
                _final_path, logs, metadata = service.render_final(
                    output_dir=output_dir,
                    audio_path=voice_path,
                    scenes=[
                        {"title": "第一页", "caption": "一", "duration": 1.0},
                        {"title": "第二页", "caption": "二", "duration": 1.5},
                    ],
                    timeline=timeline,
                )

            manifest = json.loads((output_dir / "render_manifest.json").read_text(encoding="utf-8"))
            timeline_payload = json.loads((output_dir / "timeline.json").read_text(encoding="utf-8"))
            self.assertEqual(timeline, manifest["manifest"]["timeline"])
            self.assertEqual(timeline, timeline_payload["items"])
            self.assertEqual(75, manifest["manifest"]["totalFrames"])
            self.assertEqual(str((output_dir / "timeline.json").resolve()), metadata["timelinePath"])
            self.assertTrue(any("sceneIndex=1" in log and "fromFrame=30" in log for log in logs))

    def test_returns_failure_metadata_without_placeholder(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir)
            service = RemotionRenderService(project_root=Path("/repo"))

            class Result:
                returncode = 1
                stdout = ""
                stderr = "composition failed"

            with patch("app.services.remotion_render_service.subprocess.run", return_value=Result()):
                final_path, logs, metadata = service.render_final(
                    output_dir=output_dir,
                    scenes=[
                        {
                            "title": "失败幕",
                            "caption": "这会触发 fallback",
                            "audioPath": str(output_dir / "missing.wav"),
                            "duration": 2.0,
                        }
                    ],
                )

            self.assertEqual(final_path, (output_dir / "final.mp4").resolve())
            self.assertFalse(final_path.exists())
            self.assertEqual("remotion_failed", metadata["renderMode"])
            self.assertTrue(metadata["fallbackWarnings"])
            self.assertTrue(any("failed" in log.lower() for log in logs))

    def test_accepts_rendered_file_even_when_cli_returns_nonzero(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir)
            service = RemotionRenderService(project_root=Path("/repo"))

            def fake_run(command, capture_output, text, timeout, cwd):
                (output_dir / "final.mp4").write_bytes(b"rendered-despite-nonzero")

                class Result:
                    returncode = 1
                    stdout = "Encoded 100/100"
                    stderr = "non-fatal cleanup warning"

                return Result()

            with patch("app.services.remotion_render_service.subprocess.run", side_effect=fake_run):
                final_path, logs, metadata = service.render_final(
                    output_dir=output_dir,
                    scenes=[
                        {
                            "title": "非零返回码",
                            "caption": "但文件已生成",
                            "audioPath": "",
                            "duration": 2.0,
                        }
                    ],
                )

            self.assertTrue(final_path.exists())
            self.assertEqual("remotion", metadata["renderMode"])
            self.assertTrue(any("rendered final video" in log for log in logs))

    def test_relative_audio_path_is_rewritten_relative_to_public_dir(self):
        service = RemotionRenderService(project_root=Path("/repo"))
        manifest = service._build_manifest(
            [
                {
                    "title": "相对路径",
                    "caption": "音频在任务目录里",
                    "audioPath": "artifacts/outputs/task-1/voice_segments/scene_001.wav",
                    "duration": 2,
                }
            ],
            Path("artifacts/outputs/task-1"),
        )

        self.assertEqual(
            "voice_segments/scene_001.wav",
            manifest["manifest"]["scenes"][0]["audioPath"],
        )

    def test_preserves_ranked_project_metadata_in_manifest(self):
        service = RemotionRenderService(project_root=Path("/repo"))
        manifest = service._build_manifest(
            [
                {
                    "title": "TOP1 OpenHands",
                    "caption": "开源 AI 工程师",
                    "text": "第一，OpenHands。",
                    "rank": 1,
                    "name": "OpenHands",
                    "description": "开源 AI 软件工程师 Agent",
                    "growth": "+8.4k stars this week",
                    "whyHot": "能自动读代码、改代码、执行命令。",
                    "tags": ["AI Agent", "Coding"],
                    "duration": 3.5,
                }
            ],
            Path("artifacts/outputs/task-1"),
        )

        scene = manifest["manifest"]["scenes"][0]
        self.assertEqual("github-weekly-top8", manifest["manifest"]["template"])
        self.assertEqual(1, scene["rank"])
        self.assertEqual("OpenHands", scene["title"])
        self.assertEqual("+8.4k stars this week", scene["growth"])
        self.assertEqual(["AI Agent", "Coding"], scene["tags"])

    def test_ranked_project_scene_without_rank_fails_manifest_build(self):
        service = RemotionRenderService(project_root=Path("/repo"))

        with self.assertRaisesRegex(ValueError, "ranked project scene is missing rank"):
            service._build_manifest(
                [
                    {
                        "title": "TOP6 Ollama",
                        "caption": "本地运行大模型",
                        "text": "第六，Ollama。",
                        "name": "Ollama",
                        "description": "本地运行大模型",
                        "duration": 3.5,
                    }
                ],
                Path("artifacts/outputs/task-1"),
            )


if __name__ == "__main__":
    unittest.main()
