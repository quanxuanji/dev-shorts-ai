import asyncio
import importlib.util
import json
import re
import shutil
import subprocess
import urllib.error
import urllib.request
import wave
from pathlib import Path
from typing import Any

from app.providers.mock_provider import MockProvider
from app.services.settings_service import settings_service

try:
    import msgpack
except ImportError:  # pragma: no cover - optional until FishSpeech is enabled
    msgpack = None


class TTSService:
    def __init__(self) -> None:
        self.provider = MockProvider()

    async def synthesize(self, script: str, voice: str) -> dict[str, str]:
        audio_url = await self.provider.synthesize(script, voice)
        return {
            "audio_url": audio_url,
            "duration": "00:00:38",
            "voice": voice,
        }

    def synthesize_to_file(self, script: str, voice: str, output_dir: Path) -> tuple[Path, list[str], dict[str, Any]]:
        return self._synthesize_to_file(script, voice, output_dir, output_stem="voice")

    def synthesize_speech_segments_to_file(
        self,
        speech_segments: list[dict[str, Any]],
        voice: str,
        output_dir: Path,
        *,
        pause_seconds: float = 0.5,
        fps: int = 30,
    ) -> tuple[Path, list[str], dict[str, Any]]:
        audio_dir = output_dir / "audio"
        audio_dir.mkdir(parents=True, exist_ok=True)
        logs: list[str] = []
        fallback_warnings: list[str] = []
        concat_inputs: list[Path] = []
        rendered_segments: list[dict[str, Any]] = []
        timeline: list[dict[str, Any]] = []
        current_ms = 0.0
        runtime_settings = settings_service.get()
        provider = runtime_settings.tts_provider.lower()
        if provider == "fishspeech" and not self._has_stable_fishspeech_voice(runtime_settings, voice):
            raise RuntimeError(
                "A stable FishSpeech voice is required for segmented TTS. "
                "Set FishSpeech Voice to a reference_id, or configure reference audio and exact reference text."
            )

        planned = [
            segment
            for segment in speech_segments
            if str(segment.get("speechText") or "").strip()
        ]
        for index, segment in enumerate(planned):
            scene_index = int(segment.get("sceneIndex") if isinstance(segment.get("sceneIndex"), int) else index)
            speech_text = str(segment.get("speechText") or "").strip()
            segment_path, segment_logs, segment_metadata = self._synthesize_to_file(
                speech_text,
                voice,
                audio_dir,
                output_stem=f"scene-{scene_index}",
            )
            logs.extend(log.replace("[TTS]", f"[TTS:scene-{scene_index}]") for log in segment_logs)
            fallback_warnings.extend(segment_metadata.get("fallbackWarnings", []))
            duration_seconds = self._audio_duration_seconds(segment_path)
            if duration_seconds <= 0:
                raise RuntimeError(f"Unable to read generated TTS duration for scene-{scene_index}: {segment_path}")
            duration_ms = duration_seconds * 1000.0
            speech_start_ms = current_ms
            speech_end_ms = speech_start_ms + duration_ms
            silence_start_ms = speech_end_ms
            silence_end_ms = speech_end_ms + (pause_seconds * 1000.0 if index < len(planned) - 1 else 0.0)
            visual_start_ms = max(0.0, speech_start_ms - 300.0)

            rendered_segment = {
                "sceneIndex": scene_index,
                "rank": segment.get("rank"),
                "title": str(segment.get("title") or f"Scene {scene_index}"),
                "speechText": speech_text,
                "audioPath": str(segment_path),
                "durationMs": int(round(duration_ms)),
                "durationSource": "generated_audio_duration",
            }
            if segment.get("name"):
                rendered_segment["name"] = str(segment.get("name"))
            rendered_segments.append(rendered_segment)
            timeline.append(
                {
                    "sceneIndex": scene_index,
                    "rank": segment.get("rank"),
                    "title": str(segment.get("title") or f"Scene {scene_index}"),
                    "speechStartMs": int(round(speech_start_ms)),
                    "speechEndMs": int(round(speech_end_ms)),
                    "silenceStartMs": int(round(silence_start_ms)),
                    "silenceEndMs": int(round(silence_end_ms)),
                    "visualStartMs": int(round(visual_start_ms)),
                    "visualEndMs": 0,
                    "fromFrame": 0,
                    "durationInFrames": 0,
                    "durationSource": "generated_audio_duration",
                }
            )
            concat_inputs.append(segment_path)
            if index < len(planned) - 1 and pause_seconds > 0:
                pause_path = audio_dir / f"silence-{scene_index}.wav"
                self._write_silence_like(segment_path, pause_path, pause_seconds)
                concat_inputs.append(pause_path)
            current_ms = silence_end_ms

        if not concat_inputs:
            raise RuntimeError("No speech segments were available for TTS generation.")

        total_frames = max(1, int(round(current_ms / 1000.0 * fps)))
        from_frames = [int(round(item["visualStartMs"] / 1000.0 * fps)) for item in timeline]
        for index, item in enumerate(timeline):
            next_from = from_frames[index + 1] if index + 1 < len(from_frames) else total_frames
            item["fromFrame"] = from_frames[index]
            item["durationInFrames"] = max(1, next_from - from_frames[index])
            item["visualEndMs"] = timeline[index + 1]["visualStartMs"] if index + 1 < len(timeline) else int(round(current_ms))

        output_path = output_dir / "voice.wav"
        self._concat_wavs(concat_inputs, output_path)
        duration_seconds = self._audio_duration_seconds(output_path)
        timeline_path = output_dir / "timeline.json"
        timeline_path.write_text(
            json.dumps(
                {
                    "fps": fps,
                    "totalFrames": total_frames,
                    "totalDurationMs": int(round(duration_seconds * 1000.0)),
                    "source": "segmented_tts_audio_duration",
                    "items": timeline,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        logs.append(f"[TTS] generated {len(rendered_segments)} scene audio files under {audio_dir}")
        logs.append(f"[TTS] stitched segmented TTS voice timeline at {output_path}")
        logs.append(f"[Timeline] wrote {timeline_path} from generated segment durations")
        return output_path, logs, {
            "ttsProvider": provider,
            "durationSeconds": round(duration_seconds, 3),
            "voiceSegmentCount": len(rendered_segments),
            "visualSceneCount": len(rendered_segments),
            "pageSwitchPauseSeconds": pause_seconds,
            "speechSegments": rendered_segments,
            "timeline": timeline,
            "timelinePath": str(timeline_path.resolve()),
            "totalFrames": total_frames,
            "timelineSource": "segmented_tts_audio_duration",
            "fallbackWarnings": fallback_warnings,
        }

    def synthesize_timeline_to_file(
        self,
        scene_plan: list[dict[str, Any]],
        voice: str,
        output_dir: Path,
        *,
        pause_seconds: float = 0.35,
    ) -> tuple[Path, list[dict[str, Any]], list[str], dict[str, Any]]:
        timeline_dir = output_dir / "voice_timeline"
        timeline_dir.mkdir(parents=True, exist_ok=True)
        logs: list[str] = []
        fallback_warnings: list[str] = []
        scenes: list[dict[str, Any]] = []
        concat_inputs: list[Path] = []

        for index, scene in enumerate(scene_plan[:10], start=1):
            narration = str(scene.get("narration") or scene.get("text") or scene.get("caption") or "").strip()
            if not narration:
                continue
            segment_path, segment_logs, segment_metadata = self._synthesize_to_file(
                narration,
                voice,
                timeline_dir,
                output_stem=f"scene_{index:03d}",
            )
            logs.extend(log.replace("[TTS]", f"[TTS:timeline-{index:03d}]") for log in segment_logs)
            fallback_warnings.extend(segment_metadata.get("fallbackWarnings", []))
            segment_duration = segment_metadata.get("durationSeconds")
            if not isinstance(segment_duration, (int, float)):
                segment_duration = self._audio_duration_seconds(segment_path)
            concat_inputs.append(segment_path)
            scene_duration = float(segment_duration or 1.0)
            if index < len(scene_plan[:10]) and pause_seconds > 0:
                pause_path = timeline_dir / f"pause_{index:03d}.wav"
                self._write_silence_seconds(pause_path, pause_seconds)
                concat_inputs.append(pause_path)
                scene_duration += pause_seconds
            scenes.append(
                {
                    "id": str(scene.get("id") or f"scene-{index:03d}"),
                    "title": str(scene.get("title") or f"Scene {index}"),
                    "caption": str(scene.get("caption") or narration),
                    "text": narration,
                    "audioPath": "",
                    "duration": round(max(0.8, scene_duration), 3),
                }
            )

        output_path = output_dir / "voice.wav"
        if concat_inputs:
            self._concat_wavs(concat_inputs, output_path)
        else:
            self._write_silence_seconds(output_path, 3.0)
        duration_seconds = self._audio_duration_seconds(output_path)
        metadata = {
            "ttsProvider": settings_service.get().tts_provider.lower(),
            "durationSeconds": round(duration_seconds, 3),
            "voiceSegmentCount": len(scenes),
            "visualSceneCount": len(scenes),
            "fallbackWarnings": fallback_warnings,
        }
        logs.append(f"[TTS] stitched {len(scenes)} scene narrations into one voice timeline at {output_path}")
        return output_path, scenes, logs, metadata

    def synthesize_segments_to_files(
        self,
        script: str,
        voice: str,
        output_dir: Path,
        scene_plan: list[dict[str, Any]] | None = None,
    ) -> tuple[list[dict[str, Any]], list[str], dict[str, Any]]:
        scenes_dir = output_dir / "voice_segments"
        scenes_dir.mkdir(parents=True, exist_ok=True)
        segments = scene_plan or [
            {
                "id": f"scene-{index:03d}",
                "title": f"Scene {index}",
                "caption": text,
                "narration": text,
            }
            for index, text in enumerate(self._split_script(script), start=1)
        ]
        all_logs: list[str] = []
        fallback_warnings: list[str] = []
        rendered_segments: list[dict[str, Any]] = []

        for index, segment in enumerate(segments[:10], start=1):
            narration = str(segment.get("narration") or segment.get("text") or segment.get("caption") or "").strip()
            if not narration:
                continue
            output_stem = f"scene_{index:03d}"
            audio_path, logs, metadata = self._synthesize_to_file(narration, voice, scenes_dir, output_stem=output_stem)
            all_logs.extend(log.replace("[TTS]", f"[TTS:scene-{index:03d}]") for log in logs)
            fallback_warnings.extend(metadata.get("fallbackWarnings", []))
            duration = metadata.get("durationSeconds")
            if not isinstance(duration, (int, float)):
                duration = self._audio_duration_seconds(audio_path)
            rendered_segments.append(
                {
                    "id": str(segment.get("id") or f"scene-{index:03d}"),
                    "title": str(segment.get("title") or f"Scene {index}"),
                    "caption": str(segment.get("caption") or narration),
                    "text": narration,
                    "audioPath": str(audio_path),
                    "duration": round(max(1.0, float(duration or 3.0)), 3),
                }
            )

        metadata = {
            "voiceSegmentCount": len(rendered_segments),
            "fallbackWarnings": fallback_warnings,
        }
        return rendered_segments, all_logs, metadata

    def _synthesize_to_file(
        self,
        script: str,
        voice: str,
        output_dir: Path,
        *,
        output_stem: str,
    ) -> tuple[Path, list[str], dict[str, Any]]:
        logs: list[str] = []
        runtime_settings = settings_service.get()
        provider = runtime_settings.tts_provider.lower()
        metadata: dict[str, Any] = {
            "ttsProvider": provider,
            "fallbackWarnings": [],
        }

        if provider == "edge_tts" and importlib.util.find_spec("edge_tts"):
            mp3_path = output_dir / f"{output_stem}.mp3"
            output_path = output_dir / f"{output_stem}.wav"
            try:
                asyncio.run(self._edge_tts(script, runtime_settings.edge_tts_voice or voice, mp3_path))
                if mp3_path.exists() and mp3_path.stat().st_size > 0:
                    logs.append(f"[TTS] edge_tts generated mp3 voice audio at {mp3_path}")
                    if shutil.which("ffmpeg"):
                        result = subprocess.run(
                            [
                                "ffmpeg",
                                "-y",
                                "-i",
                                str(mp3_path),
                                "-ar",
                                "44100",
                                "-ac",
                                "2",
                                str(output_path),
                            ],
                            capture_output=True,
                            text=True,
                            timeout=180,
                        )
                        if result.returncode == 0 and output_path.exists() and output_path.stat().st_size > 0:
                            logs.append(f"[TTS] converted edge_tts audio to wav at {output_path}")
                            metadata["durationSeconds"] = round(self._audio_duration_seconds(output_path), 3)
                            return output_path, logs, metadata
                        warning = f"[TTS] fallback: ffmpeg conversion failed, using mp3 directly: {result.stderr[-300:]}"
                        logs.append(warning)
                        metadata["fallbackWarnings"].append(warning)
                    metadata["durationSeconds"] = round(self._audio_duration_seconds(mp3_path), 3)
                    return mp3_path, logs, metadata
                warning = "[TTS] fallback: edge_tts finished without a usable audio file; generating silent wav."
                logs.append(warning)
                metadata["fallbackWarnings"].append(warning)
            except Exception as exc:
                warning = f"[TTS] fallback: edge_tts failed; generating silent wav: {exc}"
                logs.append(warning)
                metadata["fallbackWarnings"].append(warning)
        elif provider == "fishspeech":
            output_path = output_dir / f"{output_stem}.wav"
            try:
                logs.append("[FishSpeech] loading model...")
                logs.append("[FishSpeech] generating voice...")
                self._fishspeech(script, runtime_settings.fishspeech_voice or voice, output_path, runtime_settings)
                duration_seconds = self._audio_duration_seconds(output_path)
                if output_path.exists() and output_path.stat().st_size > 44 and duration_seconds >= 1:
                    logs.append("[FishSpeech] voice generated")
                    logs.append(f"[TTS] FishSpeech generated wav voice audio at {output_path}")
                    metadata["durationSeconds"] = round(duration_seconds, 3)
                    return output_path, logs, metadata
                warning = f"[TTS] fallback: FishSpeech returned no usable audio ({duration_seconds:.3f}s); generating silent wav."
                logs.append(warning)
                metadata["fallbackWarnings"].append(warning)
            except Exception as exc:
                warning = f"[TTS] fallback: FishSpeech adapter failed; generating silent wav: {exc}"
                logs.append(warning)
                metadata["fallbackWarnings"].append(warning)
        elif provider == "edge_tts":
            warning = "[TTS] fallback: edge_tts package is not installed; generating silent wav."
            logs.append(warning)
            metadata["fallbackWarnings"].append(warning)
        else:
            warning = f"[TTS] fallback: provider '{provider}' uses local silent wav generation."
            logs.append(warning)
            metadata["fallbackWarnings"].append(warning)

        output_path = output_dir / f"{output_stem}.wav"
        seconds = self._fallback_duration_seconds(script)
        self._write_silence(output_path, seconds=seconds)
        logs.append(f"[TTS] generated fallback silent wav at {output_path}")
        metadata["ttsProvider"] = f"{provider}:fallback_silence"
        metadata["durationSeconds"] = round(self._audio_duration_seconds(output_path), 3)
        return output_path, logs, metadata

    async def _edge_tts(self, script: str, voice: str, output_path: Path) -> None:
        import edge_tts

        communicate = edge_tts.Communicate(script, voice or "en-US-AriaNeural")
        await communicate.save(str(output_path))

    def _fishspeech(self, script: str, voice: str, output_path: Path, runtime_settings) -> None:
        if msgpack is None:
            raise RuntimeError("msgpack is not installed; run `pip install -r apps/api/requirements.txt`.")

        payload = self._build_fishspeech_payload(script, voice, runtime_settings)
        body = msgpack.packb(payload, use_bin_type=True)
        headers = {
            "Content-Type": "application/msgpack",
            "Accept": "audio/wav,audio/*;q=0.9,application/octet-stream;q=0.8",
        }
        if runtime_settings.fishspeech_api_key:
            headers["Authorization"] = f"Bearer {runtime_settings.fishspeech_api_key}"

        url = runtime_settings.fishspeech_base_url
        separator = "&" if "?" in url else "?"
        if "format=" not in url:
            url = f"{url}{separator}format=msgpack"

        request = urllib.request.Request(
            url,
            data=body,
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=runtime_settings.fishspeech_timeout_seconds) as response:
                audio_bytes = response.read()
        except urllib.error.HTTPError as exc:
            message = exc.read().decode("utf-8", errors="ignore")[:300]
            raise RuntimeError(f"HTTP {exc.code}: {message}") from exc

        output_path.write_bytes(audio_bytes)

    def _build_fishspeech_payload(self, script: str, voice: str, runtime_settings) -> dict[str, Any]:
        reference_id = voice if voice and voice != "default" else None
        references = [] if reference_id else self._fishspeech_references(runtime_settings)
        cache_setting = getattr(runtime_settings, "fishspeech_use_memory_cache", "auto") or "auto"
        if cache_setting == "auto":
            use_memory_cache = "on" if reference_id or references else "off"
        else:
            use_memory_cache = "on" if cache_setting == "on" else "off"

        return {
            "text": script,
            "references": references,
            "reference_id": reference_id,
            "format": "wav",
            "latency": "normal",
            "max_new_tokens": 1024,
            "chunk_length": 300,
            "top_p": 0.8,
            "repetition_penalty": 1.1,
            "temperature": 0.8,
            "streaming": False,
            "use_memory_cache": use_memory_cache,
            "seed": 42,
        }

    def _fishspeech_references(self, runtime_settings) -> list[dict[str, Any]]:
        audio_path_value = str(getattr(runtime_settings, "fishspeech_reference_audio_path", "") or "").strip()
        if not audio_path_value:
            return []

        audio_path = self._resolve_local_path(audio_path_value)
        if not audio_path.exists() or not audio_path.is_file():
            raise RuntimeError(f"FishSpeech reference audio not found: {audio_path}")

        reference_text = str(getattr(runtime_settings, "fishspeech_reference_text", "") or "").strip()
        text_path_value = str(getattr(runtime_settings, "fishspeech_reference_text_path", "") or "").strip()
        if not reference_text and text_path_value:
            text_path = self._resolve_local_path(text_path_value)
            if not text_path.exists() or not text_path.is_file():
                raise RuntimeError(f"FishSpeech reference text not found: {text_path}")
            reference_text = text_path.read_text(encoding="utf-8").strip()
        if not reference_text:
            lab_path = audio_path.with_suffix(".lab")
            if lab_path.exists():
                reference_text = lab_path.read_text(encoding="utf-8").strip()
        if not reference_text:
            raise RuntimeError("FishSpeech reference text is required when reference audio is configured.")

        return [{"audio": audio_path.read_bytes(), "text": reference_text}]

    def _has_stable_fishspeech_voice(self, runtime_settings, voice: str) -> bool:
        configured_voice = str(getattr(runtime_settings, "fishspeech_voice", "") or voice or "").strip()
        if configured_voice and configured_voice != "default":
            return True
        return bool(str(getattr(runtime_settings, "fishspeech_reference_audio_path", "") or "").strip())

    def _resolve_local_path(self, value: str) -> Path:
        path = Path(value).expanduser()
        if path.is_absolute():
            return path
        return (Path.cwd() / path).resolve()

    def _audio_duration_seconds(self, path: Path) -> float:
        if not path.exists() or path.stat().st_size <= 44:
            return 0.0
        try:
            with wave.open(str(path), "rb") as wav:
                frame_rate = wav.getframerate()
                if frame_rate <= 0:
                    return 0.0
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
                str(path.resolve()),
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

    def _split_script(self, script: str) -> list[str]:
        normalized = " ".join(script.split())
        if not normalized:
            return ["DevShorts AI 正在生成一段适合短视频的中文口播。"]
        sentences = [part.strip() for part in re.findall(r"[^。！？!?]+[。！？!?]?", normalized) if part.strip()]
        if not sentences:
            sentences = [normalized]
        if len(sentences) > 1:
            return sentences[:8]

        segments: list[str] = []
        current = ""
        for sentence in sentences:
            candidate = f"{current}{sentence}" if current else sentence
            if current and len(candidate) > 70:
                segments.append(current)
                current = sentence
            else:
                current = candidate
        if current:
            segments.append(current)
        return segments[:8]

    def _fallback_duration_seconds(self, script: str) -> int:
        normalized = " ".join(script.split())
        if not normalized:
            return 3
        words = normalized.split()
        word_count = len(words)
        has_mostly_spaced_words = word_count > 1 and sum(len(word) for word in words) < len(normalized) * 0.75
        if has_mostly_spaced_words:
            estimated = round(word_count / 3)
        else:
            estimated = round(len(normalized) / 8)
        return max(2, min(30, estimated or 3))

    def _write_silence(self, path: Path, seconds: int) -> None:
        self._write_silence_seconds(path, float(seconds))

    def _write_silence_seconds(self, path: Path, seconds: float) -> None:
        sample_rate = 16000
        with wave.open(str(path), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(b"\x00\x00" * int(sample_rate * seconds))

    def _write_silence_like(self, source_path: Path, output_path: Path, seconds: float) -> None:
        try:
            with wave.open(str(source_path), "rb") as source:
                channels = source.getnchannels()
                sample_width = source.getsampwidth()
                frame_rate = source.getframerate()
        except wave.Error:
            self._write_silence_seconds(output_path, seconds)
            return
        with wave.open(str(output_path), "wb") as wav:
            wav.setnchannels(channels)
            wav.setsampwidth(sample_width)
            wav.setframerate(frame_rate)
            wav.writeframes(b"\x00" * int(frame_rate * seconds) * channels * sample_width)

    def _concat_wavs(self, inputs: list[Path], output_path: Path) -> None:
        ffmpeg_path = shutil.which("ffmpeg")
        if ffmpeg_path:
            concat_file = output_path.with_suffix(".concat.txt")
            concat_file.write_text(
                "\n".join(f"file '{path.resolve().as_posix()}'" for path in inputs),
                encoding="utf-8",
            )
            result = subprocess.run(
                [
                    ffmpeg_path,
                    "-y",
                    "-f",
                    "concat",
                    "-safe",
                    "0",
                    "-i",
                    str(concat_file),
                    "-ar",
                    "44100",
                    "-ac",
                    "2",
                    str(output_path),
                ],
                capture_output=True,
                text=True,
                timeout=180,
            )
            if result.returncode == 0 and output_path.exists() and output_path.stat().st_size > 44:
                return

        first = inputs[0]
        with wave.open(str(first), "rb") as source:
            channels = source.getnchannels()
            sample_width = source.getsampwidth()
            frame_rate = source.getframerate()
        with wave.open(str(output_path), "wb") as target:
            target.setnchannels(channels)
            target.setsampwidth(sample_width)
            target.setframerate(frame_rate)
            for path in inputs:
                with wave.open(str(path), "rb") as source:
                    target.writeframes(source.readframes(source.getnframes()))
