import tempfile
import unittest
import wave
from pathlib import Path
from unittest.mock import patch

from app.models import RuntimeSettings
from app.services.tts_service import TTSService


class TTSServiceSegmentsTest(unittest.TestCase):
    def test_segmented_tts_builds_voice_and_timeline_from_real_audio_durations(self):
        service = TTSService()

        def fake_synthesize(script, voice, output_dir, output_stem):
            duration_seconds = 1.0 if output_stem == "scene-0" else 2.0
            path = output_dir / f"{output_stem}.wav"
            with wave.open(str(path), "wb") as wav:
                wav.setnchannels(1)
                wav.setsampwidth(2)
                wav.setframerate(16000)
                wav.writeframes(b"\x01\x00" * int(16000 * duration_seconds))
            return path, [f"[TTS] fake {output_stem}"], {"durationSeconds": duration_seconds, "fallbackWarnings": []}

        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir)
            with (
                patch("app.services.tts_service.settings_service.get", return_value=RuntimeSettings(tts_provider="mock")),
                patch.object(service, "_synthesize_to_file", side_effect=fake_synthesize),
            ):
                voice_path, _logs, metadata = service.synthesize_speech_segments_to_file(
                    [
                        {"sceneIndex": 0, "rank": 1, "title": "TOP1 A", "speechText": "第一，A。"},
                        {"sceneIndex": 1, "rank": 2, "title": "TOP2 B", "speechText": "第二，B。"},
                    ],
                    voice="studio-default",
                    output_dir=output_dir,
                    pause_seconds=0.5,
                    fps=30,
                )

            timeline = metadata["timeline"]
            voice_exists = voice_path.exists()

        self.assertTrue(voice_exists)
        self.assertEqual("segmented_tts_audio_duration", metadata["timelineSource"])
        self.assertEqual("generated_audio_duration", timeline[0]["durationSource"])
        self.assertEqual(0, timeline[0]["speechStartMs"])
        self.assertEqual(1000, timeline[0]["speechEndMs"])
        self.assertEqual(1500, timeline[1]["speechStartMs"])
        self.assertEqual(1200, timeline[1]["visualStartMs"])
        self.assertEqual(36, timeline[1]["fromFrame"])

    def test_chinese_sentences_are_split_into_voice_segments(self):
        script = "第一幕说明为什么要自动生成口播。第二幕说明 FishSpeech 生成分段音频。第三幕说明 Remotion 按音频时长渲染最终视频。"

        with tempfile.TemporaryDirectory() as temp_dir:
            with patch(
                "app.services.tts_service.settings_service.get",
                return_value=RuntimeSettings(tts_provider="mock"),
            ):
                segments, _logs, metadata = TTSService().synthesize_segments_to_files(
                    script,
                    voice="studio-default",
                    output_dir=Path(temp_dir),
                )
                first_audio_exists = Path(segments[0]["audioPath"]).exists()

        self.assertEqual(3, metadata["voiceSegmentCount"])
        self.assertEqual(3, len(segments))
        self.assertEqual("第一幕说明为什么要自动生成口播。", segments[0]["text"])
        self.assertTrue(first_audio_exists)

    def test_fallback_silence_duration_uses_chinese_character_count(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            with patch(
                "app.services.tts_service.settings_service.get",
                return_value=RuntimeSettings(tts_provider="mock"),
            ):
                short_path, _short_logs, short_metadata = TTSService().synthesize_to_file(
                    "短句。",
                    voice="studio-default",
                    output_dir=Path(temp_dir),
                )
                long_path, _long_logs, long_metadata = TTSService().synthesize_to_file(
                    "这是一个明显更长的中文段落，用来确认 fallback 静音时长不会只因为没有空格就固定成八秒。",
                    voice="studio-default",
                    output_dir=Path(temp_dir),
                )
                short_exists = short_path.exists()
                long_exists = long_path.exists()

        self.assertTrue(short_exists)
        self.assertTrue(long_exists)
        self.assertLess(short_metadata["durationSeconds"], 8)
        self.assertGreater(long_metadata["durationSeconds"], short_metadata["durationSeconds"])

    def test_segmented_fishspeech_requires_fixed_voice_configuration(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            with patch(
                "app.services.tts_service.settings_service.get",
                return_value=RuntimeSettings(tts_provider="fishspeech", fishspeech_voice="default"),
            ):
                with self.assertRaisesRegex(RuntimeError, "stable FishSpeech voice"):
                    TTSService().synthesize_speech_segments_to_file(
                        [{"sceneIndex": 0, "rank": 1, "title": "TOP1 A", "speechText": "第一，A。"}],
                        voice="studio-default",
                        output_dir=Path(temp_dir),
                    )

    def test_fishspeech_payload_uses_reference_id_as_fixed_voice(self):
        payload = TTSService()._build_fishspeech_payload(
            script="第一，Claude Code。",
            voice="weekly-host",
            runtime_settings=RuntimeSettings(
                tts_provider="fishspeech",
                fishspeech_voice="weekly-host",
            ),
        )

        self.assertEqual("weekly-host", payload["reference_id"])
        self.assertEqual([], payload["references"])
        self.assertEqual("on", payload["use_memory_cache"])

    def test_fishspeech_payload_uses_reference_audio_and_text_for_fixed_voice(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            reference_audio = Path(temp_dir) / "host.wav"
            reference_audio.write_bytes(b"fake-reference-audio")
            payload = TTSService()._build_fishspeech_payload(
                script="第二，FastMCP。",
                voice="default",
                runtime_settings=RuntimeSettings(
                    tts_provider="fishspeech",
                    fishspeech_voice="default",
                    fishspeech_reference_audio_path=str(reference_audio),
                    fishspeech_reference_text="这是一段固定主播音色的参考口播。",
                ),
            )

        self.assertIsNone(payload["reference_id"])
        self.assertEqual("on", payload["use_memory_cache"])
        self.assertEqual(1, len(payload["references"]))
        self.assertEqual(b"fake-reference-audio", payload["references"][0]["audio"])
        self.assertEqual("这是一段固定主播音色的参考口播。", payload["references"][0]["text"])


if __name__ == "__main__":
    unittest.main()
