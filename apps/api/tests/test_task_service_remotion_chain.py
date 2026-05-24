import asyncio
import tempfile
import unittest
import wave
from pathlib import Path
from unittest.mock import patch

from app.models import CreateTaskRequest
from app.services.task_service import TaskService


class FakeLLMService:
    async def generate_voiceover_script_with_logs(self, *args):
        return "第一幕讲问题。第二幕讲方案。第三幕讲结果。", ["[LLM] fake script generated."]

    async def generate_scene_plan_with_logs(self, *args):
        return [
            {"title": "问题", "caption": "先讲清痛点", "narration": "第一幕讲问题。"},
            {"title": "方案", "caption": "再讲解决方案", "narration": "第二幕讲方案。"},
            {"title": "结果", "caption": "最后讲结果", "narration": "第三幕讲结果。"},
        ], ["[LLM] fake scene plan generated."]


class FakeTTSService:
    def synthesize_to_file(self, script, voice, output_dir):
        voice_path = output_dir / "voice.wav"
        with wave.open(str(voice_path), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(16000)
            wav.writeframes(b"\x01\x00" * 16000 * 9)
        return voice_path, ["[TTS] fake voice generated."], {"durationSeconds": 9.0, "fallbackWarnings": []}

    def synthesize_speech_segments_to_file(self, speech_segments, voice, output_dir, pause_seconds=0.5, fps=30):
        voice_path = output_dir / "voice.wav"
        with wave.open(str(voice_path), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(16000)
            wav.writeframes(b"\x01\x00" * 16000 * 10)
        timeline = []
        current_ms = 0
        for index, segment in enumerate(speech_segments):
            speech_start = current_ms
            speech_end = speech_start + 3000
            silence_end = speech_end + (500 if index < len(speech_segments) - 1 else 0)
            timeline.append(
                {
                    "sceneIndex": segment["sceneIndex"],
                    "rank": segment.get("rank"),
                    "title": segment["title"],
                    "speechStartMs": speech_start,
                    "speechEndMs": speech_end,
                    "silenceStartMs": speech_end,
                    "silenceEndMs": silence_end,
                    "visualStartMs": max(0, speech_start - 300),
                    "visualEndMs": 0,
                    "fromFrame": 0,
                    "durationInFrames": 0,
                    "durationSource": "generated_audio_duration",
                }
            )
            current_ms = silence_end
        from_frames = [round(item["visualStartMs"] / 1000 * fps) for item in timeline]
        total_frames = round(current_ms / 1000 * fps)
        for index, item in enumerate(timeline):
            next_from = from_frames[index + 1] if index + 1 < len(from_frames) else total_frames
            item["fromFrame"] = from_frames[index]
            item["durationInFrames"] = next_from - from_frames[index]
            item["visualEndMs"] = timeline[index + 1]["visualStartMs"] if index + 1 < len(timeline) else current_ms
        (output_dir / "timeline.json").write_text("{}", encoding="utf-8")
        return voice_path, ["[TTS] fake segmented voice generated."], {
            "durationSeconds": 10.0,
            "voiceSegmentCount": len(speech_segments),
            "visualSceneCount": len(speech_segments),
            "pageSwitchPauseSeconds": pause_seconds,
            "timeline": timeline,
            "timelinePath": str(output_dir / "timeline.json"),
            "timelineSource": "segmented_tts_audio_duration",
            "fallbackWarnings": [],
        }

    def synthesize_segments_to_files(self, script, voice, output_dir, scene_plan=None):
        segments = []
        logs = []
        planned = scene_plan or [
            {"title": "Scene 1", "caption": "第一幕讲问题。", "narration": "第一幕讲问题。"},
            {"title": "Scene 2", "caption": "第二幕讲方案。", "narration": "第二幕讲方案。"},
            {"title": "Scene 3", "caption": "第三幕讲结果。", "narration": "第三幕讲结果。"},
        ]
        for index, scene in enumerate(planned, start=1):
            audio_path = output_dir / f"scene_{index:03d}.wav"
            audio_path.write_bytes(b"RIFFfake-wave")
            segments.append(
                {
                    "title": scene["title"],
                    "caption": scene["caption"],
                    "text": scene["narration"],
                    "audioPath": str(audio_path),
                    "duration": float(index + 2),
                }
            )
            logs.append(f"[TTS] fake segment {index} generated.")
        return segments, logs, {"voiceSegmentCount": 3, "fallbackWarnings": []}


class FakeSubtitleService:
    def create_subtitles(self, script, output_dir, duration_seconds=None):
        subtitle_path = output_dir / "subtitles.srt"
        subtitle_path.write_text("1\n00:00:00,000 --> 00:00:09,000\n测试\n", encoding="utf-8")
        return subtitle_path, ["[Subtitle] fake subtitles generated."]


class FakeRemotionRenderService:
    def __init__(self):
        self.audio_path = None
        self.scenes = []
        self.timeline = None

    def render_final(self, *, output_dir, scenes, audio_path=None, timeline=None):
        self.audio_path = audio_path
        self.scenes = scenes
        self.timeline = timeline
        final_path = output_dir / "final.mp4"
        final_path.write_bytes(b"fake-remotion-video")
        return final_path, ["[Remotion] fake final video rendered."], {"renderMode": "remotion", "fallbackWarnings": []}


class FakeFailedRemotionRenderService:
    def render_final(self, *, output_dir, scenes, audio_path=None, timeline=None):
        return output_dir / "final.mp4", ["[Remotion] failed."], {
            "renderMode": "remotion_failed",
            "fallbackWarnings": ["Remotion failed."],
        }


class FakeVideoRenderService:
    def render_final(self, *, input_video, voice_audio, subtitle_path, output_dir):
        final_path = output_dir / "final.mp4"
        final_path.write_bytes(b"fake-ffmpeg-video")
        return final_path, ["[FFmpeg] fake fallback rendered."], {"renderMode": "subtitled", "fallbackWarnings": []}


class FakeEmptyVideoRenderService:
    def render_final(self, *, input_video, voice_audio, subtitle_path, output_dir):
        final_path = output_dir / "final.mp4"
        final_path.write_bytes(b"")
        return final_path, ["[FFmpeg] fake placeholder rendered."], {
            "renderMode": "placeholder",
            "fallbackWarnings": ["ffmpeg unavailable."],
        }


class TaskServiceRemotionChainTest(unittest.TestCase):
    def test_voice_task_prefers_remotion_with_segment_audio(self):
        with tempfile.TemporaryDirectory() as artifacts_dir:
            service = self._service(FakeRemotionRenderService())

            with patch("app.services.task_service.settings.artifacts_dir", artifacts_dir):
                task = service.create_task(CreateTaskRequest(topic="Remotion 集成测试"))
                fresh = self._wait_for_task(service, task.id)

            self.assertEqual("success", fresh.status)
            self.assertEqual("remotion", fresh.artifacts["renderMode"])
            self.assertEqual(3, fresh.artifacts["voiceSegmentCount"])
            self.assertIn("scenePlanPath", fresh.artifacts)
            self.assertEqual("问题", fresh.artifacts["scenePlan"][0]["title"])
            self.assertIn("renderManifestPath", fresh.artifacts)
            self.assertTrue(Path(fresh.artifacts["finalVideoPath"]).exists())
            self.assertIsNotNone(service.remotion_render_service.audio_path)
            self.assertEqual("voice.wav", service.remotion_render_service.audio_path.name)
            self.assertTrue(all(not scene.get("audioPath") for scene in service.remotion_render_service.scenes))
            self.assertIsNotNone(service.remotion_render_service.timeline)
            assert service.remotion_render_service.timeline is not None
            self.assertEqual(0, service.remotion_render_service.timeline[0]["fromFrame"])
            self.assertAlmostEqual(10.0, sum(scene["duration"] for scene in service.remotion_render_service.scenes), places=3)

    def test_voice_task_falls_back_to_ffmpeg_when_remotion_fails(self):
        with tempfile.TemporaryDirectory() as artifacts_dir:
            service = self._service(FakeFailedRemotionRenderService())

            with patch("app.services.task_service.settings.artifacts_dir", artifacts_dir):
                task = service.create_task(CreateTaskRequest(topic="Remotion fallback 测试"))
                fresh = self._wait_for_task(service, task.id)

            self.assertEqual("success", fresh.status)
            self.assertEqual("subtitled", fresh.artifacts["renderMode"])
            self.assertTrue(any("Remotion failed" in warning for warning in fresh.artifacts["fallbackWarnings"]))
            self.assertTrue(Path(fresh.artifacts["finalVideoPath"]).exists())

    def test_voice_task_errors_when_remotion_and_ffmpeg_do_not_create_usable_video(self):
        with tempfile.TemporaryDirectory() as artifacts_dir:
            service = self._service(FakeFailedRemotionRenderService())
            service.video_render_service = FakeEmptyVideoRenderService()

            with patch("app.services.task_service.settings.artifacts_dir", artifacts_dir):
                task = service.create_task(CreateTaskRequest(topic="双渲染失败测试"))
                fresh = self._wait_for_task(service, task.id)

            self.assertEqual("error", fresh.status)
            self.assertTrue(any("usable final video" in log.message for log in fresh.logs))

    def test_scene_durations_reserve_half_second_after_each_page_voiceover(self):
        service = TaskService()
        scenes = [
            {"narration": "第一段口播。"},
            {"narration": "第二段口播。"},
            {"narration": "第三段口播。"},
        ]

        durations = service._scene_durations_for_voice(scenes, Path("missing.wav"), 9.0)

        self.assertEqual([3.167, 3.167, 2.666], durations)
        self.assertAlmostEqual(9.0, sum(durations), places=3)

    def test_tts_script_keeps_single_request_but_separates_page_voiceovers(self):
        service = TaskService()
        scenes = [
            {"narration": "第一段口播。"},
            {"narration": "第二段口播。"},
        ]

        script = service._voice_script_for_tts("ignored", scenes)

        self.assertEqual("第一段口播。\n\n第二段口播。", script)

    def test_ranked_speech_segments_keep_ordinals_with_current_scene(self):
        service = TaskService()
        scenes = [
            {"title": "TOP1 OpenHands", "rank": 1, "name": "OpenHands", "narration": "第一，OpenHands，开源 AI 工程师。"},
            {"title": "TOP2 FastMCP", "rank": 2, "name": "FastMCP", "narration": "第二，FastMCP，快速构建 MCP 服务器。"},
            {"title": "TOP3 Ollama", "rank": 3, "name": "Ollama", "narration": "第三，Ollama，本地运行大模型。"},
        ]

        segments = service._build_speech_segments(scenes)

        self.assertEqual("第一，OpenHands，开源 AI 工程师。", segments[0]["speechText"])
        self.assertEqual("第二，FastMCP，快速构建 MCP 服务器。", segments[1]["speechText"])
        self.assertEqual("第三，Ollama，本地运行大模型。", segments[2]["speechText"])

    def test_ranked_speech_segments_reject_misplaced_next_ordinal(self):
        service = TaskService()
        scenes = [
            {"title": "TOP1 OpenHands", "rank": 1, "name": "OpenHands", "narration": "第一，OpenHands。第二"},
            {"title": "TOP2 FastMCP", "rank": 2, "name": "FastMCP", "narration": "快速构建 MCP 服务器。"},
        ]

        with self.assertRaisesRegex(ValueError, "speechText must start with 第二"):
            service._build_speech_segments(scenes)

    def test_ranked_speech_segments_reject_previous_scene_ending_with_next_ordinal(self):
        service = TaskService()
        scenes = [
            {"title": "TOP1 OpenHands", "rank": 1, "name": "OpenHands", "narration": "第一，OpenHands。第二"},
            {"title": "TOP2 FastMCP", "rank": 2, "name": "FastMCP", "narration": "第二，FastMCP，快速构建 MCP 服务器。"},
        ]

        with self.assertRaisesRegex(ValueError, "must not end with 第二"):
            service._build_speech_segments(scenes)

    def test_enforce_page_switch_pauses_inserts_silence_into_single_voice_file(self):
        service = TaskService()
        scenes = [
            {"narration": "第一段口播。"},
            {"narration": "第二段口播。"},
        ]

        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir)
            voice_path = output_dir / "voice.wav"
            with wave.open(str(voice_path), "wb") as wav:
                wav.setnchannels(1)
                wav.setsampwidth(2)
                wav.setframerate(16000)
                wav.writeframes(b"\xff\x3f" * 16000 * 2)

            with patch.object(service, "_speech_durations_for_voice", return_value=[1.0, 1.0]):
                paused_path, logs, metadata = service._enforce_page_switch_pauses(
                    voice_path,
                    scenes,
                    2.0,
                    output_dir,
                )

        self.assertEqual(voice_path, paused_path)
        self.assertAlmostEqual(2.5, metadata["durationSeconds"], places=2)
        self.assertEqual(str((output_dir / "timeline.json").resolve()), metadata["timelinePath"])
        self.assertEqual(2, len(metadata["timeline"]))
        self.assertEqual(0, metadata["timeline"][0]["fromFrame"])
        self.assertEqual(36, metadata["timeline"][1]["fromFrame"])
        self.assertEqual(1000, metadata["timeline"][0]["silenceStartMs"])
        self.assertEqual(1500, metadata["timeline"][0]["silenceEndMs"])
        self.assertEqual(1200, metadata["timeline"][1]["visualStartMs"])
        self.assertLess(metadata["timeline"][1]["visualStartMs"], metadata["timeline"][1]["speechStartMs"])
        self.assertTrue(any("0.5s" in log for log in logs))

    def test_page_timeline_flips_next_visual_before_next_speech(self):
        service = TaskService()
        scenes = [
            {"title": "开场", "narration": "第一段。"},
            {"title": "第二页", "narration": "第二段。"},
            {"title": "第三页", "narration": "第三段。"},
        ]

        timeline = service._build_page_timeline(
            scenes,
            speech_durations=[2.0, 3.0, 1.0],
            pause_seconds=0.5,
            total_duration_seconds=7.0,
            fps=30,
        )

        self.assertEqual(0, timeline[0]["visualStartMs"])
        self.assertEqual(2200, timeline[1]["visualStartMs"])
        self.assertEqual(5700, timeline[2]["visualStartMs"])
        self.assertGreaterEqual(timeline[1]["visualStartMs"], timeline[0]["silenceStartMs"])
        self.assertLessEqual(timeline[1]["visualStartMs"], timeline[0]["silenceEndMs"])
        self.assertLess(timeline[1]["visualStartMs"], timeline[1]["speechStartMs"])
        self.assertEqual(66, timeline[1]["fromFrame"])
        self.assertEqual(105, timeline[1]["durationInFrames"])
        self.assertEqual(210, sum(item["durationInFrames"] for item in timeline))

    def _service(self, remotion_render_service):
        service = TaskService()
        service.llm_service = FakeLLMService()
        service.tts_service = FakeTTSService()
        service.subtitle_service = FakeSubtitleService()
        service.remotion_render_service = remotion_render_service
        service.video_render_service = FakeVideoRenderService()
        return service

    def _wait_for_task(self, service, task_id):
        for _ in range(50):
            fresh = service.get_task(task_id)
            if fresh and fresh.status in {"success", "error"}:
                return fresh
            asyncio.run(asyncio.sleep(0.02))
        self.fail("task did not finish")


if __name__ == "__main__":
    unittest.main()
