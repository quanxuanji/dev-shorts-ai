import asyncio
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.models import CreateTaskRequest
from app.services.task_service import TaskService


class FakeLLMService:
    async def generate_voiceover_script_with_logs(self, *args):
        return "这是完整链路测试口播。", ["[LLM] fake script generated."]

    async def generate_scene_plan_with_logs(self, *args):
        return [
            {
                "id": "scene-001",
                "title": "完整链路",
                "caption": "测试口播",
                "narration": "这是完整链路测试口播。",
            }
        ], ["[LLM] fake scene plan generated."]


class FakeTTSService:
    def synthesize_to_file(self, script, voice, output_dir):
        voice_path = output_dir / "voice.wav"
        voice_path.write_bytes(b"RIFFfake-wave")
        return voice_path, ["[TTS] fake voice generated."], {"durationSeconds": 3.2, "fallbackWarnings": []}

    def synthesize_speech_segments_to_file(self, speech_segments, voice, output_dir, pause_seconds=0.5, fps=30):
        voice_path = output_dir / "voice.wav"
        voice_path.write_bytes(b"RIFFfake-wave")
        timeline = [
            {
                "sceneIndex": 0,
                "rank": None,
                "title": speech_segments[0]["title"],
                "speechStartMs": 0,
                "speechEndMs": 3200,
                "silenceStartMs": 3200,
                "silenceEndMs": 3200,
                "visualStartMs": 0,
                "visualEndMs": 3200,
                "fromFrame": 0,
                "durationInFrames": 96,
                "durationSource": "generated_audio_duration",
            }
        ]
        return voice_path, ["[TTS] fake segmented voice generated."], {
            "durationSeconds": 3.2,
            "voiceSegmentCount": len(speech_segments),
            "timeline": timeline,
            "timelineSource": "segmented_tts_audio_duration",
            "fallbackWarnings": [],
        }

    def synthesize_segments_to_files(self, script, voice, output_dir, scene_plan=None):
        audio_path = output_dir / "scene_001.wav"
        audio_path.write_bytes(b"RIFFfake-wave")
        scene = (scene_plan or [{"title": "完整链路", "caption": "测试口播", "narration": script}])[0]
        return [
            {
                "title": scene["title"],
                "caption": scene["caption"],
                "text": scene["narration"],
                "audioPath": str(audio_path),
                "duration": 3.2,
            }
        ], ["[TTS] fake scene voice generated."], {"voiceSegmentCount": 1, "fallbackWarnings": []}


class FakeVideoDownloader:
    def prepare_source(self, output_dir, source_url="", local_file_path=None):
        source_path = output_dir / "source.mp4"
        source_path.write_bytes(b"fake-video")
        return source_path, ["[Input] fake source prepared."]


class FakeAudioExtractor:
    def extract_audio(self, input_video, output_dir):
        audio_path = output_dir / "audio.wav"
        audio_path.write_bytes(b"fake-audio")
        return audio_path, ["[Audio] fake audio extracted."], {"fallbackWarnings": []}


class FakeASRService:
    def transcribe(self, audio_path, output_dir):
        transcript_path = output_dir / "transcript.txt"
        transcript_path.write_text("原视频参考内容", encoding="utf-8")
        return "原视频参考内容", ["[ASR] fake transcript generated."]


class FakeSubtitleService:
    def create_subtitles(self, script, output_dir, duration_seconds=None):
        subtitle_path = output_dir / "subtitles.srt"
        subtitle_path.write_text("1\n00:00:00,000 --> 00:00:03,000\n这是完整链路测试口播。\n", encoding="utf-8")
        return subtitle_path, ["[Subtitle] fake subtitles generated."]


class FakeVideoRenderService:
    def render_final(self, *, input_video, voice_audio, subtitle_path, output_dir):
        final_path = output_dir / "final.mp4"
        final_path.write_bytes(b"fake-final-video")
        return final_path, ["[FFmpeg] fake final video rendered."], {"renderMode": "test", "fallbackWarnings": []}


class FakeRemotionRenderService:
    def render_final(self, *, output_dir, scenes, audio_path=None, timeline=None):
        return output_dir / "final.mp4", ["[Remotion] skipped in legacy chain test."], {
            "renderMode": "remotion_failed",
            "fallbackWarnings": ["Remotion skipped in legacy chain test."],
        }


class TaskServiceVideoChainTest(unittest.TestCase):
    def test_voice_task_completes_with_final_video_artifact(self):
        with tempfile.TemporaryDirectory() as artifacts_dir:
            service = TaskService()
            service.llm_service = FakeLLMService()
            service.tts_service = FakeTTSService()
            service.video_downloader = FakeVideoDownloader()
            service.audio_extractor = FakeAudioExtractor()
            service.asr_service = FakeASRService()
            service.subtitle_service = FakeSubtitleService()
            service.remotion_render_service = FakeRemotionRenderService()
            service.video_render_service = FakeVideoRenderService()

            with patch("app.services.task_service.settings.artifacts_dir", artifacts_dir):
                task = service.create_task(
                    CreateTaskRequest(
                        topic="完整链路测试",
                        local_file_path="/tmp/source.mp4",
                    )
                )

                for _ in range(50):
                    fresh = service.get_task(task.id)
                    if fresh and fresh.status in {"success", "error"}:
                        break
                    asyncio.run(asyncio.sleep(0.02))

            fresh = service.get_task(task.id)
            assert fresh is not None
            self.assertEqual("success", fresh.status)
            self.assertIn("finalVideoPath", fresh.artifacts)
            self.assertIn("finalVideoUrl", fresh.artifacts)
            self.assertTrue(Path(fresh.artifacts["finalVideoPath"]).exists())


if __name__ == "__main__":
    unittest.main()
